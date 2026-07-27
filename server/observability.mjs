import { db } from "./db.mjs";
import { config, isCpfVerificationConfigured, isEmailConfigured } from "./config.mjs";
import { isPushNotificationAvailable } from "./push-notifications.mjs";
import { createId, nowIso } from "./security.mjs";

const SERVICE_STARTED_AT = Date.now();
const MAX_RECENT_ERRORS = 20;

let totalRequests = 0;
let totalServerErrors = 0;
let totalClientReports = 0;
let lastRequestAt = null;
let lastServerErrorAt = null;
const recentErrors = [];

const insertClientErrorReportStatement = db.prepare(
  `
    INSERT INTO client_error_reports (
      id,
      request_id,
      user_id,
      source,
      message,
      stack,
      path,
      user_agent,
      metadata_json,
      created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `
);

const countClientErrorReportsStatement = db.prepare(
  `
    SELECT COUNT(*) AS total
    FROM client_error_reports
  `
);

function normalizeText(value, maxLength = 500) {
  return String(value ?? "").trim().slice(0, maxLength);
}

function serializeError(error) {
  if (error instanceof Error) {
    return {
      name: normalizeText(error.name, 120) || "Error",
      message: normalizeText(error.message, 600) || "Erro sem mensagem.",
      stack: normalizeText(error.stack, 6000) || null,
    };
  }

  const message = normalizeText(error, 600) || "Erro desconhecido.";
  return {
    name: "UnknownError",
    message,
    stack: null,
  };
}

function pushRecentError(entry) {
  recentErrors.unshift(entry);

  if (recentErrors.length > MAX_RECENT_ERRORS) {
    recentErrors.length = MAX_RECENT_ERRORS;
  }
}

export function beginObservedRequest({ requestId, method, pathname }) {
  totalRequests += 1;
  lastRequestAt = nowIso();

  return {
    requestId,
    method: normalizeText(method, 16),
    pathname: normalizeText(pathname, 200),
    startedAt: Date.now(),
  };
}

export function recordServerError(context, error, extra = {}) {
  totalServerErrors += 1;
  lastServerErrorAt = nowIso();

  const serialized = serializeError(error);
  const errorId = createId();

  pushRecentError({
    id: errorId,
    type: "server",
    createdAt: lastServerErrorAt,
    requestId: context?.requestId ?? null,
    method: context?.method ?? null,
    pathname: context?.pathname ?? null,
    message: serialized.message,
    name: serialized.name,
    statusCode: Number(extra.statusCode) || null,
  });

  return {
    errorId,
    message: serialized.message,
    name: serialized.name,
  };
}

export function recordBackgroundJobFailure(jobName, error) {
  const serialized = serializeError(error);

  totalServerErrors += 1;
  lastServerErrorAt = nowIso();

  pushRecentError({
    id: createId(),
    type: "background-job",
    createdAt: lastServerErrorAt,
    requestId: null,
    method: null,
    pathname: normalizeText(jobName, 120),
    message: serialized.message,
    name: serialized.name,
    statusCode: null,
  });
}

export function storeClientErrorReport(payload, context = {}) {
  const createdAt = nowIso();
  const reportId = createId();
  const message = normalizeText(payload?.message, 1200);

  if (!message) {
    return { stored: false, id: null };
  }

  insertClientErrorReportStatement.run(
    reportId,
    normalizeText(context.requestId, 120) || null,
    normalizeText(context.userId, 120) || null,
    normalizeText(payload?.source, 80) || "web",
    message,
    normalizeText(payload?.stack, 6000) || null,
    normalizeText(payload?.path, 300) || null,
    normalizeText(payload?.userAgent, 500) || null,
    JSON.stringify(
      payload?.metadata && typeof payload.metadata === "object" && !Array.isArray(payload.metadata)
        ? payload.metadata
        : {}
    ),
    createdAt
  );

  totalClientReports += 1;

  pushRecentError({
    id: reportId,
    type: "client",
    createdAt,
    requestId: normalizeText(context.requestId, 120) || null,
    method: null,
    pathname: normalizeText(payload?.path, 300) || null,
    message,
    name: normalizeText(payload?.name, 120) || "ClientError",
    statusCode: null,
  });

  return { stored: true, id: reportId };
}

export function buildHealthSnapshot() {
  const clientReportsStored = Number(countClientErrorReportsStatement.get()?.total ?? 0);
  const uptimeSeconds = Math.max(0, Math.round((Date.now() - SERVICE_STARTED_AT) / 1000));
  const errorRate = totalRequests > 0 ? Number((totalServerErrors / totalRequests).toFixed(4)) : 0;

  return {
    ok: true,
    service: "worqo-auth",
    time: nowIso(),
    uptimeSeconds,
    release: {
      backend: config.backendRelease || null,
      requiredClientRelease: config.requiredClientRelease || null,
    },
    support: {
      email: config.support.email || null,
      whatsapp: config.support.whatsapp || null,
    },
    integrations: {
      asaasConfigured: Boolean(config.asaas.apiKey),
      mapsConfigured: Boolean(config.googleMapsApiKey),
      emailConfigured: isEmailConfigured(),
      fcmConfigured: isPushNotificationAvailable(),
      cpfProvider: config.cpfVerification.provider || null,
      cpfConfigured: isCpfVerificationConfigured(),
    },
    metrics: {
      totalRequests,
      totalServerErrors,
      totalClientReports,
      clientReportsStored,
      errorRate,
      lastRequestAt,
      lastServerErrorAt,
      recentErrors: recentErrors.slice(0, 8),
    },
  };
}
