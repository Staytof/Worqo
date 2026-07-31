import { useEffect, useMemo, useRef, useState } from "react";
import { CheckCircle2, Copy, QrCode, RefreshCcw, X } from "lucide-react";
import { motion } from "motion/react";
import { Navigate, useNavigate } from "react-router";
import { useApp } from "../../context/AppContext";
import { useErrorToast } from "../../hooks/useErrorToast";
import {
  calculateAppServiceFeeAmount,
  calculateAsaasFixedFeeAmount,
  calculateServiceFeeAmount,
  formatCurrencyAmount,
  parseCurrencyValue,
} from "../../utils/helpers";

const PIX_SESSION_DURATION_MS = 15 * 60 * 1000;
const PAYMENT_STATUS_POLL_INTERVAL_MS = 3000;

function resolveQrCodeImage(value: string | null | undefined) {
  if (!value) {
    return "";
  }

  if (value.startsWith("data:")) {
    return value;
  }

  return `data:image/png;base64,${value}`;
}

async function copyTextToClipboard(value: string) {
  if (!value) {
    return false;
  }

  if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(value);
      return true;
    } catch {
      return false;
    }
  }

  return false;
}

export function ServicePayment() {
  const navigate = useNavigate();
  const {
    state: { activeServiceRequest },
    cancelActiveServiceRequest,
    createServicePaymentSession,
    openChat,
    refreshServicePaymentStatus,
  } = useApp();
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [pixCopyPaste, setPixCopyPaste] = useState("");
  const [pixQrCodeBase64, setPixQrCodeBase64] = useState("");
  const [pixExpiresAt, setPixExpiresAt] = useState<string | null>(null);
  const [pixRemainingMs, setPixRemainingMs] = useState<number | null>(null);
  const [isLoadingPayment, setIsLoadingPayment] = useState(false);
  const [isRefreshingPayment, setIsRefreshingPayment] = useState(false);
  const [isCopyingPix, setIsCopyingPix] = useState(false);
  const [showRefreshAction, setShowRefreshAction] = useState(false);
  const [showConfirmedState, setShowConfirmedState] = useState(false);
  const redirectTimeoutRef = useRef<number | null>(null);
  const slowValidationTimeoutRef = useRef<number | null>(null);
  const initialSessionRequestIdRef = useRef<string | null>(null);
  const statusRefreshInFlightRef = useRef(false);
  const activeRequestIdRef = useRef(activeServiceRequest?.id ?? null);
  const createPaymentSessionRef = useRef(createServicePaymentSession);
  const refreshPaymentStatusRef = useRef(refreshServicePaymentStatus);
  activeRequestIdRef.current = activeServiceRequest?.id ?? null;
  createPaymentSessionRef.current = createServicePaymentSession;
  refreshPaymentStatusRef.current = refreshServicePaymentStatus;
  useErrorToast(error);

  const baseServiceAmount = parseCurrencyValue(activeServiceRequest?.details?.price ?? "");
  const appFeeAmount = calculateAppServiceFeeAmount(baseServiceAmount);
  const asaasFeeAmount = calculateAsaasFixedFeeAmount(baseServiceAmount);
  const totalPaymentAmount = Number(
    (baseServiceAmount + calculateServiceFeeAmount(baseServiceAmount)).toFixed(2)
  );
  const qrCodeImage = useMemo(
    () => resolveQrCodeImage(pixQrCodeBase64),
    [pixQrCodeBase64]
  );
  const pixExpirationTime = useMemo(() => {
    if (!pixExpiresAt) {
      return null;
    }

    const timestamp = new Date(pixExpiresAt).getTime();
    return Number.isFinite(timestamp)
      ? Math.min(timestamp, Date.now() + PIX_SESSION_DURATION_MS)
      : null;
  }, [pixExpiresAt]);
  const pixRemainingLabel = useMemo(() => {
    if (pixRemainingMs === null) {
      return "";
    }

    const totalSeconds = Math.max(0, Math.ceil(pixRemainingMs / 1000));
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  }, [pixRemainingMs]);
  const isPixExpired = pixExpirationTime !== null && pixRemainingMs === 0;

  useEffect(() => {
    return () => {
      if (redirectTimeoutRef.current) {
        window.clearTimeout(redirectTimeoutRef.current);
      }

      if (slowValidationTimeoutRef.current) {
        window.clearTimeout(slowValidationTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!activeServiceRequest || activeServiceRequest.status !== "payment") {
      return;
    }

    const requestId = activeServiceRequest.id;

    if (initialSessionRequestIdRef.current === requestId) {
      return;
    }

    initialSessionRequestIdRef.current = requestId;

    async function loadPaymentSession() {
      setIsLoadingPayment(true);
      setError("");
      setMessage("");

      const result = await createPaymentSessionRef.current();

      if (activeRequestIdRef.current !== requestId) {
        return;
      }

      setIsLoadingPayment(false);

      if (!result.ok) {
        initialSessionRequestIdRef.current = null;
        setError(result.error ?? "Não conseguimos carregar o Pix deste pedido agora.");
        setShowRefreshAction(true);
        return;
      }

      setPixCopyPaste(result.pixCopyPaste ?? "");
      setPixQrCodeBase64(result.pixQrCodeBase64 ?? "");
      setPixExpiresAt(result.expiresAt ?? null);
      setMessage("O pagamento será validado automaticamente assim que o Pix for compensado.");
      setShowRefreshAction(false);

      if (slowValidationTimeoutRef.current) {
        window.clearTimeout(slowValidationTimeoutRef.current);
      }

      slowValidationTimeoutRef.current = window.setTimeout(() => {
        setShowRefreshAction(true);
      }, 20000);
    }

    void loadPaymentSession();
  }, [activeServiceRequest?.id, activeServiceRequest?.status]);

  useEffect(() => {
    if (!pixExpirationTime || activeServiceRequest?.status !== "payment") {
      setPixRemainingMs(null);
      return;
    }

    const updateRemainingTime = () => {
      setPixRemainingMs(Math.max(0, pixExpirationTime - Date.now()));
    };

    updateRemainingTime();
    const intervalId = window.setInterval(updateRemainingTime, 1000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [activeServiceRequest?.status, pixExpirationTime]);

  useEffect(() => {
    if (
      !pixExpirationTime ||
      pixRemainingMs === null ||
      pixRemainingMs > 0 ||
      activeServiceRequest?.status !== "payment"
    ) {
      return;
    }

    setShowRefreshAction(true);
    setMessage("O prazo deste código terminou. Gere um novo Pix para continuar.");
  }, [
    activeServiceRequest?.status,
    pixExpirationTime,
    pixRemainingMs,
  ]);

  useEffect(() => {
    if (!activeServiceRequest || activeServiceRequest.status !== "payment" || showConfirmedState) {
      return;
    }

    let disposed = false;

    const refreshInBackground = async () => {
      if (
        disposed ||
        document.hidden ||
        statusRefreshInFlightRef.current
      ) {
        return;
      }

      statusRefreshInFlightRef.current = true;

      try {
        const result = await refreshPaymentStatusRef.current();
        if (result.ok && result.message) {
          setMessage((current) =>
            current === result.message ? current : result.message ?? current
          );
        }
      } finally {
        statusRefreshInFlightRef.current = false;
      }
    };

    const initialTimeoutId = window.setTimeout(
      () => void refreshInBackground(),
      1500
    );
    const intervalId = window.setInterval(
      () => void refreshInBackground(),
      PAYMENT_STATUS_POLL_INTERVAL_MS
    );

    return () => {
      disposed = true;
      window.clearTimeout(initialTimeoutId);
      window.clearInterval(intervalId);
    };
  }, [
    activeServiceRequest?.id,
    activeServiceRequest?.status,
    showConfirmedState,
  ]);

  useEffect(() => {
    if (activeServiceRequest?.status !== "confirmed" || showConfirmedState) {
      return;
    }

    setShowConfirmedState(true);
    setMessage("");
    setError("");

    if (slowValidationTimeoutRef.current) {
      window.clearTimeout(slowValidationTimeoutRef.current);
    }

    redirectTimeoutRef.current = window.setTimeout(() => {
      if (activeServiceRequest.chatId) {
        openChat(activeServiceRequest.chatId);
      }

      navigate("/app/chat", { replace: true });
    }, 2800);
  }, [activeServiceRequest?.chatId, activeServiceRequest?.status, navigate, openChat, showConfirmedState]);

  if (!activeServiceRequest) {
    return <Navigate to="/app" replace />;
  }

  if (activeServiceRequest.currentUserRole !== "requester") {
    return <Navigate to="/app/chat" replace />;
  }

  if (activeServiceRequest.status === "waiting-worker") {
    return <Navigate to="/app/service/waiting" replace />;
  }

  if (activeServiceRequest.status === "completed") {
    return <Navigate to="/app" replace />;
  }

  if (activeServiceRequest.status !== "payment" && activeServiceRequest.status !== "confirmed") {
    return <Navigate to="/app/chat" replace />;
  }

  const handleClose = async () => {
    const confirmed = window.confirm(
      "Sair agora cancela este atendimento. Deseja continuar?"
    );

    if (!confirmed) {
      return;
    }

    const result = await cancelActiveServiceRequest();

    if (!result.ok) {
      setError(result.error ?? "Não conseguimos cancelar este atendimento agora.");
      return;
    }

    navigate("/app", { replace: true });
  };

  const handleRefreshPayment = async () => {
    if (isRefreshingPayment || statusRefreshInFlightRef.current) {
      return;
    }

    statusRefreshInFlightRef.current = true;
    setIsRefreshingPayment(true);
    setError("");
    const result = await refreshPaymentStatusRef.current();
    statusRefreshInFlightRef.current = false;
    setIsRefreshingPayment(false);

    if (!result.ok) {
      setError(result.error ?? "Não conseguimos verificar o pagamento agora.");
      return;
    }

    setMessage(result.message ?? "Seguimos aguardando a confirmação do Pix.");
  };

  const handleRenewPayment = async () => {
    if (isLoadingPayment || statusRefreshInFlightRef.current) {
      return;
    }

    setIsLoadingPayment(true);
    setError("");
    setMessage("Gerando um novo código Pix...");
    const result = await createPaymentSessionRef.current();
    setIsLoadingPayment(false);

    if (!result.ok) {
      setError(result.error ?? "Não conseguimos gerar um novo Pix agora.");
      return;
    }

    setPixCopyPaste(result.pixCopyPaste ?? "");
    setPixQrCodeBase64(result.pixQrCodeBase64 ?? "");
    setPixExpiresAt(result.expiresAt ?? null);
    setShowRefreshAction(false);
    setMessage("Novo código Pix gerado. Pague dentro do prazo exibido.");
  };

  const handleCopyPix = async () => {
    if (!pixCopyPaste || isCopyingPix) {
      return;
    }

    setIsCopyingPix(true);
    const copied = await copyTextToClipboard(pixCopyPaste);
    setIsCopyingPix(false);

    if (!copied) {
      setError("Não conseguimos copiar automaticamente agora.");
      return;
    }

    setError("");
    setMessage("Código Pix copiado. Cole no app do seu banco para pagar.");
  };

  if (showConfirmedState || activeServiceRequest.status === "confirmed") {
    return (
      <div className="min-h-full bg-slate-50 px-4 py-6 sm:px-6">
        <div className="mx-auto flex min-h-[70dvh] w-full max-w-xl items-center">
          <motion.div
            initial={{ opacity: 0, y: 18, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            className="w-full rounded-[32px] border border-emerald-200 bg-white p-6 text-center shadow-sm sm:p-8"
          >
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
              <CheckCircle2 className="h-8 w-8" />
            </div>

            <h1 className="mt-5 text-2xl font-bold text-slate-900">
              Pagamento confirmado
            </h1>
            <p className="mt-4 text-sm font-semibold text-emerald-700">
              Abrindo a conversa do atendimento...
            </p>
          </motion.div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-full bg-slate-50 px-4 py-6 sm:px-6">
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-5">
        <div className="rounded-[30px] border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-slate-900">
                Confirme o atendimento
              </h1>
            </div>

            <button
              type="button"
              onClick={() => void handleClose()}
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-slate-200 bg-slate-50 text-slate-500 transition hover:bg-slate-100 hover:text-slate-700"
              aria-label="Cancelar pagamento"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="mt-5 space-y-3 rounded-[28px] border border-slate-200 bg-slate-50 p-4">
            {activeServiceRequest.details?.title ? (
              <div className="flex items-center justify-between gap-3 rounded-2xl bg-white px-4 py-3">
                <span className="text-sm font-medium text-slate-500">Acordo</span>
                <span className="text-right text-sm font-semibold text-slate-900">
                  {activeServiceRequest.details.title}
                </span>
              </div>
            ) : null}
            <div className="flex items-center justify-between gap-3 rounded-2xl bg-white px-4 py-3">
              <span className="text-sm font-medium text-slate-500">Valor do serviço</span>
              <span className="text-sm font-semibold text-slate-900">
                {formatCurrencyAmount(baseServiceAmount)}
              </span>
            </div>
            <div className="flex items-center justify-between gap-3 rounded-2xl bg-white px-4 py-3">
              <span className="text-sm font-medium text-slate-500">Taxa do app (10%)</span>
              <span className="text-sm font-semibold text-slate-900">
                {formatCurrencyAmount(appFeeAmount)}
              </span>
            </div>
            <div className="flex items-center justify-between gap-3 rounded-2xl bg-white px-4 py-3">
              <span className="text-sm font-medium text-slate-500">
                Taxa de intermediação Worko
              </span>
              <span className="text-sm font-semibold text-slate-900">
                {formatCurrencyAmount(asaasFeeAmount)}
              </span>
            </div>
            <div className="flex items-center justify-between gap-3 rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3">
              <span className="text-sm font-semibold text-blue-700">Total para pagar</span>
              <span className="text-base font-bold text-slate-900">
                {formatCurrencyAmount(totalPaymentAmount)}
              </span>
            </div>
          </div>
        </div>

        <div className="rounded-[32px] border border-slate-200 bg-white p-5 shadow-sm sm:p-8">
          <div className="grid gap-5 lg:grid-cols-[0.95fr_1.05fr]">
            <div className="rounded-[28px] border border-slate-200 bg-slate-50 p-5 text-center">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-white text-slate-500 shadow-sm">
                <QrCode className="h-7 w-7" />
              </div>

              {qrCodeImage ? (
                <img
                  src={qrCodeImage}
                  alt="QR Code Pix"
                  className="mx-auto mt-5 w-full max-w-[240px] rounded-[24px] border border-slate-200 bg-white p-4"
                />
              ) : (
                <div className="mt-5 rounded-[24px] border border-dashed border-slate-300 bg-white px-4 py-10 text-sm text-slate-500">
                  {isLoadingPayment ? "Carregando..." : "QR Code indisponível"}
                </div>
              )}
            </div>

            <div className="rounded-[28px] border border-slate-200 bg-slate-50 p-5">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                Copia e cola Pix
              </p>
              {pixRemainingLabel ? (
                <div className="mt-2 inline-flex items-center rounded-full bg-blue-50 px-3 py-1 text-xs font-bold text-blue-700">
                  Expira em {pixRemainingLabel}
                </div>
              ) : null}
              <div className="mt-3 rounded-[24px] border border-slate-200 bg-white p-4">
                <textarea
                  readOnly
                  value={pixCopyPaste}
                  rows={8}
                  placeholder={
                    isLoadingPayment
                      ? "Carregando..."
                      : "Código Pix indisponível"
                  }
                  className="w-full resize-none border-none bg-transparent text-sm leading-6 text-slate-700 outline-none"
                />
              </div>

              <button
                type="button"
                onClick={handleCopyPix}
                disabled={!pixCopyPaste || isCopyingPix}
                className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-[24px] bg-blue-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-70"
              >
                <Copy className="h-4 w-4" />
                {isCopyingPix ? "Copiando..." : "Copiar código Pix"}
              </button>

              {showRefreshAction ? (
                <button
                  type="button"
                  onClick={() =>
                    void (isPixExpired
                      ? handleRenewPayment()
                      : handleRefreshPayment())
                  }
                  disabled={isRefreshingPayment || isLoadingPayment}
                  className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-[24px] border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-70"
                >
                  <RefreshCcw
                    className={`h-4 w-4 ${
                      isRefreshingPayment || isLoadingPayment ? "animate-spin" : ""
                    }`}
                  />
                  {isLoadingPayment
                    ? "Gerando..."
                    : isRefreshingPayment
                      ? "Verificando..."
                      : isPixExpired
                        ? "Gerar novo Pix"
                        : "Atualizar pagamento"}
                </button>
              ) : null}
            </div>
          </div>

          {message ? (
            <div className="mt-5 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
              {message}
            </div>
          ) : null}

          {error ? (
            <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
              {error}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

