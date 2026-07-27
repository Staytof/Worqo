import { Component, type ErrorInfo, type ReactNode } from "react";
import { reportClientIssue } from "../lib/monitoring";
import { supportInfo } from "../content/support";

type AppErrorBoundaryProps = {
  children: ReactNode;
};

type AppErrorBoundaryState = {
  hasError: boolean;
};

export class AppErrorBoundary extends Component<AppErrorBoundaryProps, AppErrorBoundaryState> {
  state: AppErrorBoundaryState = {
    hasError: false,
  };

  private reset = () => {
    if (this.state.hasError) {
      this.setState({ hasError: false });
    }
  };

  componentDidMount() {
    if (typeof window === "undefined") {
      return;
    }

    window.addEventListener("popstate", this.reset);
    window.addEventListener("worqo-route-change", this.reset);
  }

  componentWillUnmount() {
    if (typeof window === "undefined") {
      return;
    }

    window.removeEventListener("popstate", this.reset);
    window.removeEventListener("worqo-route-change", this.reset);
  }

  static getDerivedStateFromError() {
    return {
      hasError: true,
    };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    void reportClientIssue({
      source: "runtime",
      name: error.name,
      message: error.message,
      stack: `${error.stack ?? ""}\n\n${info.componentStack ?? ""}`.trim(),
      path: typeof window === "undefined" ? "/" : window.location.pathname,
    });
  }

  render() {
    if (!this.state.hasError) {
      return this.props.children;
    }

    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 px-5 py-8">
        <div className="w-full max-w-md rounded-[32px] border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-blue-600">
            Estabilidade do app
          </p>
          <h1 className="mt-3 text-2xl font-bold text-slate-900">
            Algo travou nesta tela
          </h1>
          <p className="mt-3 text-sm leading-relaxed text-slate-600">
            O erro já foi registrado. Recarregue o app para tentar novamente.
          </p>

          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="rounded-[24px] bg-blue-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-blue-700"
            >
              Recarregar app
            </button>
            <button
              type="button"
              onClick={() => window.location.assign("/")}
              className="rounded-[24px] border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
            >
              Voltar ao início
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
}
