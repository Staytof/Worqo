import { useEffect } from "react";
import { useRouteError } from "react-router";
import { reportClientIssue } from "../lib/monitoring";
import { supportInfo } from "../content/support";

function extractRouteErrorMessage(error: unknown) {
  if (error instanceof Error && error.message.trim()) {
    return error.message.trim();
  }

  if (typeof error === "string" && error.trim()) {
    return error.trim();
  }

  if (error && typeof error === "object" && "statusText" in error) {
    return String(error.statusText ?? "Não foi possível abrir está tela.");
  }

  return "Não foi possível abrir está tela agora.";
}

export function RouteErrorScreen() {
  const routeError = useRouteError();
  const message = extractRouteErrorMessage(routeError);

  useEffect(() => {
    void reportClientIssue({
      source: "route",
      name: routeError instanceof Error ? routeError.name : "RouteError",
      message,
      stack: routeError instanceof Error ? routeError.stack ?? null : null,
      path: typeof window === "undefined" ? "/" : window.location.pathname,
    });
  }, [message, routeError]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-5 py-8">
      <div className="w-full max-w-md rounded-[32px] border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-blue-600">
          Navegação do app
        </p>
        <h1 className="mt-3 text-2xl font-bold text-slate-900">
          Esta tela não carregou direito
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-slate-600">{message}</p>

        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="rounded-[24px] bg-blue-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-blue-700"
          >
            Tentar de novo
          </button>
          <button
            type="button"
            onClick={() => window.location.assign("/app")}
            className="rounded-[24px] border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
          >
            Ir para o mapa
          </button>
        </div>

        {supportInfo.email || supportInfo.whatsapp ? (
          <p className="mt-5 text-xs leading-relaxed text-slate-500">
            Suporte: {supportInfo.email || supportInfo.whatsapp}
          </p>
        ) : null}
      </div>
    </div>
  );
}

