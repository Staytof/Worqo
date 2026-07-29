import { db } from "./db.mjs";
import { isAdminEmail } from "./config.mjs";
import { HttpError } from "./utils.mjs";

const LIVE_REQUEST_STATUSES = new Set([
  "searching",
  "assigned",
  "chatting",
  "details",
  "waiting-worker",
  "payment",
  "confirmed",
]);
const OPEN_MAP_REQUEST_STATUSES = new Set(["searching", "assigned"]);
const PAID_STATUSES = new Set(["RECEIVED", "CONFIRMED"]);
const PENDING_WITHDRAWAL_STATUSES = new Set([
  "PENDING",
  "BANK_PROCESSING",
  "AWAITING_AUTORIZATION",
  "AWAITING_AUTHORIZATION",
]);
const RECENT_SIGNUP_WINDOW_DAYS = 7;
const RECENT_ACTIVE_WINDOW_HOURS = 24;

const selectAdminRequestRowsStatement = db.prepare(`
  SELECT
    service_requests.*,
    requester.full_name AS requester_name,
    requester.email AS requester_email,
    worker.full_name AS worker_name,
    worker.email AS worker_email
  FROM service_requests
  INNER JOIN users AS requester ON requester.id = service_requests.requester_user_id
  LEFT JOIN users AS worker ON worker.id = service_requests.worker_user_id
  ORDER BY service_requests.updated_at DESC, service_requests.created_at DESC
`);

const selectRequestStatusCountsStatement = db.prepare(`
  SELECT status, COUNT(*) AS total
  FROM service_requests
  GROUP BY status
  ORDER BY total DESC, status ASC
`);

const selectAllWithdrawalsStatement = db.prepare(`
  SELECT
    worker_withdrawals.*,
    users.full_name AS user_name,
    users.email AS user_email
  FROM worker_withdrawals
  INNER JOIN users ON users.id = worker_withdrawals.user_id
  ORDER BY worker_withdrawals.created_at DESC
`);

const selectTimelineByRequestIdStatement = db.prepare(`
  SELECT *
  FROM service_request_events
  WHERE service_request_id = ?
  ORDER BY created_at ASC
`);

const selectAdminUserRowsStatement = db.prepare(`
  SELECT
    users.id,
    users.full_name,
    users.email,
    users.phone,
    users.avatar,
    users.headline,
    users.created_at,
    users.updated_at,
    users.last_active_at,
    users.verified_channel,
    users.email_verified_at,
    users.cpf_verified_at,
    users.profile_setup_completed_at,
    users.pix_withdrawal_key_type,
    users.pix_withdrawal_key,
    users.admin_flagged_at,
    users.admin_flag_reason,
    users.suspended_at,
    users.suspension_reason,
    (
      SELECT COUNT(*)
      FROM service_requests
      WHERE requester_user_id = users.id
    ) AS requests_created_count,
    (
      SELECT COUNT(*)
      FROM service_requests
      WHERE worker_user_id = users.id
    ) AS jobs_taken_count,
    (
      SELECT COUNT(*)
      FROM service_requests
      WHERE worker_user_id = users.id
        AND status = 'completed'
    ) AS completed_services_count,
    (
      SELECT COUNT(*)
      FROM support_tickets
      WHERE requester_user_id = users.id
        AND status IN ('waiting', 'active')
    ) AS open_support_tickets,
    (
      SELECT COUNT(*)
      FROM service_requests
      WHERE (requester_user_id = users.id OR worker_user_id = users.id)
        AND status IN ('searching', 'assigned', 'chatting', 'details', 'waiting-worker', 'payment', 'confirmed')
    ) AS active_service_flows
  FROM users
  ORDER BY users.created_at DESC, users.updated_at DESC
`);

const selectSupportOverviewStatement = db.prepare(`
  SELECT
    COUNT(*) AS total_tickets,
    SUM(CASE WHEN status = 'waiting' THEN 1 ELSE 0 END) AS waiting_tickets,
    SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) AS active_tickets,
    SUM(CASE WHEN status = 'closed' THEN 1 ELSE 0 END) AS closed_tickets,
    MAX(created_at) AS latest_opened_at,
    MAX(last_customer_message_at) AS latest_customer_message_at
  FROM support_tickets
`);

function isRecentWithinDays(value, days) {
  if (!value) {
    return false;
  }

  const timestamp = new Date(value).getTime();

  if (Number.isNaN(timestamp)) {
    return false;
  }

  return Date.now() - timestamp <= days * 24 * 60 * 60 * 1000;
}

function isRecentWithinHours(value, hours) {
  if (!value) {
    return false;
  }

  const timestamp = new Date(value).getTime();

  if (Number.isNaN(timestamp)) {
    return false;
  }

  return Date.now() - timestamp <= hours * 60 * 60 * 1000;
}

function mapDispute(row) {
  const status = String(row.dispute_status ?? "").trim().toLowerCase();

  if (!status) {
    return null;
  }

  return {
    status:
      status === "open" || status === "resolved" || status === "refunded" ? status : null,
    reason: row.dispute_reason ?? "",
    openedAt: row.disputed_at ?? null,
    openedByUserId: row.disputed_by_user_id ?? null,
    resolution: row.dispute_resolution ?? null,
    resolvedAt: row.dispute_resolved_at ?? null,
    adminNote: row.dispute_admin_note ?? null,
  };
}

function mapTimelineEvent(row) {
  return {
    id: row.id,
    kind: row.event_kind,
    actorRole: row.actor_role,
    title: row.title,
    description: row.description,
    createdAt: row.created_at,
  };
}

function parseAgreementTitle(value) {
  if (!value) {
    return "";
  }

  try {
    const parsed = JSON.parse(value);
    return typeof parsed?.title === "string"
      ? parsed.title.trim().replace(/\s+/g, " ").slice(0, 80)
      : "";
  } catch {
    return "";
  }
}

function mapWithdrawal(row) {
  return {
    id: row.id,
    userId: row.user_id,
    userName: row.user_name ?? "Profissional",
    userEmail: row.user_email ?? "",
    providerTransferId: row.provider_transfer_id,
    mode: row.mode ?? "instant",
    grossAmountCents: Number(row.gross_amount_cents) || 0,
    feeAmountCents: Number(row.fee_amount_cents) || 0,
    amountCents: Number(row.amount_cents) || 0,
    currency: row.currency ?? "brl",
    status: String(row.status ?? "").trim().toUpperCase(),
    pixKeyType: row.pix_key_type ?? null,
    pixKeyMasked: row.pix_key ?? "",
    description: row.description ?? "",
    createdAt: row.created_at ?? "",
    updatedAt: row.updated_at ?? "",
  };
}

function mapUser(row) {
  return {
    id: row.id,
    fullName: row.full_name,
    email: row.email,
    phone: row.phone,
    avatar: row.avatar ?? null,
    headline: row.headline ?? "",
    createdAt: row.created_at ?? "",
    updatedAt: row.updated_at ?? "",
    lastActiveAt: row.last_active_at ?? null,
    verifiedChannel: row.verified_channel ?? null,
    emailVerifiedAt: row.email_verified_at ?? null,
    cpfVerifiedAt: row.cpf_verified_at ?? null,
    profileCompletedAt: row.profile_setup_completed_at ?? null,
    hasPixKeyConfigured: Boolean(row.pix_withdrawal_key_type && row.pix_withdrawal_key),
    isAdmin: isAdminEmail(row.email),
    isFlagged: Boolean(row.admin_flagged_at),
    flaggedAt: row.admin_flagged_at ?? null,
    flagReason: row.admin_flag_reason ?? null,
    isSuspended: Boolean(row.suspended_at),
    suspendedAt: row.suspended_at ?? null,
    suspensionReason: row.suspension_reason ?? null,
    requestsCreatedCount: Number(row.requests_created_count) || 0,
    jobsTakenCount: Number(row.jobs_taken_count) || 0,
    completedServicesCount: Number(row.completed_services_count) || 0,
    openSupportTickets: Number(row.open_support_tickets) || 0,
    activeServiceFlows: Number(row.active_service_flows) || 0,
  };
}

const updateUserAdminStateStatement = db.prepare(`
  UPDATE users
  SET
    admin_flagged_at = ?,
    admin_flag_reason = ?,
    suspended_at = ?,
    suspension_reason = ?,
    updated_at = ?
  WHERE id = ?
`);

const selectAdminUserRowByIdStatement = db.prepare(`
  SELECT
    users.id,
    users.full_name,
    users.email,
    users.phone,
    users.avatar,
    users.headline,
    users.created_at,
    users.updated_at,
    users.last_active_at,
    users.verified_channel,
    users.email_verified_at,
    users.cpf_verified_at,
    users.profile_setup_completed_at,
    users.pix_withdrawal_key_type,
    users.pix_withdrawal_key,
    users.admin_flagged_at,
    users.admin_flag_reason,
    users.suspended_at,
    users.suspension_reason,
    (
      SELECT COUNT(*)
      FROM service_requests
      WHERE requester_user_id = users.id
    ) AS requests_created_count,
    (
      SELECT COUNT(*)
      FROM service_requests
      WHERE worker_user_id = users.id
    ) AS jobs_taken_count,
    (
      SELECT COUNT(*)
      FROM service_requests
      WHERE worker_user_id = users.id
        AND status = 'completed'
    ) AS completed_services_count,
    (
      SELECT COUNT(*)
      FROM support_tickets
      WHERE requester_user_id = users.id
        AND status IN ('waiting', 'active')
    ) AS open_support_tickets,
    (
      SELECT COUNT(*)
      FROM service_requests
      WHERE (requester_user_id = users.id OR worker_user_id = users.id)
        AND status IN ('searching', 'assigned', 'chatting', 'details', 'waiting-worker', 'payment', 'confirmed')
    ) AS active_service_flows
  FROM users
  WHERE users.id = ?
  LIMIT 1
`);

function buildOverview(requestRows, withdrawals, users, supportOverviewRow) {
  const grossVolumeCents = requestRows.reduce((total, row) => {
    const paymentStatus = String(row.asaas_payment_status ?? "").trim().toUpperCase();
    return PAID_STATUSES.has(paymentStatus)
      ? total + (Number(row.payment_amount_total_cents) || 0)
      : total;
  }, 0);

  const feeVolumeCents = requestRows.reduce((total, row) => {
    const paymentStatus = String(row.asaas_payment_status ?? "").trim().toUpperCase();
    return PAID_STATUSES.has(paymentStatus)
      ? total + (Number(row.payment_amount_fee_cents) || 0)
      : total;
  }, 0);

  return {
    totalUsers: users.length,
    newUsers7d: users.filter((user) => isRecentWithinDays(user.createdAt, RECENT_SIGNUP_WINDOW_DAYS))
      .length,
    verifiedUsers: users.filter((user) => Boolean(user.cpfVerifiedAt)).length,
    emailVerifiedUsers: users.filter((user) => Boolean(user.emailVerifiedAt)).length,
    profileCompletedUsers: users.filter((user) => Boolean(user.profileCompletedAt)).length,
    activeUsers24h: users.filter((user) => isRecentWithinHours(user.lastActiveAt, RECENT_ACTIVE_WINDOW_HOURS))
      .length,
    openRequests: requestRows.filter((row) => LIVE_REQUEST_STATUSES.has(row.status)).length,
    openMapRequests: requestRows.filter((row) => OPEN_MAP_REQUEST_STATUSES.has(row.status)).length,
    confirmedServices: requestRows.filter((row) => row.status === "confirmed").length,
    openDisputes: requestRows.filter(
      (row) => String(row.dispute_status ?? "").trim().toLowerCase() === "open"
    ).length,
    supportOpenTickets:
      (Number(supportOverviewRow.waiting_tickets) || 0) +
      (Number(supportOverviewRow.active_tickets) || 0),
    pendingWithdrawals: withdrawals.filter((withdrawal) =>
      PENDING_WITHDRAWAL_STATUSES.has(withdrawal.status)
    ).length,
    grossVolumeCents,
    feeVolumeCents,
  };
}

export function getAdminDashboard() {
  const requestRows = selectAdminRequestRowsStatement.all();
  const requestStatusCounts = selectRequestStatusCountsStatement.all().map((row) => ({
    status: row.status,
    total: Number(row.total) || 0,
  }));
  const withdrawals = selectAllWithdrawalsStatement.all().map(mapWithdrawal);
  const users = selectAdminUserRowsStatement
    .all()
    .map(mapUser)
    .filter((user) => !user.isAdmin);
  const supportOverviewRow = selectSupportOverviewStatement.get() ?? {};

  return {
    overview: buildOverview(requestRows, withdrawals, users, supportOverviewRow),
    requestStatusCounts,
    requests: requestRows.map((row) => ({
      id: row.id,
      category: row.category,
      agreementTitle: parseAgreementTitle(row.service_details_json),
      description: row.description,
      status: row.status,
      requesterName: row.requester_name ?? "Cliente",
      requesterEmail: row.requester_email ?? "",
      workerName: row.worker_name ?? null,
      workerEmail: row.worker_email ?? null,
      latitude: Number(row.latitude) || 0,
      longitude: Number(row.longitude) || 0,
      accuracy: Number(row.accuracy) || null,
      locationLabel: row.location_label || null,
      createdAt: row.created_at ?? "",
      updatedAt: row.updated_at ?? "",
      subtotalCents: Number(row.payment_amount_subtotal_cents) || 0,
      feeCents: Number(row.payment_amount_fee_cents) || 0,
      totalCents: Number(row.payment_amount_total_cents) || 0,
      paymentStatus: row.asaas_payment_status ?? null,
      dispute: mapDispute(row),
      timeline: selectTimelineByRequestIdStatement.all(row.id).map(mapTimelineEvent),
    })),
    users,
    supportOverview: {
      totalTickets: Number(supportOverviewRow.total_tickets) || 0,
      waitingTickets: Number(supportOverviewRow.waiting_tickets) || 0,
      activeTickets: Number(supportOverviewRow.active_tickets) || 0,
      closedTickets: Number(supportOverviewRow.closed_tickets) || 0,
      latestOpenedAt: supportOverviewRow.latest_opened_at ?? null,
      latestCustomerMessageAt: supportOverviewRow.latest_customer_message_at ?? null,
    },
    withdrawals,
  };
}

export function updateAdminUserState(userId, { action, reason }) {
  const userRow = selectAdminUserRowByIdStatement.get(userId);

  if (!userRow) {
    throw new HttpError(404, "Usuário(a) não encontrado(a) para administração.");
  }

  if (isAdminEmail(userRow.email)) {
    throw new HttpError(409, "Não é permitido alterar o estado da conta administradora principal.");
  }

  const normalizedAction = String(action ?? "").trim().toLowerCase();
  const normalizedReason = String(reason ?? "").trim().slice(0, 240) || null;
  const timestamp = new Date().toISOString();

  let nextFlaggedAt = userRow.admin_flagged_at ?? null;
  let nextFlagReason = userRow.admin_flag_reason ?? null;
  let nextSuspendedAt = userRow.suspended_at ?? null;
  let nextSuspensionReason = userRow.suspension_reason ?? null;

  if (normalizedAction === "flag") {
    nextFlaggedAt = timestamp;
    nextFlagReason = normalizedReason;
  } else if (normalizedAction === "clear-flag") {
    nextFlaggedAt = null;
    nextFlagReason = null;
  } else if (normalizedAction === "suspend") {
    nextSuspendedAt = timestamp;
    nextSuspensionReason = normalizedReason;
  } else if (normalizedAction === "reinstate") {
    nextSuspendedAt = null;
    nextSuspensionReason = null;
  } else {
    throw new HttpError(400, "Ação administrativa inválida para este(a) usuário(a).");
  }

  updateUserAdminStateStatement.run(
    nextFlaggedAt,
    nextFlagReason,
    nextSuspendedAt,
    nextSuspensionReason,
    timestamp,
    userId
  );

  return mapUser(selectAdminUserRowByIdStatement.get(userId));
}

export function assertAdminUser(user) {
  if (!user?.isAdmin) {
    throw new HttpError(403, "Este acesso é restrito ao painel administrativo do Worko.");
  }
}


