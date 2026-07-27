import path from "node:path";

const rootDir = process.cwd();
const normalizeEnvValue = (value) => String(value ?? "").trim();
const normalizeCompactSecret = (value) => normalizeEnvValue(value).replace(/\s+/g, "");
const normalizeOrigin = (value) => String(value ?? "").trim().replace(/\/$/, "");
const normalizeMultilineSecret = (value) =>
  String(value ?? "")
    .trim()
    .replace(/\\n/g, "\n");
const defaultClientOrigins = [
  "http://localhost:5173",
  "http://localhost",
  "https://localhost",
  "capacitor://localhost",
  "ionic://localhost",
];
const explicitCpfProvider = (process.env.CPF_VERIFICATION_PROVIDER ?? "").trim().toLowerCase();
const inferredCpfProvider =
  explicitCpfProvider ||
  (process.env.HUBDEV_TOKEN ? "hubdev" : "") ||
  (process.env.SERPRO_CONSUMER_KEY ? "serpro" : "");
const hubdevTurboEnabled = process.env.HUBDEV_TURBO === "true";
const defaultHubdevTimeoutMs = hubdevTurboEnabled ? 35_000 : 610_000;

const configuredClientOrigins = String(process.env.CLIENT_ORIGIN ?? "")
  .split(",")
  .map((origin) => normalizeOrigin(origin))
  .filter((origin) => origin && origin !== "*");
const configuredRequiredClientRelease = normalizeEnvValue(process.env.REQUIRED_CLIENT_RELEASE);
const configuredFcmProjectId = normalizeEnvValue(
  process.env.FCM_PROJECT_ID ?? process.env.FIREBASE_PROJECT_ID
);
const configuredFcmServiceAccountJson = normalizeEnvValue(
  process.env.FCM_SERVICE_ACCOUNT_JSON ?? process.env.FIREBASE_SERVICE_ACCOUNT_JSON
);
const appBaseUrl = normalizeOrigin(
  process.env.APP_BASE_URL ??
    configuredClientOrigins[0] ??
    defaultClientOrigins[0]
);
const apiPublicUrl = normalizeOrigin(
  process.env.API_PUBLIC_URL ??
    process.env.VITE_API_URL ??
    `http://localhost:${process.env.PORT ?? process.env.API_PORT ?? 3001}`
);
const clientOrigins = Array.from(
  new Set(
    [...defaultClientOrigins, appBaseUrl, ...configuredClientOrigins].filter(Boolean)
  )
);

export const config = {
  port: Number(process.env.PORT ?? process.env.API_PORT ?? 3001),
  clientOrigins,
  appBaseUrl,
  apiPublicUrl,
  backendRelease: normalizeEnvValue(process.env.BACKEND_RELEASE),
  requiredClientRelease:
    configuredRequiredClientRelease ||
    (process.env.NODE_ENV === "production" ? "20260324-releasegate" : ""),
  support: {
    email: normalizeEnvValue(process.env.SUPPORT_EMAIL),
    whatsapp: normalizeEnvValue(process.env.SUPPORT_WHATSAPP),
  },
  adminEmails: String(process.env.ADMIN_EMAILS ?? "gabrielspec99@gmail.com")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean),
  dbPath: path.join(rootDir, "server", "data", "auth.db"),
  googleMapsApiKey:
    normalizeEnvValue(process.env.GOOGLE_MAPS_API_KEY ?? process.env.VITE_GOOGLE_MAPS_API_KEY),
  googleOAuth: {
    clientId: normalizeEnvValue(process.env.GOOGLE_OAUTH_CLIENT_ID),
    clientSecret: normalizeEnvValue(process.env.GOOGLE_OAUTH_CLIENT_SECRET),
    redirectUri:
      normalizeEnvValue(process.env.GOOGLE_OAUTH_REDIRECT_URI) ||
      `${apiPublicUrl}/api/auth/google/callback`,
  },
  asaas: {
    apiKey: normalizeCompactSecret(process.env.ASAAS_API_KEY),
    apiBaseUrl: normalizeEnvValue(process.env.ASAAS_API_BASE_URL) || "https://api-sandbox.asaas.com/v3",
    webhookToken: normalizeCompactSecret(process.env.ASAAS_WEBHOOK_TOKEN),
  },
  smtp: {
    host: process.env.SMTP_HOST ?? "smtp.gmail.com",
    port: Number(process.env.SMTP_PORT ?? 587),
    secure: process.env.SMTP_SECURE === "true",
    user: process.env.SMTP_USER ?? "",
    pass: process.env.SMTP_PASS ?? "",
    from: process.env.SMTP_FROM ?? process.env.SMTP_USER ?? "",
  },
  fcm: {
    projectId: configuredFcmProjectId,
    serviceAccountJson: configuredFcmServiceAccountJson,
    serviceAccountFile: normalizeEnvValue(process.env.FCM_SERVICE_ACCOUNT_FILE),
    clientEmail: normalizeEnvValue(process.env.FCM_CLIENT_EMAIL),
    privateKey: normalizeMultilineSecret(process.env.FCM_PRIVATE_KEY),
    useMetadataServer:
      process.env.FCM_USE_GCE_METADATA !== "false" ||
      process.env.GOOGLE_CLOUD_PROJECT === configuredFcmProjectId,
    metadataServiceAccount:
      normalizeEnvValue(process.env.FCM_GCE_SERVICE_ACCOUNT) || "default",
  },
  allowMockEmailVerification:
    process.env.ALLOW_MOCK_EMAIL_VERIFICATION === "true" ||
    appBaseUrl.includes("localhost") ||
    appBaseUrl.startsWith("http://127.0.0.1"),
  cpfVerification: {
    provider: inferredCpfProvider,
    hubdev: {
      token: process.env.HUBDEV_TOKEN ?? "",
      queryUrl: process.env.HUBDEV_CPF_QUERY_URL ?? "https://ws.hubdodesenvolvedor.com.br/v2/cpf/",
      method: (process.env.HUBDEV_CPF_METHOD ?? "GET").trim().toUpperCase(),
      tokenParam: process.env.HUBDEV_TOKEN_PARAM ?? "token",
      cpfParam: process.env.HUBDEV_CPF_PARAM ?? "cpf",
      birthDateParam: process.env.HUBDEV_BIRTH_DATE_PARAM ?? "data",
      birthDateFormat: process.env.HUBDEV_BIRTH_DATE_FORMAT ?? "dd/MM/yyyy",
      requireBirthDate: process.env.HUBDEV_REQUIRE_BIRTH_DATE !== "false",
      ignoreDb: process.env.HUBDEV_IGNORE_DB === "true",
      turbo: hubdevTurboEnabled,
      timeoutMs: Number(process.env.HUBDEV_TIMEOUT_MS ?? defaultHubdevTimeoutMs),
    },
    serpro: {
      consumerKey: process.env.SERPRO_CONSUMER_KEY ?? "",
      consumerSecret: process.env.SERPRO_CONSUMER_SECRET ?? "",
      tokenUrl: process.env.SERPRO_TOKEN_URL ?? "",
      queryUrlTemplate: process.env.SERPRO_CPF_QUERY_URL ?? "",
      scope: process.env.SERPRO_SCOPE ?? "",
    },
  },
  rateLimit: {
    authWindowMs: Number(process.env.RATE_LIMIT_AUTH_WINDOW_MS ?? 10 * 60 * 1000),
    authMax: Number(process.env.RATE_LIMIT_AUTH_MAX ?? 20),
    apiWindowMs: Number(process.env.RATE_LIMIT_API_WINDOW_MS ?? 60 * 1000),
    apiMax: Number(process.env.RATE_LIMIT_API_MAX ?? 240),
    chatWindowMs: Number(process.env.RATE_LIMIT_CHAT_WINDOW_MS ?? 60 * 1000),
    chatMax: Number(process.env.RATE_LIMIT_CHAT_MAX ?? 45),
  },
};

export function isAdminEmail(email) {
  const normalizedEmail = String(email ?? "").trim().toLowerCase();
  return Boolean(normalizedEmail && config.adminEmails.includes(normalizedEmail));
}

export function isEmailConfigured() {
  return Boolean(config.smtp.user && config.smtp.pass && config.smtp.from);
}

export function isCpfVerificationConfigured() {
  if (config.cpfVerification.provider === "hubdev") {
    return Boolean(config.cpfVerification.hubdev.token && config.cpfVerification.hubdev.queryUrl);
  }

  if (config.cpfVerification.provider === "serpro") {
    const { consumerKey, consumerSecret, tokenUrl, queryUrlTemplate } =
      config.cpfVerification.serpro;

    return Boolean(consumerKey && consumerSecret && tokenUrl && queryUrlTemplate);
  }

  return false;
}
