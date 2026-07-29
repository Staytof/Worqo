export class HttpError extends Error {
  constructor(statusCode, message, details = null) {
    super(message);
    this.name = "HttpError";
    this.statusCode = statusCode;
    this.details = details;
  }
}

export function applySecurityHeaders(response) {
  response.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  response.setHeader("X-Content-Type-Options", "nosniff");
  response.setHeader("X-Frame-Options", "DENY");
  response.setHeader(
    "Permissions-Policy",
    "camera=(self), geolocation=(self), microphone=(), payment=()"
  );
  response.setHeader("Cross-Origin-Opener-Policy", "same-origin-allow-popups");
}

export function json(response, statusCode, payload) {
  response.writeHead(statusCode, {
    ...response.getHeaders(),
    "Cache-Control": "no-store",
    "Content-Type": "application/json; charset=utf-8",
  });
  response.end(JSON.stringify(payload));
}

export async function readRawBody(request, { maxBytes = 256 * 1024 } = {}) {
  const chunks = [];
  let totalBytes = 0;

  for await (const chunk of request) {
    totalBytes += chunk.length;

    if (totalBytes > maxBytes) {
      throw new HttpError(413, "O corpo da requisicao excede o limite permitido.");
    }

    chunks.push(chunk);
  }

  return chunks.length > 0 ? Buffer.concat(chunks) : Buffer.alloc(0);
}

export async function readJsonBody(request, options) {
  const rawBody = await readRawBody(request, options);

  if (rawBody.length === 0) {
    return {};
  }

  try {
    return JSON.parse(rawBody.toString("utf8"));
  } catch {
    throw new HttpError(400, "Corpo JSON inválido.");
  }
}

export function getBearerToken(request) {
  const authorization = request.headers.authorization ?? "";

  if (!authorization.startsWith("Bearer ")) {
    return null;
  }

  return authorization.slice("Bearer ".length).trim();
}

export function getRequestHeaderValue(request, headerName) {
  const normalizedHeaderName = String(headerName ?? "").trim().toLowerCase();
  const headerValue = request.headers[normalizedHeaderName];

  if (Array.isArray(headerValue)) {
    return String(headerValue[0] ?? "").trim();
  }

  return String(headerValue ?? "").trim();
}

function parseOrigin(origin) {
  try {
    return new URL(origin);
  } catch {
    return null;
  }
}

function getPrimaryHeaderValue(headerValue) {
  if (Array.isArray(headerValue)) {
    return String(headerValue[0] ?? "").split(",")[0].trim();
  }

  return String(headerValue ?? "").split(",")[0].trim();
}

function isLoopbackHost(hostname) {
  return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1";
}

function isLocalAppOrigin(origin) {
  const parsedOrigin = parseOrigin(origin);

  if (!parsedOrigin) {
    return false;
  }

  return (
    isLoopbackHost(parsedOrigin.hostname) ||
    (parsedOrigin.protocol === "capacitor:" && parsedOrigin.hostname === "localhost") ||
    (parsedOrigin.protocol === "ionic:" && parsedOrigin.hostname === "localhost")
  );
}

function originMatches(configuredOrigin, requestOrigin) {
  if (!configuredOrigin || !requestOrigin) {
    return false;
  }

  if (configuredOrigin === requestOrigin) {
    return true;
  }

  if (isLocalAppOrigin(configuredOrigin) && isLocalAppOrigin(requestOrigin)) {
    return true;
  }

  const parsedConfiguredOrigin = parseOrigin(configuredOrigin);
  const parsedRequestOrigin = parseOrigin(requestOrigin);

  if (!parsedConfiguredOrigin || !parsedRequestOrigin) {
    return false;
  }

  return (
    parsedConfiguredOrigin.protocol === parsedRequestOrigin.protocol &&
    parsedConfiguredOrigin.hostname === parsedRequestOrigin.hostname &&
    parsedConfiguredOrigin.port === parsedRequestOrigin.port
  );
}

export function getRequestPublicOrigin(request) {
  const host = getPrimaryHeaderValue(request.headers.host);

  if (!host) {
    return "";
  }

  const forwardedProto = getPrimaryHeaderValue(request.headers["x-forwarded-proto"]);
  const protocol = forwardedProto || (request.socket?.encrypted ? "https" : "http");

  return `${protocol}://${host}`.replace(/\/$/, "");
}

function isSameServerOrigin(request, requestOrigin = "") {
  if (!requestOrigin) {
    return true;
  }

  const serverOrigin = getRequestPublicOrigin(request);
  return Boolean(serverOrigin && originMatches(serverOrigin, requestOrigin));
}

export function isOriginAllowed(allowedOrigins, requestOrigin = "") {
  if (!requestOrigin) {
    return true;
  }

  const normalizedOrigins = Array.isArray(allowedOrigins)
    ? allowedOrigins.map((origin) => String(origin).trim()).filter(Boolean)
    : String(allowedOrigins ?? "")
        .split(",")
        .map((origin) => origin.trim())
        .filter(Boolean);

  if (normalizedOrigins.includes("*")) {
    return true;
  }

  return normalizedOrigins.some((origin) => originMatches(origin, requestOrigin));
}

export function assertAllowedApiOrigin(request, allowedOrigins, requestOrigin = "") {
  if (
    !requestOrigin ||
    isSameServerOrigin(request, requestOrigin) ||
    isOriginAllowed(allowedOrigins, requestOrigin)
  ) {
    return;
  }

  throw new HttpError(403, "A origem desta requisição não está autorizada.");
}

export function setCorsHeaders(request, response, allowedOrigins, requestOrigin = "") {
  const normalizedOrigins = Array.isArray(allowedOrigins)
    ? allowedOrigins.map((origin) => String(origin).trim()).filter(Boolean)
    : String(allowedOrigins ?? "")
        .split(",")
        .map((origin) => origin.trim())
        .filter(Boolean);

  if (normalizedOrigins.includes("*")) {
    response.setHeader("Access-Control-Allow-Origin", "*");
  }

  const resolvedOrigin =
    requestOrigin &&
    !normalizedOrigins.includes("*") &&
    (isSameServerOrigin(request, requestOrigin) ||
      normalizedOrigins.some((origin) => originMatches(origin, requestOrigin)))
      ? requestOrigin
      : "";

  if (resolvedOrigin) {
    response.setHeader("Access-Control-Allow-Origin", resolvedOrigin);
  }

  response.setHeader(
    "Access-Control-Allow-Headers",
    "Content-Type, Authorization, X-Worqo-Client-Release"
  );
  response.setHeader(
    "Access-Control-Expose-Headers",
    "X-Request-Id, X-Worqo-Required-Client-Release"
  );
  response.setHeader("Access-Control-Allow-Methods", "GET, POST, PATCH, PUT, DELETE, OPTIONS");
  response.setHeader("Vary", "Origin");
}

export function getClientIp(request) {
  const forwardedFor = request.headers["x-forwarded-for"];

  if (typeof forwardedFor === "string" && forwardedFor.trim()) {
    return forwardedFor.split(",")[0].trim();
  }

  if (Array.isArray(forwardedFor) && forwardedFor.length > 0) {
    return String(forwardedFor[0]).split(",")[0].trim();
  }

  return request.socket?.remoteAddress ?? "unknown";
}

