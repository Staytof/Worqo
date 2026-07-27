import { AlertTriangle, CheckCircle2, Info, WifiOff, X } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  WORQO_SYSTEM_STATUS_DURATION_MS,
  WORQO_SYSTEM_STATUS_EVENT,
} from "../api/client";

type SystemToastKind =
  | "error"
  | "offline"
  | "server-unreachable"
  | "success"
  | "update-required";

type ToastState = {
  id: number;
  kind: SystemToastKind;
  message: string;
};

function normalizeToastKind(kind: unknown): SystemToastKind {
  if (
    kind === "error" ||
    kind === "offline" ||
    kind === "server-unreachable" ||
    kind === "success" ||
    kind === "update-required"
  ) {
    return kind;
  }

  return "error";
}

export function SystemStatusBanner() {
  const [toast, setToast] = useState<ToastState | null>(null);
  const lastToastRef = useRef<{ message: string; shownAt: number } | null>(null);

  const showToast = (kind: SystemToastKind, message: string) => {
    const normalizedMessage = message.trim();

    if (!normalizedMessage) {
      return;
    }

    const now = Date.now();
    const lastToast = lastToastRef.current;

    if (lastToast?.message === normalizedMessage && now - lastToast.shownAt < 900) {
      return;
    }

    lastToastRef.current = {
      message: normalizedMessage,
      shownAt: now,
    };

    setToast({
      id: now,
      kind,
      message: normalizedMessage,
    });
  };

  useEffect(() => {
    const applyOnlineState = () => {
      if (typeof navigator !== "undefined" && !navigator.onLine) {
        showToast(
          "offline",
          "Seu aparelho ficou sem internet. O app pode parar de atualizar até a conexão voltar."
        );
      }
    };

    applyOnlineState();

    window.addEventListener("online", applyOnlineState);
    window.addEventListener("offline", applyOnlineState);

    const handleSystemStatus = (event: Event) => {
      const detail =
        event instanceof CustomEvent && event.detail && typeof event.detail === "object"
          ? event.detail
          : null;

      if (!detail || detail.kind === "healthy") {
        return;
      }

      const message =
        typeof detail.message === "string" && detail.message.trim()
          ? detail.message.trim()
          : "O app encontrou uma instabilidade temporária.";

      showToast(normalizeToastKind(detail.kind), message);
    };

    window.addEventListener(WORQO_SYSTEM_STATUS_EVENT, handleSystemStatus);

    return () => {
      window.removeEventListener("online", applyOnlineState);
      window.removeEventListener("offline", applyOnlineState);
      window.removeEventListener(WORQO_SYSTEM_STATUS_EVENT, handleSystemStatus);
    };
  }, []);

  useEffect(() => {
    if (!toast) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setToast((current) => (current?.id === toast.id ? null : current));
    }, WORQO_SYSTEM_STATUS_DURATION_MS);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [toast?.id]);

  const visual = useMemo(() => {
    if (!toast) {
      return null;
    }

    if (toast.kind === "success") {
      return {
        icon: CheckCircle2,
        className: "border-emerald-200 bg-emerald-50 text-emerald-950",
        iconClassName: "text-emerald-600",
      };
    }

    if (toast.kind === "update-required") {
      return {
        icon: Info,
        className: "border-amber-200 bg-amber-50 text-amber-950",
        iconClassName: "text-amber-600",
      };
    }

    if (toast.kind === "offline" || toast.kind === "server-unreachable") {
      return {
        icon: WifiOff,
        className: "border-rose-200 bg-rose-50 text-rose-950",
        iconClassName: "text-rose-600",
      };
    }

    return {
      icon: AlertTriangle,
      className: "border-rose-200 bg-rose-50 text-rose-950",
      iconClassName: "text-rose-600",
    };
  }, [toast]);

  const Icon = visual?.icon;

  return (
    <AnimatePresence>
      {toast && visual && Icon ? (
        <motion.div
          key={toast.id}
          initial={{ opacity: 0, y: -18, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -18, scale: 0.98 }}
          transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
          className="pointer-events-none fixed inset-x-0 top-[calc(14px+env(safe-area-inset-top,0px))] z-[160] flex justify-center px-4"
        >
          <div
            role="alert"
            aria-live="assertive"
            className={`pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-2xl border px-4 py-3 text-sm shadow-[0_18px_45px_rgba(15,23,42,0.16)] ${visual.className}`}
          >
            <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${visual.iconClassName}`} />
            <p className="min-w-0 flex-1 break-words leading-relaxed [overflow-wrap:anywhere]">
              {toast.message}
            </p>
            <button
              type="button"
              onClick={() => setToast(null)}
              className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-current/65 transition hover:bg-black/5 hover:text-current"
              aria-label="Fechar aviso"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
