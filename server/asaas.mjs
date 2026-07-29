import { config } from "./config.mjs";
import { normalizeCpf } from "./cpf-utils.mjs";
import { db } from "./db.mjs";
import { createUserNotification } from "./notifications.mjs";
import { sendServicePaymentReceiptEmail } from "./providers/email-provider.mjs";
import { createId, nowIso } from "./security.mjs";
import { HttpError } from "./utils.mjs";
import { normalizeEmail, normalizePhone } from "./validators.mjs";

const SERVICE_FEE_RATE = 0.1;
const ASAAS_FIXED_FEE_CENTS = 199;
const INSTANT_WITHDRAWAL_FEE_CENTS = 199;
const FREE_WITHDRAWAL_DELAY_MS = 24 * 60 * 60 * 1000;
const ASAAS_REQUEST_TIMEOUT_MS = 12_000;
const ASAAS_BALANCE_CACHE_TTL_MS = 20_000;
const ASAAS_PAID_STATUSES = new Set(["RECEIVED", "CONFIRMED"]);
const PIX_PAYMENT_EXPIRES_IN_MS = 15 * 60 * 1000;
const ASAAS_PENDING_TRANSFER_STATUSES = new Set([
  "PENDING",
  "BANK_PROCESSING",
  "AWAITING_AUTORIZATION",
  "AWAITING_AUTHORIZATION",
]);
const ASAAS_FAILED_TRANSFER_STATUSES = new Set(["FAILED", "CANCELLED"]);
let cachedAsaasBalanceSnapshot = {
  balanceCents: null,
  syncedAt: null,
  fetchedAt: 0,
};

function getNotificationFirstName(fullName, fallback = "Usuário") {
  const normalized = String(fullName ?? "").trim();

  if (!normalized) {
    return fallback;
  }

  return normalized.split(/\s+/)[0] || fallback;
}

const selectUserByIdStatement = db.prepare(
  `
    SELECT *
    FROM users
    WHERE id = ?
    LIMIT 1
  `
);

const updateUserAsaasCustomerIdStatement = db.prepare(
  `
    UPDATE users
    SET
      asaas_customer_id = ?,
      updated_at = ?
    WHERE id = ?
  `
);

const selectServiceRequestPaymentStatement = db.prepare(
  `
    SELECT
      service_requests.*,
      requester.full_name AS requester_name,
      requester.email AS requester_email,
      requester.phone AS requester_phone,
      requester.cpf_digits AS requester_cpf_digits,
      worker.full_name AS worker_name,
      worker.cpf_digits AS worker_cpf_digits,
      worker.pix_withdrawal_key_type AS worker_pix_withdrawal_key_type,
      worker.pix_withdrawal_key AS worker_pix_withdrawal_key
    FROM service_requests
    INNER JOIN users AS requester ON requester.id = service_requests.requester_user_id
    LEFT JOIN users AS worker ON worker.id = service_requests.worker_user_id
    WHERE service_requests.id = ?
    LIMIT 1
  `
);

const selectServiceRequestByAsaasPaymentIdStatement = db.prepare(
  `
    SELECT *
    FROM service_requests
    WHERE asaas_payment_id = ?
    LIMIT 1
  `
);

const selectServiceRequestByIdStatement = db.prepare(
  `
    SELECT
      service_requests.*,
      requester.full_name AS requester_name,
      requester.email AS requester_email,
      requester.phone AS requester_phone,
      requester.cpf_digits AS requester_cpf_digits,
      worker.full_name AS worker_name,
      worker.cpf_digits AS worker_cpf_digits,
      worker.pix_withdrawal_key_type AS worker_pix_withdrawal_key_type,
      worker.pix_withdrawal_key AS worker_pix_withdrawal_key
    FROM service_requests
    INNER JOIN users AS requester ON requester.id = service_requests.requester_user_id
    LEFT JOIN users AS worker ON worker.id = service_requests.worker_user_id
    WHERE service_requests.id = ?
    LIMIT 1
  `
);

const updateServiceRequestAsaasPaymentStatement = db.prepare(
  `
    UPDATE service_requests
    SET
      asaas_payment_id = ?,
      asaas_payment_status = ?,
      asaas_payment_invoice_url = ?,
      asaas_payment_due_date = ?,
      asaas_payment_expires_at = ?,
      asaas_payment_copy_paste = ?,
      asaas_payment_qr_code_base64 = ?,
      asaas_payment_received_at = ?,
      payment_amount_subtotal_cents = ?,
      payment_amount_fee_cents = ?,
      payment_amount_total_cents = ?,
      payment_currency = ?,
      updated_at = ?
    WHERE id = ?
  `
);

const updateServiceRequestAsaasPaymentStateStatement = db.prepare(
  `
    UPDATE service_requests
    SET
      asaas_payment_id = COALESCE(NULLIF(asaas_payment_id, ''), ?),
      asaas_payment_status = ?,
      asaas_payment_invoice_url = ?,
      asaas_payment_due_date = ?,
      asaas_payment_expires_at = COALESCE(?, asaas_payment_expires_at),
      asaas_payment_copy_paste = COALESCE(?, asaas_payment_copy_paste),
      asaas_payment_qr_code_base64 = COALESCE(?, asaas_payment_qr_code_base64),
      asaas_payment_received_at = ?,
      updated_at = ?
    WHERE id = ?
  `
);

const markServiceRequestPaidStatement = db.prepare(
  `
    UPDATE service_requests
    SET
      status = 'confirmed',
      asaas_payment_id = COALESCE(NULLIF(asaas_payment_id, ''), ?),
      asaas_payment_status = ?,
      asaas_payment_invoice_url = ?,
      asaas_payment_due_date = ?,
      asaas_payment_expires_at = COALESCE(?, asaas_payment_expires_at),
      asaas_payment_copy_paste = COALESCE(?, asaas_payment_copy_paste),
      asaas_payment_qr_code_base64 = COALESCE(?, asaas_payment_qr_code_base64),
      asaas_payment_received_at = ?,
      updated_at = ?
    WHERE id = ?
      AND status = 'payment'
  `
);

const clearServiceRequestPaymentSessionStatement = db.prepare(
  `
    UPDATE service_requests
    SET
      asaas_payment_id = NULL,
      asaas_payment_status = NULL,
      asaas_payment_invoice_url = NULL,
      asaas_payment_due_date = NULL,
      asaas_payment_expires_at = NULL,
      asaas_payment_copy_paste = NULL,
      asaas_payment_qr_code_base64 = NULL,
      asaas_payment_received_at = NULL,
      payment_amount_subtotal_cents = NULL,
      payment_amount_fee_cents = NULL,
      payment_amount_total_cents = NULL,
      payment_currency = 'brl',
      updated_at = ?
    WHERE id = ?
  `
);

const selectProcessedAsaasWebhookEventStatement = db.prepare(
  `
    SELECT id
    FROM asaas_webhook_events
    WHERE id = ?
    LIMIT 1
  `
);

const insertProcessedAsaasWebhookEventStatement = db.prepare(
  `
    INSERT OR IGNORE INTO asaas_webhook_events (id, event_type, processed_at)
    VALUES (?, ?, ?)
  `
);

const selectWorkerWalletEntriesStatement = db.prepare(
  `
    SELECT
      service_requests.id,
      service_requests.category,
      service_requests.description,
      service_requests.status,
      service_requests.service_details_json,
      service_requests.payment_amount_subtotal_cents,
      service_requests.payment_amount_fee_cents,
      service_requests.payment_amount_total_cents,
      service_requests.payment_currency,
      service_requests.asaas_payment_status,
      service_requests.dispute_status,
      service_requests.worker_withdrawal_id,
      service_requests.worker_withdrawn_at,
      service_requests.created_at,
      service_requests.updated_at,
      requester.full_name AS requester_name,
      worker_withdrawals.status AS withdrawal_status
    FROM service_requests
    INNER JOIN users AS requester ON requester.id = service_requests.requester_user_id
    LEFT JOIN worker_withdrawals ON worker_withdrawals.id = service_requests.worker_withdrawal_id
    WHERE service_requests.worker_user_id = ?
      AND service_requests.status IN ('waiting-worker', 'payment', 'confirmed', 'completed')
    ORDER BY COALESCE(worker_withdrawals.updated_at, service_requests.updated_at, service_requests.created_at) DESC
    LIMIT 20
  `
);

const selectAvailableCompletedRequestsForWithdrawalStatement = db.prepare(
  `
    SELECT
      service_requests.id,
      service_requests.payment_amount_subtotal_cents,
      service_requests.service_details_json,
      service_requests.asaas_payment_received_at,
      service_requests.updated_at
    FROM service_requests
    LEFT JOIN worker_withdrawals ON worker_withdrawals.id = service_requests.worker_withdrawal_id
    WHERE service_requests.worker_user_id = ?
      AND service_requests.status = 'completed'
      AND service_requests.asaas_payment_status IN ('RECEIVED', 'CONFIRMED')
      AND COALESCE(service_requests.dispute_status, '') <> 'open'
      AND (
        service_requests.worker_withdrawal_id IS NULL
        OR worker_withdrawals.status IN ('FAILED', 'CANCELLED')
      )
    ORDER BY service_requests.updated_at ASC
  `
);

const selectFreeWithdrawalNotificationCandidatesStatement = db.prepare(
  `
    SELECT
      service_requests.id,
      service_requests.worker_user_id,
      service_requests.category,
      service_requests.description,
      service_requests.service_details_json,
      service_requests.payment_amount_subtotal_cents,
      service_requests.asaas_payment_received_at,
      service_requests.updated_at,
      requester.full_name AS requester_name,
      worker.full_name AS worker_name
    FROM service_requests
    INNER JOIN users AS requester ON requester.id = service_requests.requester_user_id
    INNER JOIN users AS worker ON worker.id = service_requests.worker_user_id
    LEFT JOIN worker_withdrawals ON worker_withdrawals.id = service_requests.worker_withdrawal_id
    WHERE service_requests.worker_user_id IS NOT NULL
      AND service_requests.status = 'completed'
      AND service_requests.asaas_payment_status IN ('RECEIVED', 'CONFIRMED')
      AND COALESCE(service_requests.dispute_status, '') <> 'open'
      AND (
        service_requests.worker_withdrawal_id IS NULL
        OR worker_withdrawals.status IN ('FAILED', 'CANCELLED')
      )
    ORDER BY service_requests.updated_at ASC
  `
);

const selectRecentWithdrawalsByUserStatement = db.prepare(
  `
    SELECT *
    FROM worker_withdrawals
    WHERE user_id = ?
    ORDER BY created_at DESC
    LIMIT 10
  `
);

const selectWorkerWithdrawalByProviderIdStatement = db.prepare(
  `
    SELECT *
    FROM worker_withdrawals
    WHERE provider_transfer_id = ?
    LIMIT 1
  `
);

const insertWorkerWithdrawalStatement = db.prepare(
  `
    INSERT INTO worker_withdrawals (
      id,
      user_id,
      provider_transfer_id,
      mode,
      gross_amount_cents,
      fee_amount_cents,
      amount_cents,
      currency,
      status,
      pix_key_type,
      pix_key,
      description,
      created_at,
      updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `
);

const updateWorkerWithdrawalStatusStatement = db.prepare(
  `
    UPDATE worker_withdrawals
    SET
      status = ?,
      updated_at = ?
    WHERE id = ?
  `
);

const attachWithdrawalToServiceRequestStatement = db.prepare(
  `
    UPDATE service_requests
    SET
      worker_withdrawal_id = ?,
      worker_withdrawn_at = ?,
      updated_at = ?
    WHERE id = ?
  `
);

const clearWithdrawalFromServiceRequestsStatement = db.prepare(
  `
    UPDATE service_requests
    SET
      worker_withdrawal_id = NULL,
      worker_withdrawn_at = NULL,
      updated_at = ?
    WHERE worker_withdrawal_id = ?
  `
);

const selectServiceRequestsByWithdrawalIdStatement = db.prepare(
  `
    SELECT id
    FROM service_requests
    WHERE worker_withdrawal_id = ?
  `
);

const updateServiceRequestRefundStateStatement = db.prepare(
  `
    UPDATE service_requests
    SET
      asaas_payment_status = ?,
      updated_at = ?
    WHERE id = ?
  `
);

const insertServiceRequestEventStatement = db.prepare(
  `
    INSERT INTO service_request_events (
      id,
      service_request_id,
      actor_user_id,
      actor_role,
      event_kind,
      title,
      description,
      meta_json,
      created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `
);

function ensureAsaasConfigured() {
  if (!config.asaas.apiKey) {
    throw new HttpError(
      500,
      "A integração Pix brasileira ainda não foi configurada. Defina ASAAS_API_KEY no servidor."
    );
  }

  if (!config.asaas.apiKey.startsWith("$aact_") || config.asaas.apiKey.length < 32) {
    throw new HttpError(
      500,
      "ASAAS_API_KEY inválida no servidor. Revise a chave completa no .env sem espacos ou quebras de linha."
    );
  }
}

function buildAsaasUrl(pathname, searchParams = null) {
  const baseUrl = new URL(config.asaas.apiBaseUrl);
  const url = new URL(pathname.replace(/^\//, ""), `${baseUrl.toString().replace(/\/$/, "")}/`);

  if (searchParams && typeof searchParams === "object") {
    for (const [key, value] of Object.entries(searchParams)) {
      if (value === undefined || value === null || value === "") {
        continue;
      }

      url.searchParams.set(key, String(value));
    }
  }

  return url;
}

function resolveAsaasErrorMessage(payload, fallbackMessage) {
  if (payload && typeof payload === "object") {
    if (typeof payload.errors?.[0]?.description === "string") {
      return payload.errors[0].description;
    }

    if (typeof payload.message === "string" && payload.message.trim()) {
      return payload.message.trim();
    }
  }

  return fallbackMessage;
}

async function asaasRequest(pathname, { method = "GET", body, searchParams } = {}) {
  ensureAsaasConfigured();
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), ASAAS_REQUEST_TIMEOUT_MS);
  let response;

  try {
    response = await fetch(buildAsaasUrl(pathname, searchParams), {
      method,
      headers: {
        "Content-Type": "application/json",
        access_token: config.asaas.apiKey,
      },
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new HttpError(
        504,
        "O Asaas demorou demais para responder. Tente novamente em instantes."
      );
    }

    throw new HttpError(502, "Não foi possível conectar ao Asaas agora.");
  } finally {
    clearTimeout(timeoutId);
  }

  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    throw new HttpError(
      response.status >= 400 && response.status < 600 ? response.status : 502,
      resolveAsaasErrorMessage(payload, "O Asaas não conseguiu processar está operação agora.")
    );
  }

  return payload;
}

function readCachedAsaasBalanceSnapshot() {
  if (!cachedAsaasBalanceSnapshot.syncedAt) {
    return null;
  }

  if (Date.now() - cachedAsaasBalanceSnapshot.fetchedAt > ASAAS_BALANCE_CACHE_TTL_MS) {
    return null;
  }

  return {
    balanceCents: cachedAsaasBalanceSnapshot.balanceCents,
    syncedAt: cachedAsaasBalanceSnapshot.syncedAt,
  };
}

function toDateOnly(value = new Date()) {
  const date = value instanceof Date ? value : new Date(value);

  if (Number.isNaN(date.getTime())) {
    return new Date().toISOString().slice(0, 10);
  }

  return date.toISOString().slice(0, 10);
}

function normalizeMoneyToCents(value) {
  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? Math.max(0, Math.round(numericValue * 100)) : 0;
}

function parseCurrencyToCents(value) {
  const digits = String(value ?? "").replace(/\D/g, "");
  return digits ? Number(digits) : 0;
}

function formatCpfDigits(value) {
  const digits = normalizeCpf(value ?? "");

  if (digits.length !== 11) {
    return digits;
  }

  return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`;
}

function calculateAppFeeCents(subtotalCents) {
  const normalizedSubtotal = Number.isFinite(subtotalCents) ? Math.max(0, subtotalCents) : 0;
  return Math.round(normalizedSubtotal * SERVICE_FEE_RATE);
}

function calculatePlatformFeeCents(subtotalCents) {
  const appFeeCents = calculateAppFeeCents(subtotalCents);
  return appFeeCents + (subtotalCents > 0 ? ASAAS_FIXED_FEE_CENTS : 0);
}

async function fetchAsaasAccountBalanceSnapshot() {
  const cachedSnapshot = readCachedAsaasBalanceSnapshot();

  if (cachedSnapshot) {
    return cachedSnapshot;
  }

  try {
    const payload = await asaasRequest("/finance/balance");
    const rawBalance =
      typeof payload?.balance === "number"
        ? payload.balance
        : typeof payload?.availableBalance === "number"
          ? payload.availableBalance
          : null;

    cachedAsaasBalanceSnapshot = {
      balanceCents: rawBalance === null ? null : normalizeMoneyToCents(rawBalance),
      syncedAt: nowIso(),
      fetchedAt: Date.now(),
    };

    return {
      balanceCents: cachedAsaasBalanceSnapshot.balanceCents,
      syncedAt: cachedAsaasBalanceSnapshot.syncedAt,
    };
  } catch {
    if (cachedAsaasBalanceSnapshot.syncedAt) {
      return {
        balanceCents: cachedAsaasBalanceSnapshot.balanceCents,
        syncedAt: cachedAsaasBalanceSnapshot.syncedAt,
      };
    }

    return {
      balanceCents: null,
      syncedAt: null,
    };
  }
}

function parseServiceDetails(value) {
  if (!value) {
    return null;
  }

  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch {
    return null;
  }
}

function normalizeStoredAmountCents(value) {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const amount = Number(value);
  return Number.isFinite(amount) ? Math.max(0, amount) : null;
}

function doesStoredPixCpfMatchUser(pixKeyType, pixKey, cpfDigits) {
  if (String(pixKeyType ?? "").trim().toUpperCase() !== "CPF") {
    return false;
  }

  const normalizedPixKey = normalizeCpf(pixKey ?? "");
  const normalizedCpf = normalizeCpf(cpfDigits ?? "");

  return Boolean(normalizedPixKey && normalizedCpf && normalizedPixKey === normalizedCpf);
}

function isStandardWithdrawalEligible(row) {
  const referenceDate = new Date(
    row?.asaas_payment_received_at ?? row?.updated_at ?? row?.created_at ?? nowIso()
  );

  if (Number.isNaN(referenceDate.getTime())) {
    return false;
  }

  return Date.now() - referenceDate.getTime() >= FREE_WITHDRAWAL_DELAY_MS;
}

function getFreeWithdrawalAvailableAt(row) {
  const referenceDate = new Date(
    row?.asaas_payment_received_at ?? row?.updated_at ?? row?.created_at ?? nowIso()
  );

  if (Number.isNaN(referenceDate.getTime())) {
    return null;
  }

  return new Date(referenceDate.getTime() + FREE_WITHDRAWAL_DELAY_MS).toISOString();
}

function resolveWalletEntryNetAmountCents(row) {
  const storedAmountCents = normalizeStoredAmountCents(row.payment_amount_subtotal_cents);

  if (storedAmountCents !== null) {
    return storedAmountCents;
  }

  const details = parseServiceDetails(row.service_details_json);
  return parseCurrencyToCents(details?.price);
}

function resolveRequestWithdrawalAmountCents(row) {
  const storedAmountCents = normalizeStoredAmountCents(row.payment_amount_subtotal_cents);

  if (storedAmountCents !== null) {
    return storedAmountCents;
  }

  const details = parseServiceDetails(row.service_details_json);
  return parseCurrencyToCents(details?.price);
}

function selectRequestsWithinProviderBalance(requestRows, providerBalanceCents) {
  if (!Number.isFinite(providerBalanceCents)) {
    const totalCents = requestRows.reduce(
      (total, row) => total + resolveRequestWithdrawalAmountCents(row),
      0
    );

    return {
      requestRows,
      totalCents,
    };
  }

  let totalCents = 0;
  const selectedRows = [];

  for (const row of requestRows) {
    const requestAmountCents = resolveRequestWithdrawalAmountCents(row);

    if (requestAmountCents <= 0) {
      continue;
    }

    if (totalCents + requestAmountCents > providerBalanceCents) {
      continue;
    }

    totalCents += requestAmountCents;
    selectedRows.push(row);
  }

  return {
    requestRows: selectedRows,
    totalCents,
  };
}

function resolveWalletEntryFeeAmountCents(row, netAmountCents) {
  const storedFeeCents = normalizeStoredAmountCents(row.payment_amount_fee_cents);
  return storedFeeCents !== null ? storedFeeCents : calculatePlatformFeeCents(netAmountCents);
}

function isPaidAsaasStatus(status) {
  return ASAAS_PAID_STATUSES.has(String(status ?? "").trim().toUpperCase());
}

function isReceivedInCashPayment(payment) {
  const paymentMarkers = [
    payment?.billingType,
    payment?.type,
    payment?.paymentMethod,
    payment?.paymentOrigin,
  ].map((value) => String(value ?? "").trim().toUpperCase());

  return Boolean(payment?.receivedInCash) || paymentMarkers.includes("RECEIVED_IN_CASH");
}

function isPaidAsaasPayment(payment) {
  return isPaidAsaasStatus(payment?.status) && !isReceivedInCashPayment(payment);
}

function resolvePixExpirationDate(qrCode) {
  const rawExpiration = qrCode?.expirationDate ?? qrCode?.expiresAt ?? null;

  if (rawExpiration) {
    const parsedExpiration = new Date(rawExpiration);

    if (!Number.isNaN(parsedExpiration.getTime())) {
      return parsedExpiration.toISOString();
    }
  }

  return new Date(Date.now() + PIX_PAYMENT_EXPIRES_IN_MS).toISOString();
}

function isPaymentSessionExpired(row) {
  if (!row?.asaas_payment_expires_at) {
    return false;
  }

  const expiresAt = new Date(row.asaas_payment_expires_at).getTime();
  return Number.isFinite(expiresAt) && expiresAt <= Date.now();
}

function normalizePhoneForAsaas(value) {
  try {
    const normalized = normalizePhone(String(value ?? ""));
    return normalized.replace(/^\+55/, "");
  } catch {
    return "";
  }
}

function createServiceRequestEvent(
  requestId,
  {
    actorUserId = null,
    actorRole = "system",
    kind,
    title,
    description,
    meta = {},
    createdAt = nowIso(),
  }
) {
  insertServiceRequestEventStatement.run(
    createId(),
    requestId,
    actorUserId,
    actorRole,
    kind,
    title,
    description,
    JSON.stringify(meta ?? {}),
    createdAt
  );
}

function maskPixKey(keyType, keyValue) {
  const value = String(keyValue ?? "").trim();

  if (!value) {
    return "";
  }

  if (keyType === "EMAIL") {
    const [localPart, domain] = value.split("@");

    if (!domain) {
      return value;
    }

    const visible = localPart.slice(0, 2);
    return `${visible}${"*".repeat(Math.max(localPart.length - 2, 1))}@${domain}`;
  }

  if (value.length <= 6) {
    return value;
  }

  return `${value.slice(0, 3)}${"*".repeat(Math.max(value.length - 6, 1))}${value.slice(-3)}`;
}

function mapWithdrawalStatus(status) {
  const normalizedStatus = String(status ?? "").trim().toUpperCase();

  if (normalizedStatus === "DONE") {
    return "withdrawn-via-pix";
  }

  if (ASAAS_PENDING_TRANSFER_STATUSES.has(normalizedStatus)) {
    return "withdrawal-in-progress";
  }

  return "withdrawal-in-progress";
}

function resolveWalletEntryStatus(row) {
  const paymentStatus = String(row.asaas_payment_status ?? "").trim().toUpperCase();
  const withdrawalStatus = String(row.withdrawal_status ?? "").trim().toUpperCase();
  const disputeStatus = String(row.dispute_status ?? "").trim().toLowerCase();

  if (disputeStatus === "open") {
    return "held-for-service";
  }

  if (row.status === "payment" && !isPaidAsaasStatus(paymentStatus)) {
    return "awaiting-client-payment";
  }

  if (row.status === "waiting-worker") {
    return "awaiting-worker-confirmation";
  }

  if (row.status === "confirmed" && isPaidAsaasStatus(paymentStatus)) {
    return "held-for-service";
  }

  if (row.status === "completed") {
    if (!row.worker_withdrawal_id || ASAAS_FAILED_TRANSFER_STATUSES.has(withdrawalStatus)) {
      return "available-for-withdrawal";
    }

    return mapWithdrawalStatus(withdrawalStatus);
  }

  return "in-progress";
}

function mapWithdrawalRecord(row) {
  return {
    id: row.id,
    providerTransferId: row.provider_transfer_id,
    mode: String(row.mode ?? "instant").trim().toLowerCase() === "standard" ? "standard" : "instant",
    grossAmountCents: Number(row.gross_amount_cents) || Number(row.amount_cents) || 0,
    feeAmountCents: Number(row.fee_amount_cents) || 0,
    amountCents: Number(row.amount_cents) || 0,
    currency: row.currency ?? "brl",
    status: String(row.status ?? "").trim().toUpperCase(),
    pixKeyType: row.pix_key_type ?? null,
    pixKeyMasked: maskPixKey(row.pix_key_type ?? null, row.pix_key ?? ""),
    description: row.description ?? "",
    createdAt: row.created_at ?? "",
    updatedAt: row.updated_at ?? "",
  };
}

function getWebhookEventId(payload) {
  if (payload && typeof payload.id === "string" && payload.id.trim()) {
    return payload.id.trim();
  }

  const event = String(payload?.event ?? payload?.type ?? "asaas-unknown");
  const paymentId = String(payload?.payment?.id ?? payload?.transfer?.id ?? "");
  const createdAt = String(payload?.dateCreated ?? payload?.payment?.dateCreated ?? nowIso());
  return `${event}:${paymentId}:${createdAt}`;
}

export function parseAsaasWebhookPayloadFromRawBody(rawBody) {
  const normalizedBody = Buffer.isBuffer(rawBody)
    ? rawBody.toString("utf8")
    : String(rawBody ?? "");
  const trimmedBody = normalizedBody.replace(/^\uFEFF/, "").trim();

  if (!trimmedBody) {
    return {};
  }

  const candidatePayloads = [trimmedBody];
  const formBody = new URLSearchParams(trimmedBody);

  for (const key of ["payload", "data", "event"]) {
    const candidate = formBody.get(key);

    if (candidate && candidate.trim()) {
      candidatePayloads.push(candidate.trim());
    }
  }

  const firstBraceIndex = trimmedBody.indexOf("{");
  const lastBraceIndex = trimmedBody.lastIndexOf("}");

  if (firstBraceIndex >= 0 && lastBraceIndex > firstBraceIndex) {
    candidatePayloads.push(trimmedBody.slice(firstBraceIndex, lastBraceIndex + 1));
  }

  for (const candidate of candidatePayloads) {
    try {
      const parsed = JSON.parse(candidate);

      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        return parsed;
      }
    } catch {
      continue;
    }
  }

  throw new HttpError(400, "Payload do webhook Asaas inválido.");
}

function hasProcessedAsaasWebhookEvent(eventId) {
  return Boolean(selectProcessedAsaasWebhookEventStatement.get(eventId));
}

function markAsaasWebhookEventProcessed(eventId, eventType) {
  insertProcessedAsaasWebhookEventStatement.run(eventId, eventType, nowIso());
}

function ensureWebhookToken(headerValue) {
  if (!config.asaas.webhookToken) {
    return;
  }

  if (!headerValue || headerValue.trim() !== config.asaas.webhookToken.trim()) {
    throw new HttpError(401, "Token do webhook Asaas inválido.");
  }
}

function resolveServiceRequestForAsaasPayment(payment) {
  const paymentId = String(payment?.id ?? "").trim();
  const externalReference = String(payment?.externalReference ?? "").trim();

  if (paymentId) {
    const matchedByPaymentId = selectServiceRequestByAsaasPaymentIdStatement.get(paymentId);

    if (matchedByPaymentId) {
      return selectServiceRequestPaymentStatement.get(matchedByPaymentId.id) ?? matchedByPaymentId;
    }
  }

  if (externalReference) {
    return selectServiceRequestByIdStatement.get(externalReference) ?? null;
  }

  return null;
}

async function findExistingAsaasCustomerByReference(userId) {
  const response = await asaasRequest("/customers", {
    searchParams: {
      externalReference: userId,
      limit: 1,
    },
  });

  return Array.isArray(response?.data) ? response.data[0] ?? null : null;
}

async function ensureAsaasCustomerForUser(userId) {
  const user = selectUserByIdStatement.get(userId);

  if (!user) {
    throw new HttpError(404, "Usuário(a) não encontrado(a) para pagamento.");
  }

  if (user.asaas_customer_id) {
    return user.asaas_customer_id;
  }

  const existingCustomer = await findExistingAsaasCustomerByReference(userId);

  if (existingCustomer?.id) {
    updateUserAsaasCustomerIdStatement.run(existingCustomer.id, nowIso(), userId);
    return existingCustomer.id;
  }

  const createdCustomer = await asaasRequest("/customers", {
    method: "POST",
    body: {
      name: user.full_name,
      email: normalizeEmail(user.email ?? ""),
      phone: normalizePhoneForAsaas(user.phone ?? ""),
      mobilePhone: normalizePhoneForAsaas(user.phone ?? ""),
      cpfCnpj: user.cpf_digits || undefined,
      externalReference: userId,
      notificationDisabled: true,
    },
  });

  if (!createdCustomer?.id) {
    throw new HttpError(502, "O Asaas não retornou um cliente válido para este pagamento.");
  }

  updateUserAsaasCustomerIdStatement.run(createdCustomer.id, nowIso(), userId);
  return createdCustomer.id;
}

function ensureWorkerPixKeyReadyFromRow(requestRow) {
  if (!requestRow.worker_user_id) {
    throw new HttpError(409, "Não existe um(a) profissional vinculado(a) a este atendimento.");
  }

  if (!requestRow.worker_pix_withdrawal_key_type || !requestRow.worker_pix_withdrawal_key) {
    throw new HttpError(
      409,
      "O(a) profissional ainda não cadastrou uma chave Pix para receber no perfil."
    );
  }

  if (
    !doesStoredPixCpfMatchUser(
      requestRow.worker_pix_withdrawal_key_type,
      requestRow.worker_pix_withdrawal_key,
      requestRow.worker_cpf_digits
    )
  ) {
    throw new HttpError(
      409,
      "O(a) profissional precisa cadastrar uma chave Pix CPF que seja do próprio CPF antes de receber por aqui."
    );
  }
}

async function fetchPixQrCode(paymentId) {
  const qrCode = await asaasRequest(`/payments/${paymentId}/pixQrCode`);
  const expirationDate = resolvePixExpirationDate(qrCode);

  return {
    copyPaste: qrCode?.payload ?? qrCode?.copyPaste ?? null,
    qrCodeBase64: qrCode?.encodedImage ?? qrCode?.image ?? null,
    expirationDate,
  };
}

function syncServiceRequestPaymentFromAsaasPayment(requestId, payment, qrCode = null) {
  const currentRequestRow = selectServiceRequestPaymentStatement.get(requestId);
  const previousPaymentStatus = String(currentRequestRow?.asaas_payment_status ?? "")
    .trim()
    .toUpperCase();
  const paymentId = String(payment?.id ?? "").trim() || null;
  const paymentStatus = String(payment?.status ?? "").trim().toUpperCase() || null;
  const paymentIsPaid = isPaidAsaasPayment(payment);
  const invoiceUrl = payment?.invoiceUrl ?? null;
  const dueDate = payment?.dueDate ?? null;
  const expiresAt = qrCode?.expirationDate ?? null;
  const receivedAt =
    paymentIsPaid
      ? payment?.clientPaymentDate ?? payment?.confirmedDate ?? payment?.paymentDate ?? nowIso()
      : null;
  const copyPaste = qrCode?.copyPaste ?? null;
  const qrCodeBase64 = qrCode?.qrCodeBase64 ?? null;
  const timestamp = nowIso();

  if (paymentIsPaid) {
    markServiceRequestPaidStatement.run(
      paymentId,
      paymentStatus,
      invoiceUrl,
      dueDate,
      expiresAt,
      copyPaste,
      qrCodeBase64,
      receivedAt,
      timestamp,
      requestId
    );
  } else {
    updateServiceRequestAsaasPaymentStateStatement.run(
      paymentId,
      paymentStatus,
      invoiceUrl,
      dueDate,
      expiresAt,
      copyPaste,
      qrCodeBase64,
      receivedAt,
      timestamp,
      requestId
    );
  }

  if (
    currentRequestRow &&
    !isPaidAsaasStatus(previousPaymentStatus) &&
    paymentIsPaid
  ) {
    createServiceRequestEvent(requestId, {
      actorRole: "system",
      kind: "payment-confirmed",
      title: "Pagamento confirmado",
      description: "O Pix caiu no Worko e o atendimento agora está protegido para a execução do serviço.",
    });

    if (currentRequestRow.worker_user_id) {
      createUserNotification(
        currentRequestRow.worker_user_id,
        "payment-confirmed",
        `${getNotificationFirstName(currentRequestRow.requester_name, "Cliente")} concluiu o Pix. O valor agora está protegido no Worko.`
      );
    }

    if (currentRequestRow.requester_email) {
      const details = parseServiceDetails(currentRequestRow.service_details_json);
      const subtotalCents =
        normalizeStoredAmountCents(currentRequestRow.payment_amount_subtotal_cents) ??
        parseCurrencyToCents(details?.price);
      const feeCents =
        normalizeStoredAmountCents(currentRequestRow.payment_amount_fee_cents) ??
        calculatePlatformFeeCents(subtotalCents);
      const totalCents =
        normalizeStoredAmountCents(currentRequestRow.payment_amount_total_cents) ??
        subtotalCents + feeCents;

      void sendServicePaymentReceiptEmail({
        receiptNumber: `${requestId.slice(0, 8)}-${paymentId.slice(-6)}`,
        paymentId,
        confirmedAt: receivedAt ?? timestamp,
        requester: {
          fullName: currentRequestRow.requester_name ?? "Cliente Worko",
          email: currentRequestRow.requester_email,
          cpf: formatCpfDigits(currentRequestRow.requester_cpf_digits ?? ""),
        },
        worker: {
          fullName: currentRequestRow.worker_name ?? "Profissional Worko",
          cpf: formatCpfDigits(currentRequestRow.worker_cpf_digits ?? ""),
        },
        service: {
          category: currentRequestRow.category ?? "Serviço",
          description: currentRequestRow.description ?? "",
          serviceDate: details?.serviceDate ?? "",
          schedule: details?.schedule ?? "",
          address: details?.address ?? "",
        },
        amounts: {
          subtotalCents,
          appFeeCents: calculateAppFeeCents(subtotalCents),
          asaasFeeCents: subtotalCents > 0 ? ASAAS_FIXED_FEE_CENTS : 0,
          feeCents,
          totalCents,
        },
        invoiceUrl: invoiceUrl ?? null,
      }).catch((error) => {
        console.warn("Falha ao enviar comprovante de pagamento por e-mail.", error);
      });
    }
  }

  if (currentRequestRow && previousPaymentStatus !== paymentStatus && paymentStatus === "OVERDUE") {
    createServiceRequestEvent(requestId, {
      actorRole: "system",
      kind: "payment-overdue",
      title: "Pagamento vencido",
      description:
        "A cobrança Pix deste atendimento venceu e precisa ser gerada novamente para seguir com o pagamento.",
      meta: {
        paymentId,
        event: "PAYMENT_OVERDUE",
      },
    });

    createUserNotification(
      currentRequestRow.requester_user_id,
      "payment-ready",
      "Seu Pix venceu. Gere uma nova cobrança no Worko para continuar o atendimento."
    );
  }
}

async function refreshTransferStatusIfNeeded(withdrawalRow) {
  const normalizedStatus = String(withdrawalRow?.status ?? "").trim().toUpperCase();

  if (!withdrawalRow?.provider_transfer_id) {
    return withdrawalRow;
  }

  if (normalizedStatus === "DONE" || ASAAS_FAILED_TRANSFER_STATUSES.has(normalizedStatus)) {
    return withdrawalRow;
  }

  try {
    const transfer = await asaasRequest(`/transfers/${withdrawalRow.provider_transfer_id}`);
    await syncWorkerWithdrawalFromTransfer(transfer);
    return selectWorkerWithdrawalByProviderIdStatement.get(withdrawalRow.provider_transfer_id);
  } catch {
    return withdrawalRow;
  }
}

async function syncWorkerWithdrawalFromTransfer(transfer) {
  const providerTransferId = String(transfer?.id ?? "").trim();

  if (!providerTransferId) {
    return null;
  }

  const withdrawal = selectWorkerWithdrawalByProviderIdStatement.get(providerTransferId);

  if (!withdrawal) {
    return null;
  }

  const previousStatus = String(withdrawal.status ?? "").trim().toUpperCase();
  const nextStatus = String(transfer?.status ?? withdrawal.status ?? "").trim().toUpperCase();
  updateWorkerWithdrawalStatusStatement.run(nextStatus, nowIso(), withdrawal.id);

  if (ASAAS_FAILED_TRANSFER_STATUSES.has(nextStatus)) {
    clearWithdrawalFromServiceRequestsStatement.run(nowIso(), withdrawal.id);
  }

  if (nextStatus !== previousStatus) {
    if (nextStatus === "DONE") {
      createUserNotification(
        withdrawal.user_id,
        "withdrawal-done",
        "Seu saque Pix foi concluído e deve cair na chave cadastrada."
      );
    } else if (ASAAS_FAILED_TRANSFER_STATUSES.has(nextStatus)) {
      createUserNotification(
        withdrawal.user_id,
        "withdrawal-failed",
        "Seu saque Pix falhou e o valor voltou para a carteira do app."
      );
    }

    const linkedRequests = selectServiceRequestsByWithdrawalIdStatement.all(withdrawal.id);

    for (const request of linkedRequests) {
      createServiceRequestEvent(request.id, {
        actorRole: "system",
        kind: nextStatus === "DONE" ? "withdrawal-done" : "withdrawal-updated",
        title:
          nextStatus === "DONE"
            ? "Repasse enviado ao(à) profissional"
            : "Saque da carteira atualizado",
        description:
          nextStatus === "DONE"
            ? "O saque Pix deste atendimento foi concluído para a chave do(a) profissional."
            : `Status do saque atualizado para ${nextStatus}.`,
      });
    }
  }

  return selectWorkerWithdrawalByProviderIdStatement.get(providerTransferId);
}

export function isPixWithdrawalReadyForUser(userId) {
  const user = selectUserByIdStatement.get(userId);

  if (!user) {
    throw new HttpError(404, "Usuário(a) não encontrado(a).");
  }

  return doesStoredPixCpfMatchUser(
    user.pix_withdrawal_key_type,
    user.pix_withdrawal_key,
    user.cpf_digits
  );
}

export async function createAsaasPaymentForServiceRequest(userId, requestId) {
  const requestRow = selectServiceRequestPaymentStatement.get(requestId);

  if (!requestRow || requestRow.requester_user_id !== userId) {
    throw new HttpError(404, "Atendimento não encontrado para pagamento.");
  }

  if (requestRow.status !== "payment") {
    throw new HttpError(409, "Este atendimento ainda não está pronto para pagamento.");
  }

  ensureWorkerPixKeyReadyFromRow(requestRow);

  const details = parseServiceDetails(requestRow.service_details_json);
  const subtotalCents = parseCurrencyToCents(details?.price);
  const agreementTitle =
    typeof details?.title === "string" && details.title.trim()
      ? details.title.trim().replace(/\s+/g, " ").slice(0, 120)
      : requestRow.description;

  if (subtotalCents <= 0) {
    throw new HttpError(409, "O valor do atendimento ainda não foi definido corretamente.");
  }

  const feeCents = calculatePlatformFeeCents(subtotalCents);
  const totalCents = subtotalCents + feeCents;

  if (
    requestRow.asaas_payment_id &&
    !isPaidAsaasStatus(requestRow.asaas_payment_status) &&
    requestRow.asaas_payment_copy_paste &&
    !isPaymentSessionExpired(requestRow)
  ) {
    return {
      paymentId: requestRow.asaas_payment_id,
      paymentStatus: requestRow.asaas_payment_status ?? "PENDING",
      invoiceUrl: requestRow.asaas_payment_invoice_url ?? null,
      dueDate: requestRow.asaas_payment_due_date ?? null,
      pixCopyPaste: requestRow.asaas_payment_copy_paste ?? null,
      pixQrCodeBase64: requestRow.asaas_payment_qr_code_base64 ?? null,
      expiresAt: requestRow.asaas_payment_expires_at ?? null,
    };
  }

  if (
    requestRow.asaas_payment_id &&
    !isPaidAsaasStatus(requestRow.asaas_payment_status) &&
    isPaymentSessionExpired(requestRow)
  ) {
    try {
      await asaasRequest(`/payments/${requestRow.asaas_payment_id}`, {
        method: "DELETE",
      });
    } catch {
      // Se a cobrança antiga já não puder ser removida, seguimos criando uma nova sessão.
    }

    clearServiceRequestPaymentSessionStatement.run(nowIso(), requestId);
  }

  const customerId = await ensureAsaasCustomerForUser(userId);
  const payment = await asaasRequest("/payments", {
    method: "POST",
    body: {
      customer: customerId,
      billingType: "PIX",
      value: Number((totalCents / 100).toFixed(2)),
      dueDate: toDateOnly(new Date()),
      description: `${requestRow.category} via Worko - ${agreementTitle}`.slice(0, 255),
      externalReference: requestId,
    },
  });

  if (!payment?.id) {
    throw new HttpError(502, "O Asaas não retornou uma cobrança Pix válida para este pedido.");
  }

  const qrCode = await fetchPixQrCode(payment.id);

  updateServiceRequestAsaasPaymentStatement.run(
    payment.id,
    String(payment.status ?? "PENDING").trim().toUpperCase(),
    payment.invoiceUrl ?? null,
    payment.dueDate ?? null,
    qrCode.expirationDate,
    qrCode.copyPaste,
    qrCode.qrCodeBase64,
    null,
    subtotalCents,
    feeCents,
    totalCents,
    String(payment.currency ?? "brl").toLowerCase(),
    nowIso(),
    requestId
  );

  return {
    paymentId: payment.id,
    paymentStatus: String(payment.status ?? "PENDING").trim().toUpperCase(),
    invoiceUrl: payment.invoiceUrl ?? null,
    dueDate: payment.dueDate ?? null,
    pixCopyPaste: qrCode.copyPaste,
    pixQrCodeBase64: qrCode.qrCodeBase64,
    expiresAt: qrCode.expirationDate ?? null,
  };
}

export async function refreshAsaasPaymentForServiceRequest(userId, requestId) {
  const requestRow = selectServiceRequestPaymentStatement.get(requestId);

  if (!requestRow || requestRow.requester_user_id !== userId) {
    throw new HttpError(404, "Atendimento não encontrado.");
  }

  if (!requestRow.asaas_payment_id) {
    throw new HttpError(409, "Ainda não existe uma cobrança Pix vinculada a este pedido.");
  }

  const payment = await asaasRequest(`/payments/${requestRow.asaas_payment_id}`);
  const paymentStatus = String(payment?.status ?? "").trim().toUpperCase();
  let qrCode = null;

  if (!isPaidAsaasStatus(paymentStatus)) {
    try {
      qrCode = await fetchPixQrCode(requestRow.asaas_payment_id);
    } catch {
      qrCode = null;
    }
  }

  syncServiceRequestPaymentFromAsaasPayment(requestId, payment, qrCode);

  return {
    paymentId: requestRow.asaas_payment_id,
    paymentStatus,
    status: paymentStatus,
    invoiceUrl: payment?.invoiceUrl ?? requestRow.asaas_payment_invoice_url ?? null,
    dueDate: payment?.dueDate ?? requestRow.asaas_payment_due_date ?? null,
    pixCopyPaste: qrCode?.copyPaste ?? requestRow.asaas_payment_copy_paste ?? null,
    pixQrCodeBase64: qrCode?.qrCodeBase64 ?? requestRow.asaas_payment_qr_code_base64 ?? null,
    expiresAt: qrCode?.expirationDate ?? requestRow.asaas_payment_expires_at ?? null,
  };
}

export async function cancelAsaasPendingPaymentForServiceRequest(requestId) {
  const requestRow = selectServiceRequestPaymentStatement.get(requestId);

  if (!requestRow?.asaas_payment_id) {
    return { ok: true, cancelled: false };
  }

  const payment = await asaasRequest(`/payments/${requestRow.asaas_payment_id}`);
  const paymentStatus = String(payment?.status ?? "").trim().toUpperCase();

  syncServiceRequestPaymentFromAsaasPayment(requestId, payment);

  if (isPaidAsaasPayment(payment)) {
    throw new HttpError(
      409,
      "Este Pix já foi confirmado. O pedido não pode mais ser cancelado."
    );
  }

  await asaasRequest(`/payments/${requestRow.asaas_payment_id}`, {
    method: "DELETE",
  });

  clearServiceRequestPaymentSessionStatement.run(nowIso(), requestId);

  return { ok: true, cancelled: true };
}

export async function refundAsaasPaymentForServiceRequest(requestId) {
  const requestRow = selectServiceRequestPaymentStatement.get(requestId);

  if (!requestRow?.asaas_payment_id) {
    throw new HttpError(409, "Não existe cobrança Pix vinculada a este atendimento.");
  }

  const payment = await asaasRequest(`/payments/${requestRow.asaas_payment_id}`);
  const paymentStatus = String(payment?.status ?? "").trim().toUpperCase();

  if (!isPaidAsaasPayment(payment)) {
    throw new HttpError(409, "O Pix deste atendimento ainda não foi confirmado.");
  }

  await asaasRequest(`/payments/${requestRow.asaas_payment_id}/refund`, {
    method: "POST",
  });

  updateServiceRequestRefundStateStatement.run("REFUNDED", nowIso(), requestId);

  return { ok: true, refunded: true };
}

export function clearAsaasPaymentSessionForServiceRequest(requestId) {
  clearServiceRequestPaymentSessionStatement.run(nowIso(), requestId);
}

export async function processAsaasWebhookPayload(payload, headerToken) {
  ensureWebhookToken(headerToken);

  if (!payload || typeof payload !== "object") {
    throw new HttpError(400, "Payload do webhook Asaas inválido.");
  }

  if (payload.type === "TRANSFER" && payload.transfer?.id) {
    const syncedTransfer = await syncWorkerWithdrawalFromTransfer(payload.transfer);

    return {
      kind: "transfer-validation",
      response: {
        status: syncedTransfer ? "APPROVED" : "REFUSED",
      },
    };
  }

  const eventId = getWebhookEventId(payload);
  const eventType = String(payload.event ?? payload.type ?? "asaas.unknown");

  if (hasProcessedAsaasWebhookEvent(eventId)) {
    return {
      kind: "event",
      response: { received: true, duplicaté: true },
    };
  }

  if (payload.payment && typeof payload.payment === "object") {
    const serviceRequest = resolveServiceRequestForAsaasPayment(payload.payment);

    if (serviceRequest) {
      syncServiceRequestPaymentFromAsaasPayment(serviceRequest.id, payload.payment);
    } else {
      console.warn("Asaas payment webhook without matching service request", {
        eventId,
        eventType,
        paymentId: String(payload.payment.id ?? "").trim() || null,
        externalReference: String(payload.payment.externalReference ?? "").trim() || null,
        paymentStatus: String(payload.payment.status ?? "").trim().toUpperCase() || null,
      });
    }
  }

  if (payload.transfer?.id) {
    await syncWorkerWithdrawalFromTransfer(payload.transfer);
  }

  markAsaasWebhookEventProcessed(eventId, eventType);

  return {
    kind: "event",
    response: { received: true },
  };
}

export async function getAsaasWalletSummaryForUser(userId) {
  const user = selectUserByIdStatement.get(userId);

  if (!user) {
    throw new HttpError(404, "Usuário(a) não encontrado(a).");
  }

  const pixKeyMatchesCpf = doesStoredPixCpfMatchUser(
    user.pix_withdrawal_key_type,
    user.pix_withdrawal_key,
    user.cpf_digits
  );
  const recentWithdrawals = [];

  for (const row of selectRecentWithdrawalsByUserStatement.all(userId)) {
    const refreshedRow = await refreshTransferStatusIfNeeded(row);
    recentWithdrawals.push(mapWithdrawalRecord(refreshedRow));
  }

  const entries = selectWorkerWalletEntriesStatement.all(userId).map((row) => {
    const netAmountCents = resolveWalletEntryNetAmountCents(row);
    const feeAmountCents = resolveWalletEntryFeeAmountCents(row, netAmountCents);
    const storedGrossAmountCents = normalizeStoredAmountCents(row.payment_amount_total_cents);
    const grossAmountCents =
      storedGrossAmountCents !== null ? storedGrossAmountCents : netAmountCents + feeAmountCents;

    return {
      id: row.id,
      type: row.category,
      description: row.description,
      requesterName: row.requester_name ?? "Cliente",
      netAmountCents,
      feeAmountCents,
      grossAmountCents,
      status: resolveWalletEntryStatus(row),
      createdAt: row.created_at ?? nowIso(),
      updatedAt: row.updated_at ?? row.created_at ?? nowIso(),
      releasedAt: row.worker_withdrawn_at ?? null,
      freeWithdrawalAvailableAt: getFreeWithdrawalAvailableAt(row),
    };
  });

  const awaitingClientPaymentCents = entries.reduce(
    (total, entry) =>
      entry.status === "awaiting-client-payment" ? total + entry.netAmountCents : total,
    0
  );
  const heldForServiceCents = entries.reduce(
    (total, entry) =>
      entry.status === "held-for-service" ? total + entry.netAmountCents : total,
    0
  );
  const availableToWithdrawCents = entries.reduce(
    (total, entry) =>
      entry.status === "available-for-withdrawal" ? total + entry.netAmountCents : total,
    0
  );
  const candidateRequests = selectAvailableCompletedRequestsForWithdrawalStatement.all(userId);
  const standardCandidateRequests = candidateRequests.filter(isStandardWithdrawalEligible);
  const availableForStandardWithdrawalCents = standardCandidateRequests.reduce(
    (total, row) => total + resolveRequestWithdrawalAmountCents(row),
    0
  );
  const processingWithdrawalsCents = recentWithdrawals.reduce(
    (total, withdrawal) =>
      ASAAS_PENDING_TRANSFER_STATUSES.has(withdrawal.status)
        ? total + withdrawal.amountCents
        : total,
    0
  );
  const providerBalance = await fetchAsaasAccountBalanceSnapshot();
  const providerAvailableBalanceCents = providerBalance.balanceCents;
  const instantSelection = selectRequestsWithinProviderBalance(
    candidateRequests,
    providerAvailableBalanceCents ?? Number.POSITIVE_INFINITY
  );
  const standardSelection = selectRequestsWithinProviderBalance(
    standardCandidateRequests,
    providerAvailableBalanceCents ?? Number.POSITIVE_INFINITY
  );
  const instantAvailableNowCents = instantSelection.totalCents;
  const standardAvailableNowCents = standardSelection.totalCents;
  const nextFreeWithdrawalAvailableAt =
    candidateRequests
      .map(getFreeWithdrawalAvailableAt)
      .filter(Boolean)
      .filter((value) => new Date(value).getTime() > Date.now())
      .sort()[0] ?? null;
  const providerBalanceShortfallCents =
    providerAvailableBalanceCents === null
      ? 0
      : Math.max(availableToWithdrawCents - instantAvailableNowCents, 0);
  const providerBalanceMessage =
    providerAvailableBalanceCents === null
      ? "Não foi possível sincronizar o saldo real da conta Asaas agora. O app segue mostrando o saldo interno."
      : providerBalanceShortfallCents > 0
        ? "Parte do saldo interno ainda não entrou como saldo disponível na conta Asaas. Por issó o valor sacável agora pode estar menor."
        : null;

  return {
    hasPixKeyConfigured: Boolean(user.pix_withdrawal_key_type && user.pix_withdrawal_key),
    canReceivePixTransfers: pixKeyMatchesCpf,
    pixKeyMatchesCpf,
    pixKeyType: user.pix_withdrawal_key_type ?? null,
    pixKey: user.pix_withdrawal_key ?? "",
    awaitingClientPaymentCents,
    heldForServiceCents,
    availableToWithdrawCents,
    availableForStandardWithdrawalCents,
    instantWithdrawalFeeCents: INSTANT_WITHDRAWAL_FEE_CENTS,
    providerAvailableBalanceCents,
    instantAvailableNowCents,
    standardAvailableNowCents,
    nextFreeWithdrawalAvailableAt,
    providerBalanceShortfallCents,
    providerBalanceMessage,
    providerBalanceSyncedAt: providerBalance.syncedAt,
    processingWithdrawalsCents,
    recentEntries: entries,
    recentWithdrawals,
  };
}

export function notifyFreeWithdrawalAvailability() {
  const candidates = selectFreeWithdrawalNotificationCandidatesStatement.all();

  for (const candidate of candidates) {
    if (!candidate?.worker_user_id || !isStandardWithdrawalEligible(candidate)) {
      continue;
    }

    createUserNotification(
      candidate.worker_user_id,
      "wallet-free-ready",
      `${getNotificationFirstName(candidate.requester_name, "Cliente")} já liberou um valor que pode ser sacado sem taxa.`,
      {
        title: "Saque grátis liberado",
        serviceRequestId: candidate.id,
      },
      {
        id: `wallet-free-ready:${candidate.id}`,
      }
    );
  }
}

export async function createPixWithdrawalForUser(userId, options = {}) {
  const user = selectUserByIdStatement.get(userId);

  if (!user) {
    throw new HttpError(404, "Usuário(a) não encontrado(a).");
  }

  if (!user.pix_withdrawal_key_type || !user.pix_withdrawal_key) {
    throw new HttpError(
      409,
      "Cadastre primeiro sua chave Pix no perfil antes de pedir um saque."
    );
  }

  if (!doesStoredPixCpfMatchUser(user.pix_withdrawal_key_type, user.pix_withdrawal_key, user.cpf_digits)) {
    throw new HttpError(
      409,
      "Use uma chave Pix CPF que seja do mesmo CPF cadastrado no seu perfil para liberar saques."
    );
  }

  const mode = String(options.mode ?? "instant").trim().toLowerCase() === "standard"
    ? "standard"
    : "instant";
  const candidateRequests = selectAvailableCompletedRequestsForWithdrawalStatement.all(userId);
  const availableRequests =
    mode === "standard"
      ? candidateRequests.filter(isStandardWithdrawalEligible)
      : candidateRequests;

  if (availableRequests.length === 0) {
    throw new HttpError(
      409,
      mode === "standard"
        ? "Ainda não existe saldo liberado para saque grátis. Ele fica disponível 24 horas depois que o valor cair na carteira."
        : "Não existe saldo liberado para saque agora."
    );
  }

  const providerBalance = await fetchAsaasAccountBalanceSnapshot();
  const providerLimitedSelection = selectRequestsWithinProviderBalance(
    availableRequests,
    providerBalance.balanceCents ?? Number.POSITIVE_INFINITY
  );
  const withdrawableRequests = providerLimitedSelection.requestRows;
  const grossAmountCents = providerLimitedSelection.totalCents;

  if (grossAmountCents <= 0) {
    throw new HttpError(
      409,
      providerBalance.balanceCents !== null
        ? "O saldo real da conta Asaas ainda não cobre nenhum saque disponível. Aguarde a compensação e tente novamente."
        : "O saldo liberado para saque ainda está zerado."
    );
  }

  const feeAmountCents = mode === "instant" ? INSTANT_WITHDRAWAL_FEE_CENTS : 0;
  const amountCents = grossAmountCents - feeAmountCents;

  if (amountCents <= 0) {
    throw new HttpError(
      409,
      "O saldo atual ainda não cobre a taxa do saque imediato. Aguarde mais saldo ou use o saque grátis 24 horas depois que o valor cair na carteira."
    );
  }

  const transfer = await asaasRequest("/transfers", {
    method: "POST",
    body: {
      value: Number((amountCents / 100).toFixed(2)),
      operationType: "PIX",
      pixAddressKeyType: user.pix_withdrawal_key_type,
      pixAddressKey: user.pix_withdrawal_key,
      description: `Repasse Worko ${toDateOnly(new Date())}`,
    },
  });

  if (!transfer?.id) {
    throw new HttpError(502, "O Asaas não retornou uma transferência Pix válida.");
  }

  const withdrawalId = createId();
  const transferStatus = String(transfer.status ?? "PENDING").trim().toUpperCase();
  const timestamp = nowIso();

  db.exec("BEGIN");

  try {
    insertWorkerWithdrawalStatement.run(
      withdrawalId,
      userId,
      transfer.id,
      mode,
      grossAmountCents,
      feeAmountCents,
      amountCents,
      "brl",
      transferStatus,
      user.pix_withdrawal_key_type,
      user.pix_withdrawal_key,
      `${
        mode === "instant" ? "Saque imediato" : "Saque grátis após 24 horas"
      } do Worko para ${maskPixKey(user.pix_withdrawal_key_type, user.pix_withdrawal_key)}`,
      timestamp,
      timestamp
    );

    for (const requestRow of withdrawableRequests) {
      attachWithdrawalToServiceRequestStatement.run(
        withdrawalId,
        transferStatus === "DONE" ? timestamp : null,
        timestamp,
        requestRow.id
      );

      createServiceRequestEvent(requestRow.id, {
        actorUserId: userId,
        actorRole: "worker",
        kind: "withdrawal-requested",
        title: "Saque solicitado",
        description: "O(a) profissional enviou o saldo deste atendimento para saque na chave Pix cadastrada.",
      });
    }

    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }

  return {
    withdrawal: mapWithdrawalRecord(
      selectWorkerWithdrawalByProviderIdStatement.get(transfer.id)
    ),
  };
}


