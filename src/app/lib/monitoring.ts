import { Capacitor, CapacitorHttp } from "@capacitor/core";
import { resolveApiBaseUrl } from "../api/client";

const CLIENT_REPORT_CACHE_TTL_MS = 60_000;
const recentClientReports = new Map<string, number>();

type ClientIssuePayload = {
  source: "runtime" | "promise" | "route" | "manual";
  name?: string;
  message: string;
  stack?: string | null;
  path?: string;
  metadata?: Record<string, unknown>;
  token?: string | null;
};

function cleanupRecentClientReports() {
  const now = Date.now();

  for (const [key, createdAt] of recentClientReports.entries()) {
    if (now - createdAt > CLIENT_REPORT_CACHE_TTL_MS) {
      recentClientReports.delete(key);
    }
  }
}

function buildClientReportKey(payload: ClientIssuePayload) {
  return [
    payload.source,
    payload.name ?? "",
    payload.message,
    payload.path ?? "",
  ].join("|");
}

export async function reportClientIssue(payload: ClientIssuePayload) {
  const message = String(payload.message ?? "").trim();

  if (!message) {
    return;
  }

  cleanupRecentClientReports();

  const reportKey = buildClientReportKey(payload);

  if (recentClientReports.has(reportKey)) {
    return;
  }

  recentClientReports.set(reportKey, Date.now());

  const requestBody = {
    source: payload.source,
    name: String(payload.name ?? "").trim() || null,
    message,
    stack: String(payload.stack ?? "").trim() || null,
    path:
      String(payload.path ?? "").trim() ||
      (typeof window !== "undefined" ? window.location.pathname : ""),
    userAgent: typeof navigator === "undefined" ? "" : navigator.userAgent,
    metadata:
      payload.metadata && typeof payload.metadata === "object" && !Array.isArray(payload.metadata)
        ? payload.metadata
        : {},
  };

  const url = `${resolveApiBaseUrl()}/api/client-errors`;
  const headers = {
    "Content-Type": "application/json",
    ...(payload.token ? { Authorization: `Bearer ${payload.token}` } : {}),
  };

  if (Capacitor.isNativePlatform()) {
    await CapacitorHttp.request({
      url,
      method: "POST",
      headers,
      data: requestBody,
      connectTimeout: 8000,
      readTimeout: 8000,
      responseType: "json",
    }).catch(() => undefined);

    return;
  }

  await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify(requestBody),
    cache: "no-store",
    credentials: "omit",
    keepalive: true,
  }).catch(() => undefined);
}

export function registerGlobalClientErrorMonitoring() {
  if (typeof window === "undefined") {
    return;
  }

  window.addEventListener("error", (event) => {
    void reportClientIssue({
      source: "runtime",
      name: event.error instanceof Error ? event.error.name : "RuntimeError",
      message:
        event.error instanceof Error
          ? event.error.message
          : String(event.message ?? "Erro de execução no app."),
      stack: event.error instanceof Error ? event.error.stack ?? null : null,
      path: window.location.pathname,
    });
  });

  window.addEventListener("unhandledrejection", (event) => {
    const reason = event.reason;

    void reportClientIssue({
      source: "promise",
      name: reason instanceof Error ? reason.name : "UnhandledPromiseRejection",
      message:
        reason instanceof Error
          ? reason.message
          : String(reason ?? "Promessa rejeitada sem tratamento."),
      stack: reason instanceof Error ? reason.stack ?? null : null,
      path: window.location.pathname,
    });
  });
}

