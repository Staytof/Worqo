import { Capacitor, CapacitorHttp } from "@capacitor/core";

const clientRelease = (import.meta.env.VITE_CLIENT_RELEASE ?? "").trim();
const DEFAULT_REQUEST_TIMEOUT_MS = 12_000;
const configuredApiBaseUrl = (import.meta.env.VITE_API_URL ?? "").replace(/\/$/, "");

export const WORQO_SYSTEM_STATUS_EVENT = "worqo-system-status";
export const WORQO_SYSTEM_STATUS_DURATION_MS = 4000;

export function resolveApiBaseUrl() {
  if (Capacitor.isNativePlatform()) {
    return configuredApiBaseUrl;
  }

  if (typeof window === "undefined") {
    return configuredApiBaseUrl;
  }

  if (!configuredApiBaseUrl) {
    return window.location.origin.replace(/\/$/, "");
  }

  try {
    const configuredUrl = new URL(configuredApiBaseUrl);

    if (configuredUrl.origin === window.location.origin) {
      return "";
    }
  } catch {
    return configuredApiBaseUrl;
  }

  return configuredApiBaseUrl;
}

type ApiRequestOptions = {
  method?: string;
  body?: unknown;
  token?: string | null;
  suppressSystemStatus?: boolean;
};

export class ApiRequestError<T = unknown> extends Error {
  status: number;
  data: T | null;
  requestId: string | null;
  requiredClientRelease: string | null;

  constructor(
    message: string,
    status: number,
    data: T | null = null,
    options: { requestId?: string | null; requiredClientRelease?: string | null } = {}
  ) {
    super(message);
    this.name = "ApiRequestError";
    this.status = status;
    this.data = data;
    this.requestId = options.requestId ?? null;
    this.requiredClientRelease = options.requiredClientRelease ?? null;
  }
}

export function dispatchSystemStatus(detail: Record<string, unknown>) {
  if (typeof window === "undefined") {
    return;
  }

  window.dispatchEvent(
    new CustomEvent(WORQO_SYSTEM_STATUS_EVENT, {
      detail,
    })
  );
}

function normalizeResponseData<T>(data: unknown) {
  if (typeof data !== "string") {
    return (data ?? null) as T | { error?: string } | null;
  }

  const trimmed = data.trim();

  if (!trimmed) {
    return null;
  }

  try {
    return JSON.parse(trimmed) as T | { error?: string };
  } catch {
    return trimmed as unknown as T;
  }
}

function resolveTransportErrorMessage(error: unknown) {
  if (error instanceof DOMException && error.name === "AbortError") {
    return "A requisição demorou demais. Tente novamente.";
  }

  if (error instanceof Error) {
    const message = error.message.trim();
    const loweredMessage = message.toLowerCase();

    if (
      !message ||
      message === "Failed to fetch" ||
      message === "Load failed" ||
      loweredMessage.includes("failed to connect to /") ||
      loweredMessage.includes("connection refused") ||
      loweredMessage.includes("network is unreachable") ||
      loweredMessage.includes("failed to connect") ||
      loweredMessage.includes("econnrefused")
    ) {
      return "Não foi possível conectar ao servidor. Verifique sua conexão e tente novamente.";
    }

    return message;
  }

  return "Não foi possível conectar ao servidor. Tente novamente.";
}

function readResponseHeader(
  headers: Headers | Record<string, string> | undefined | null,
  headerName: string
) {
  if (!headers) {
    return "";
  }

  if (headers instanceof Headers) {
    return headers.get(headerName) ?? headers.get(headerName.toLowerCase()) ?? "";
  }

  const normalizedHeaderName = headerName.toLowerCase();

  for (const [key, value] of Object.entries(headers)) {
    if (key.toLowerCase() === normalizedHeaderName) {
      return String(value ?? "").trim();
    }
  }

  return "";
}

function maybeDispatchUpdateRequired(
  requiredClientRelease: string | null,
  suppressSystemStatus = false
) {
  if (suppressSystemStatus) {
    return;
  }

  dispatchSystemStatus({
    kind: "update-required",
    message: "Existe uma versão mais recente do app. Atualize para continuar.",
    requiredClientRelease,
  });
}

function maybeDispatchRequestError(message: string, suppressSystemStatus = false) {
  if (suppressSystemStatus) {
    return;
  }

  dispatchSystemStatus({
    kind: "error",
    message,
  });
}

export async function apiRequest<T>(
  path: string,
  { body, method = "GET", token, suppressSystemStatus = false }: ApiRequestOptions = {}
) {
  const url = `${resolveApiBaseUrl()}${path}`;
  const headers = {
    ...(body ? { "Content-Type": "application/json" } : {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(clientRelease ? { "X-Worqo-Client-Release": clientRelease } : {}),
  };

  if (Capacitor.isNativePlatform()) {
    let nativeResponse;

    try {
      nativeResponse = await CapacitorHttp.request({
        url,
        method,
        headers,
        data: body,
        connectTimeout: DEFAULT_REQUEST_TIMEOUT_MS,
        readTimeout: DEFAULT_REQUEST_TIMEOUT_MS,
        responseType: "json",
      });
    } catch (error) {
      const message = resolveTransportErrorMessage(error);
      if (!suppressSystemStatus) {
        dispatchSystemStatus({
          kind: "server-unreachable",
          message,
        });
      }
      throw new Error(message);
    }

    const data = normalizeResponseData<T>(nativeResponse.data);
    const requestId = readResponseHeader(nativeResponse.headers, "x-request-id") || null;
    const requiredClientRelease =
      readResponseHeader(nativeResponse.headers, "x-worqo-required-client-release") || null;

    if (nativeResponse.status < 200 || nativeResponse.status >= 300) {
      if (nativeResponse.status === 426) {
        maybeDispatchUpdateRequired(requiredClientRelease, suppressSystemStatus);
      }

      const message =
        (data && typeof data === "object" && "error" in data && data.error) ||
        "Não conseguimos concluir a solicitação.";

      if (nativeResponse.status !== 426) {
        maybeDispatchRequestError(message, suppressSystemStatus);
      }

      throw new ApiRequestError(
        message,
        nativeResponse.status,
        data as T | null,
        {
          requestId,
          requiredClientRelease,
        }
      );
    }

    if (!suppressSystemStatus) {
      dispatchSystemStatus({ kind: "healthy" });
    }
    return data as T;
  }

  const controller = new AbortController();
  const timeoutId = globalThis.setTimeout(() => controller.abort(), DEFAULT_REQUEST_TIMEOUT_MS);

  let response: Response;

  try {
    response = await fetch(url, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
      cache: "no-store",
      credentials: "omit",
      signal: controller.signal,
    });
  } catch (error) {
    const message = resolveTransportErrorMessage(error);
    if (!suppressSystemStatus) {
      dispatchSystemStatus({
        kind: "server-unreachable",
        message,
      });
    }
    throw new Error(message);
  } finally {
    globalThis.clearTimeout(timeoutId);
  }

  const data = (await response.json().catch(() => null)) as T | { error?: string } | null;
  const requestId = response.headers.get("x-request-id");
  const requiredClientRelease = response.headers.get("x-worqo-required-client-release");

  if (!response.ok) {
    if (response.status === 426) {
      maybeDispatchUpdateRequired(requiredClientRelease, suppressSystemStatus);
    }

    const message =
      (data && typeof data === "object" && "error" in data && data.error) ||
      "Não conseguimos concluir a solicitação.";

    if (response.status !== 426) {
      maybeDispatchRequestError(message, suppressSystemStatus);
    }

    throw new ApiRequestError(
      message,
      response.status,
      data as T | null,
      {
        requestId,
        requiredClientRelease,
      }
    );
  }

  if (!suppressSystemStatus) {
    dispatchSystemStatus({ kind: "healthy" });
  }
  return data as T;
}

