import crypto from "node:crypto";
import fs from "node:fs";
import { db } from "./db.mjs";
import { config } from "./config.mjs";
import { createId, nowIso } from "./security.mjs";

const FCM_AUTH_SCOPE = "https://www.googleapis.com/auth/firebase.messaging";
const FCM_CHANNEL_ID = "worqo-general";
const ACCESS_TOKEN_REFRESH_BUFFER_MS = 60_000;
const TRANSIENT_RETRY_DELAYS_MS = [750, 2_000];
const METADATA_TOKEN_ENDPOINT =
  "http://metadata.google.internal/computeMetadata/v1/instance/service-accounts";

const selectActivePushDevicesByUserStatement = db.prepare(
  `
    SELECT
      id,
      token,
      platform,
      app_version,
      device_label,
      created_at,
      updated_at,
      disabled_at,
      last_attempt_at,
      last_success_at,
      last_error
    FROM user_push_devices
    WHERE user_id = ? AND disabled_at IS NULL
    ORDER BY updated_at DESC
    LIMIT 10
  `
);

const selectPushDeviceStatusByUserStatement = db.prepare(
  `
    SELECT
      id,
      platform,
      app_version,
      device_label,
      created_at,
      updated_at,
      disabled_at,
      last_attempt_at,
      last_success_at,
      last_error
    FROM user_push_devices
    WHERE user_id = ?
    ORDER BY updated_at DESC
    LIMIT 10
  `
);

const upsertPushDeviceStatement = db.prepare(
  `
    INSERT INTO user_push_devices (
      id,
      user_id,
      token,
      platform,
      app_version,
      device_label,
      created_at,
      updated_at,
      disabled_at,
      last_error
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, NULL, NULL)
    ON CONFLICT(token) DO UPDATE SET
      user_id = excluded.user_id,
      platform = excluded.platform,
      app_version = excluded.app_version,
      device_label = excluded.device_label,
      updated_at = excluded.updated_at,
      disabled_at = NULL,
      last_error = NULL
  `
);

const disablePushDeviceStatement = db.prepare(
  `
    UPDATE user_push_devices
    SET disabled_at = ?, updated_at = ?, last_error = ?
    WHERE token = ?
  `
);

const markPushDeviceErrorStatement = db.prepare(
  `
    UPDATE user_push_devices
    SET last_attempt_at = ?, last_error = ?
    WHERE token = ?
  `
);

const markPushDeviceSuccessStatement = db.prepare(
  `
    UPDATE user_push_devices
    SET last_attempt_at = ?, last_success_at = ?, last_error = NULL
    WHERE token = ?
  `
);

const deletePushDeviceStatement = db.prepare(
  `
    DELETE FROM user_push_devices
    WHERE user_id = ? AND token = ?
  `
);

let cachedAccessToken = "";
let cachedAccessTokenExpiresAt = 0;
let loggedMissingFcmConfig = false;
let lastFcmAuthenticationError = "";
let lastFcmAuthenticationAt = null;

function normalizeText(value) {
  return String(value ?? "").trim();
}

function normalizeDeviceToken(value) {
  return normalizeText(value).slice(0, 4096);
}

function resolveFcmCredentials() {
  if (config.fcm.serviceAccountFile) {
    try {
      const rawFile = fs.readFileSync(config.fcm.serviceAccountFile, "utf8");
      const parsed = JSON.parse(rawFile);

      return {
        clientEmail: normalizeText(parsed.client_email),
        privateKey: normalizeText(parsed.private_key),
        projectId: normalizeText(parsed.project_id || config.fcm.projectId),
      };
    } catch (error) {
      console.warn("Não foi possível ler FCM_SERVICE_ACCOUNT_FILE.", error);
    }
  }

  if (config.fcm.serviceAccountJson) {
    try {
      const parsed = JSON.parse(config.fcm.serviceAccountJson);

      return {
        clientEmail: normalizeText(parsed.client_email),
        privateKey: normalizeText(parsed.private_key),
        projectId: normalizeText(parsed.project_id || config.fcm.projectId),
      };
    } catch (error) {
      console.warn("Não foi possível ler FCM_SERVICE_ACCOUNT_JSON.", error);
    }
  }

  if (config.fcm.clientEmail && config.fcm.privateKey) {
    return {
      clientEmail: config.fcm.clientEmail,
      privateKey: config.fcm.privateKey,
      projectId: config.fcm.projectId,
    };
  }

  return null;
}

function encodeBase64Url(value) {
  return Buffer.from(value).toString("base64url");
}

function buildServiceAccountAssertion(credentials) {
  const issuedAt = Math.floor(Date.now() / 1000);
  const header = {
    alg: "RS256",
    typ: "JWT",
  };
  const payload = {
    iss: credentials.clientEmail,
    scope: FCM_AUTH_SCOPE,
    aud: "https://oauth2.googleapis.com/token",
    iat: issuedAt,
    exp: issuedAt + 3600,
  };
  const signingInput = `${encodeBase64Url(JSON.stringify(header))}.${encodeBase64Url(
    JSON.stringify(payload)
  )}`;
  const signer = crypto.createSign("RSA-SHA256");
  signer.update(signingInput);
  signer.end();
  const signature = signer.sign(credentials.privateKey).toString("base64url");
  return `${signingInput}.${signature}`;
}

async function requestServiceAccountAccessToken(credentials) {
  const assertion = buildServiceAccountAssertion(credentials);
  const body = new URLSearchParams({
    grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
    assertion,
  });
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
  });
  const data = await response.json().catch(() => null);

  if (!response.ok || !data?.access_token) {
    throw new Error(
      data?.error_description ||
        data?.error ||
        "Não foi possível autenticar no Google OAuth para enviar push."
    );
  }

  return {
    accessToken: String(data.access_token),
    expiresAt: Date.now() + Number(data.expires_in ?? 3600) * 1000,
    projectId: credentials.projectId || config.fcm.projectId,
  };
}

async function requestMetadataAccessToken() {
  if (!config.fcm.projectId || !config.fcm.useMetadataServer) {
    return null;
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 1500);

  try {
    const response = await fetch(
      `${METADATA_TOKEN_ENDPOINT}/${encodeURIComponent(
        config.fcm.metadataServiceAccount
      )}/token`,
      {
        headers: {
          "Metadata-Flavor": "Google",
        },
        signal: controller.signal,
      }
    );
    const data = await response.json().catch(() => null);

    if (!response.ok || !data?.access_token) {
      return null;
    }

    return {
      accessToken: String(data.access_token),
      expiresAt: Date.now() + Number(data.expires_in ?? 3600) * 1000,
      projectId: config.fcm.projectId,
    };
  } catch {
    return null;
  } finally {
    clearTimeout(timeoutId);
  }
}

async function getFcmAccessToken() {
  if (cachedAccessToken && Date.now() + ACCESS_TOKEN_REFRESH_BUFFER_MS < cachedAccessTokenExpiresAt) {
    return cachedAccessToken;
  }

  const credentials = resolveFcmCredentials();
  let access;

  if (credentials?.clientEmail && credentials?.privateKey) {
    try {
      access = await requestServiceAccountAccessToken(credentials);
    } catch (error) {
      lastFcmAuthenticationError = normalizeText(error?.message || error);
      lastFcmAuthenticationAt = nowIso();
      throw error;
    }
  } else {
    access = await requestMetadataAccessToken();
  }

  if (!access?.accessToken || !access?.projectId) {
    lastFcmAuthenticationError =
      "O servidor não conseguiu obter uma credencial válida para o Firebase.";
    lastFcmAuthenticationAt = nowIso();

    if (!loggedMissingFcmConfig) {
      console.warn(
        "FCM não está configurado. Defina FCM_PROJECT_ID com credenciais do Firebase ou use a service account da VM."
      );
      loggedMissingFcmConfig = true;
    }

    return "";
  }

  lastFcmAuthenticationError = "";
  lastFcmAuthenticationAt = nowIso();
  cachedAccessToken = access.accessToken;
  cachedAccessTokenExpiresAt = access.expiresAt;
  return cachedAccessToken;
}

function formatPushTitle(kind, meta) {
  if (normalizeText(meta?.title)) {
    return normalizeText(meta.title);
  }

  switch (kind) {
    case "chat-message":
      return "Nova mensagem";
    case "chat-request":
      return "Solicitação de conversa";
    case "chat-request-declined":
      return "Conversa recusada";
    case "support-message":
      return "Mensagem do SAC";
    case "service-interest":
      return "Prestador(a) interessado(a)";
    case "service-details-sent":
      return "Detalhes enviados";
    case "payment-ready":
      return "Pagamento liberado";
    case "payment-confirmed":
      return "Valor protegido";
    case "wallet-available":
      return "Saque disponível";
    case "wallet-free-ready":
      return "Saque grátis liberado";
    case "notifications-reminder":
      return "Notificações pendentes";
    case "withdrawal-done":
      return "Saque concluído";
    case "withdrawal-failed":
      return "Falha no saque";
    case "service-accepted":
      return "Você foi aceito";
    case "service-arrival-confirmed":
      return "Chegada confirmada";
    case "service-completed":
      return "Atendimento atualizado";
    case "requester-continued-search":
      return "Busca reaberta";
    case "service-cancelled":
      return "Solicitação cancelada";
    case "dispute-opened":
      return "Disputa aberta";
    case "dispute-resolved":
      return "Disputa resolvida";
    default:
      return "Atualização do Worko";
  }
}

function truncatePushBody(message) {
  const normalized = normalizeText(message);
  return normalized.length > 160 ? `${normalized.slice(0, 157).trimEnd()}...` : normalized;
}

function toStringDataEntries(data) {
  return Object.fromEntries(
    Object.entries(data)
      .map(([key, value]) => {
        if (value === null || value === undefined || value === "") {
          return null;
        }

        if (typeof value === "string") {
          return [key, value];
        }

        if (typeof value === "number" || typeof value === "boolean") {
          return [key, String(value)];
        }

        return [key, JSON.stringify(value)];
      })
      .filter(Boolean)
  );
}

function buildPushMessagePayload(token, notification) {
  const data = toStringDataEntries({
    notificationId: notification.id,
    kind: notification.kind,
    title: notification.title ?? "",
    message: notification.message,
    chatId: notification.chatId ?? "",
    path: notification.path ?? "",
    createdAt: notification.createdAt,
  });

  return {
    message: {
      token,
      notification: {
        title: notification.title,
        body: notification.message,
      },
      data,
      android: {
        priority: "HIGH",
        ttl: "86400s",
        notification: {
          channel_id: FCM_CHANNEL_ID,
          icon: "ic_stat_worko",
          color: "#2563EB",
          sound: "default",
          default_sound: true,
          default_vibrate_timings: true,
          notification_priority: "PRIORITY_HIGH",
        },
      },
    },
  };
}

function extractFcmErrorCode(data) {
  const errorStatus = normalizeText(data?.error?.status);

  if (errorStatus) {
    return errorStatus;
  }

  const details = Array.isArray(data?.error?.details) ? data.error.details : [];

  for (const detail of details) {
    const detailCode = normalizeText(detail?.errorCode);

    if (detailCode) {
      return detailCode;
    }
  }

  return "";
}

function isPermanentPushTokenError(errorCode) {
  return errorCode === "UNREGISTERED" || errorCode === "INVALID_ARGUMENT";
}

function isTransientPushFailure(response) {
  return response.status === 408 || response.status === 429 || response.status >= 500;
}

function wait(delayMs) {
  return new Promise((resolve) => setTimeout(resolve, delayMs));
}

async function sendPushMessageToToken(device, notification, attempt = 0) {
  const attemptAt = nowIso();
  let accessToken = "";

  try {
    accessToken = await getFcmAccessToken();
  } catch (error) {
    const message = normalizeText(error?.message || error) || "Falha ao autenticar no Firebase.";
    markPushDeviceErrorStatement.run(attemptAt, message, device.token);
    return false;
  }

  if (!accessToken || !config.fcm.projectId) {
    markPushDeviceErrorStatement.run(
      attemptAt,
      "O servidor não conseguiu autenticar no Firebase.",
      device.token
    );
    return false;
  }

  let response;

  try {
    response = await fetch(
      `https://fcm.googleapis.com/v1/projects/${encodeURIComponent(
        config.fcm.projectId
      )}/messages:send`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(buildPushMessagePayload(device.token, notification)),
      }
    );
  } catch (error) {
    if (attempt < TRANSIENT_RETRY_DELAYS_MS.length) {
      await wait(TRANSIENT_RETRY_DELAYS_MS[attempt]);
      return sendPushMessageToToken(device, notification, attempt + 1);
    }

    const message = `Falha de rede ao acessar o Firebase: ${
      normalizeText(error?.message || error) || "conexão indisponível"
    }`;
    markPushDeviceErrorStatement.run(nowIso(), message, device.token);
    return false;
  }

  const data = await response.json().catch(() => null);

  if (response.ok) {
    const successAt = nowIso();
    markPushDeviceSuccessStatement.run(successAt, successAt, device.token);
    return true;
  }

  if (response.status === 401 && attempt === 0) {
    cachedAccessToken = "";
    cachedAccessTokenExpiresAt = 0;
    return sendPushMessageToToken(device, notification, attempt + 1);
  }

  if (isTransientPushFailure(response) && attempt < TRANSIENT_RETRY_DELAYS_MS.length) {
    await wait(TRANSIENT_RETRY_DELAYS_MS[attempt]);
    return sendPushMessageToToken(device, notification, attempt + 1);
  }

  const errorCode = extractFcmErrorCode(data);
  const errorMessage =
    normalizeText(data?.error?.message) || "Falha ao enviar push pelo FCM.";
  const timestamp = nowIso();

  if (isPermanentPushTokenError(errorCode)) {
    disablePushDeviceStatement.run(timestamp, timestamp, errorMessage, device.token);
    return false;
  }

  markPushDeviceErrorStatement.run(timestamp, errorMessage, device.token);
  throw new Error(errorMessage);
}

export function isPushNotificationAvailable() {
  return Boolean(config.fcm.projectId);
}

function getFcmCredentialMode() {
  if (config.fcm.serviceAccountFile) {
    return "service-account-file";
  }

  if (config.fcm.serviceAccountJson) {
    return "service-account-json";
  }

  if (config.fcm.clientEmail && config.fcm.privateKey) {
    return "service-account-env";
  }

  if (config.fcm.useMetadataServer) {
    return "gce-metadata";
  }

  return "none";
}

export function registerPushTokenForUser(userId, payload) {
  const token = normalizeDeviceToken(payload?.token);

  if (!token) {
    throw new Error("Token push inválido.");
  }

  const platform = (() => {
    const normalized = normalizeText(payload?.platform).toLowerCase();
    return normalized === "ios" || normalized === "web" ? normalized : "android";
  })();
  const timestamp = nowIso();

  upsertPushDeviceStatement.run(
    createId(),
    userId,
    token,
    platform,
    normalizeText(payload?.appVersion).slice(0, 80),
    normalizeText(payload?.deviceLabel).slice(0, 120),
    timestamp,
    timestamp
  );

  return { ok: true };
}

export function getPushNotificationStatusForUser(userId) {
  const devices = selectPushDeviceStatusByUserStatement.all(userId);

  return {
    configured: isPushNotificationAvailable(),
    projectId: config.fcm.projectId || null,
    credentialMode: getFcmCredentialMode(),
    authentication: {
      lastCheckedAt: lastFcmAuthenticationAt,
      lastError: lastFcmAuthenticationError || null,
    },
    activeDeviceCount: devices.filter((device) => !device.disabled_at).length,
    devices: devices.map((device) => ({
      id: device.id,
      platform: device.platform,
      appVersion: device.app_version || null,
      deviceLabel: device.device_label || null,
      registeredAt: device.created_at,
      updatedAt: device.updated_at,
      disabledAt: device.disabled_at || null,
      lastAttemptAt: device.last_attempt_at || null,
      lastSuccessAt: device.last_success_at || null,
      lastError: device.last_error || null,
    })),
  };
}

export async function sendPushTestForUser(userId) {
  const devices = selectActivePushDevicesByUserStatement.all(userId);

  if (devices.length === 0) {
    return {
      ok: false,
      sent: 0,
      failed: 0,
      reason: "Nenhum aparelho está registrado para receber notificações.",
    };
  }

  const timestamp = nowIso();
  const notification = {
    id: createId(),
    kind: "push-test",
    title: "Notificações do Worko",
    message: "Teste concluído. Este aparelho está recebendo notificações.",
    path: "/app/notifications",
    createdAt: timestamp,
  };
  const results = await Promise.allSettled(
    devices.map((device) => sendPushMessageToToken(device, notification))
  );
  const sent = results.filter(
    (result) => result.status === "fulfilled" && result.value === true
  ).length;

  return {
    ok: sent > 0,
    sent,
    failed: results.length - sent,
    reason:
      sent > 0
        ? null
        : "O Firebase não aceitou a notificação. Consulte o status do dispositivo.",
  };
}

export function unregisterPushTokenForUser(userId, payload) {
  const token = normalizeDeviceToken(payload?.token);

  if (!token) {
    return { ok: true };
  }

  deletePushDeviceStatement.run(userId, token);
  return { ok: true };
}

export function queuePushNotificationForUser(userId, notification) {
  if (!isPushNotificationAvailable() || !notification?.id) {
    return;
  }

  const devices = selectActivePushDevicesByUserStatement.all(userId);

  if (devices.length === 0) {
    return;
  }

  void Promise.allSettled(
    devices.map((device) => sendPushMessageToToken(device, notification))
  ).then((results) => {
    for (const result of results) {
      if (result.status === "rejected") {
        console.warn("Falha ao enviar push FCM.", result.reason);
      }
    }
  });
}

export function buildStoredNotificationPayload(notificationId, kind, message, meta, createdAt) {
  return {
    id: notificationId,
    kind,
    message: truncatePushBody(message),
    title: formatPushTitle(kind, meta),
    chatId: normalizeText(meta?.chatId) || null,
    avatar: normalizeText(meta?.avatar) || null,
    path: normalizeText(meta?.path) || null,
    createdAt,
  };
}

