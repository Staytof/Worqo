import { useEffect, useRef, useState, type ChangeEvent } from "react";
import { AnimatePresence, motion } from "motion/react";
import {
  CalendarDays,
  Camera,
  CheckCircle2,
  Clock3,
  MapPin,
  ShieldAlert,
  Star,
  X,
} from "lucide-react";
import { useErrorToast } from "../../hooks/useErrorToast";
import { requestNativeCameraPermission } from "../../lib/nativeMediaPermissions";
import type { ActiveServiceRequest, ServiceReviewPayload } from "../../types";
import { formatDelayTolerance, formatServiceDate } from "../../utils/helpers";
import { readImageAsOptimizedDataUrl } from "../../utils/helpers";
import { ServiceTimeline } from "./ServiceTimeline";

function getVisibleServiceLocation(request: ActiveServiceRequest) {
  if (request.currentUserRole !== "requester" && !request.exactLocationVisible) {
    return "Local protegido pelo Worko";
  }

  if (!request.details) {
    return request.locationLabel || "";
  }

  const visibleAddress =
    request.details.address || request.details.locationLabel || request.locationLabel || "";

  if (request.details.locationMode === "residence") {
    return visibleAddress || "Endereço do perfil";
  }

  return visibleAddress || "Local combinado no chat";
}

function getServiceStatusLabel(request: ActiveServiceRequest) {
  if (request.status === "searching") {
    return "Buscando profissionais";
  }

  if (request.status === "assigned") {
    return request.currentUserRole === "worker" ? "Solicitação assumida" : "Etapa em andamento";
  }

  if (request.status === "interest-received") {
    return "Profissional aguardando seu aceite";
  }

  if (request.status === "chatting") {
    return "Conversa em andamento";
  }

  if (request.status === "details") {
    return "Preencher detalhes";
  }

  if (request.status === "waiting-worker") {
    return "Aguardando confirmação";
  }

  if (request.status === "payment") {
    return "Pronto para pagamento";
  }

  if (request.status === "confirmed") {
    return "Atendimento confirmado";
  }

  return "Etapa em andamento";
}

function getPrimaryActionLabel(request: ActiveServiceRequest) {
  if (request.status === "chatting") {
    return "Ir para o chat";
  }

  if (request.status === "details") {
    return request.currentUserRole === "requester" ? "Preencher detalhes" : "Ir para o chat";
  }

  if (request.status === "waiting-worker") {
    return request.currentUserRole === "requester" ? "Acompanhar etapa" : "Revisar detalhes";
  }

  if (request.status === "payment") {
    return request.currentUserRole === "requester" ? "Ir para pagamento" : "Ver conversa";
  }

  if (request.status === "confirmed") {
    return "Ir para o chat";
  }

  return "Abrir fluxo";
}

function hasWorkerArrivalEvent(request: ActiveServiceRequest) {
  return request.timeline.some((event) => event.kind === "worker-arrived");
}

type ActiveRequestSheetProps = {
  request: ActiveServiceRequest | null;
  isOpen: boolean;
  isAcceptingWorker: boolean;
  isDecliningWorker: boolean;
  isCancellingRequest: boolean;
  errorMessage: string;
  onClose: () => void;
  onOpenFlow: () => void;
  onCancelRequest: () => void;
  onAcceptWorker: () => void;
  onDeclineWorker: (options?: { blockWorkerForTenMinutes?: boolean }) => void;
  isMarkingWorkerArrived: boolean;
  onMarkWorkerArrived: () => Promise<{ ok: boolean; error?: string }>;
  onReleasePayment: (payload: ServiceReviewPayload) => Promise<{ ok: boolean; error?: string }>;
  onOpenDispute: (reason: string) => Promise<{ ok: boolean; error?: string }>;
  onReportNoShow: (payload: {
    reason: string;
    evidenceImage?: string | null;
  }) => Promise<{ ok: boolean; error?: string }>;
  onRespondNoShow: (payload: {
    response: string;
    acknowledgesNoShow: boolean;
  }) => Promise<{ ok: boolean; error?: string }>;
};

export function ActiveRequestSheet({
  request,
  isOpen,
  isAcceptingWorker,
  isDecliningWorker,
  isCancellingRequest,
  errorMessage,
  onClose,
  onOpenFlow,
  onCancelRequest,
  onAcceptWorker,
  onDeclineWorker,
  isMarkingWorkerArrived,
  onMarkWorkerArrived,
  onReleasePayment,
  onOpenDispute,
  onReportNoShow,
  onRespondNoShow,
}: ActiveRequestSheetProps) {
  const noShowEvidenceInputRef = useRef<HTMLInputElement | null>(null);
  const [isReviewFormOpen, setIsReviewFormOpen] = useState(false);
  const [reviewRating, setReviewRating] = useState(0);
  const [reviewComment, setReviewComment] = useState("");
  const [reviewError, setReviewError] = useState("");
  const [isReleasingPayment, setIsReleasingPayment] = useState(false);
  const [isDisputeFormOpen, setIsDisputeFormOpen] = useState(false);
  const [disputeReason, setDisputeReason] = useState("");
  const [disputeError, setDisputeError] = useState("");
  const [isOpeningDispute, setIsOpeningDispute] = useState(false);
  const [isNoShowFormOpen, setIsNoShowFormOpen] = useState(false);
  const [noShowReason, setNoShowReason] = useState("");
  const [noShowEvidenceImage, setNoShowEvidenceImage] = useState<string | null>(null);
  const [noShowError, setNoShowError] = useState("");
  const [isSubmittingNoShow, setIsSubmittingNoShow] = useState(false);
  const [providerResponse, setProviderResponse] = useState("");
  const [isRespondingNoShow, setIsRespondingNoShow] = useState(false);
  const [currentTimestamp, setCurrentTimestamp] = useState(() => Date.now());
  useErrorToast(reviewError);
  useErrorToast(disputeError);
  useErrorToast(noShowError);

  useEffect(() => {
    if (!isOpen) {
      setIsReviewFormOpen(false);
      setIsDisputeFormOpen(false);
      setReviewError("");
      setDisputeError("");
      setIsNoShowFormOpen(false);
      setNoShowError("");
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return undefined;
    setCurrentTimestamp(Date.now());
    const intervalId = window.setInterval(() => setCurrentTimestamp(Date.now()), 30_000);
    return () => window.clearInterval(intervalId);
  }, [isOpen]);

  if (!request || !isOpen) {
    return null;
  }

  const hasWorkerArrived = hasWorkerArrivalEvent(request);
  const isNoShowClaim = request.dispute?.kind === "provider-no-show";
  const noShowEligibleTimestamp = request.noShowEligibleAt
    ? new Date(request.noShowEligibleAt).getTime()
    : Number.NaN;
  const canReportNoShow = Boolean(
    request.currentUserRole === "requester" &&
      request.status === "confirmed" &&
      !request.dispute?.status &&
      !hasWorkerArrived &&
      Number.isFinite(noShowEligibleTimestamp) &&
      currentTimestamp >= noShowEligibleTimestamp
  );

  const handleNoShowEvidence = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    try {
      const image = await readImageAsOptimizedDataUrl(file, {
        maxDimension: 960,
        quality: 0.72,
      });
      setNoShowEvidenceImage(image);
      setNoShowError("");
    } catch (error) {
      setNoShowError(error instanceof Error ? error.message : "Não conseguimos anexar a foto.");
    }
  };

  const handleOpenNoShowEvidencePicker = async () => {
    const allowed = await requestNativeCameraPermission();

    if (!allowed) {
      setNoShowError("Ative a permissão da câmera para anexar uma foto.");
      return;
    }

    noShowEvidenceInputRef.current?.click();
  };

  const handleReportNoShow = async () => {
    if (noShowReason.trim().length < 12) {
      setNoShowError("Explique o que aconteceu em pelo menos 12 caracteres.");
      return;
    }

    setIsSubmittingNoShow(true);
    setNoShowError("");
    const result = await onReportNoShow({
      reason: noShowReason.trim(),
      evidenceImage: noShowEvidenceImage,
    });
    setIsSubmittingNoShow(false);

    if (!result.ok) {
      setNoShowError(result.error ?? "Não conseguimos solicitar o ressarcimento agora.");
      return;
    }

    setIsNoShowFormOpen(false);
    setNoShowReason("");
    setNoShowEvidenceImage(null);
  };

  const handleRespondNoShow = async (acknowledgesNoShow: boolean) => {
    if (!acknowledgesNoShow && providerResponse.trim().length < 12) {
      setNoShowError("Explique sua versão em pelo menos 12 caracteres.");
      return;
    }

    setIsRespondingNoShow(true);
    setNoShowError("");
    const result = await onRespondNoShow({
      acknowledgesNoShow,
      response: acknowledgesNoShow
        ? providerResponse.trim() || "Confirmo que não compareci ao atendimento."
        : providerResponse.trim(),
    });
    setIsRespondingNoShow(false);

    if (!result.ok) {
      setNoShowError(result.error ?? "Não conseguimos registrar sua resposta agora.");
      return;
    }

    setProviderResponse("");
    if (acknowledgesNoShow) onClose();
  };

  const handleReleasePayment = async () => {
    if (!hasWorkerArrivalEvent(request)) {
      setReviewError("Confirme a chegada do(a) prestador(a) antes de liberar o pagamento.");
      return;
    }

    if (reviewRating < 1 || reviewRating > 5) {
      setReviewError("Selecione uma nota de 1 a 5 estrelas.");
      return;
    }

    if (reviewComment.trim().length < 8) {
      setReviewError("Escreva uma breve avaliação sobre o serviço.");
      return;
    }

    setIsReleasingPayment(true);
    setReviewError("");
    const result = await onReleasePayment({
      rating: reviewRating,
      comment: reviewComment.trim(),
    });
    setIsReleasingPayment(false);

    if (!result.ok) {
      setReviewError(result.error ?? "Não conseguimos liberar o pagamento agora.");
      return;
    }

    setIsReviewFormOpen(false);
    setReviewRating(0);
    setReviewComment("");
    onClose();
  };

  const handleMarkWorkerArrived = async () => {
    setReviewError("");
    const result = await onMarkWorkerArrived();

    if (!result.ok) {
      setReviewError(result.error ?? "Não conseguimos registrar a chegada agora.");
    }
  };

  const handleOpenDispute = async () => {
    if (disputeReason.trim().length < 12) {
      setDisputeError("Explique em poucas palavras o motivo da disputa.");
      return;
    }

    setIsOpeningDispute(true);
    setDisputeError("");
    const result = await onOpenDispute(disputeReason.trim());
    setIsOpeningDispute(false);

    if (!result.ok) {
      setDisputeError(result.error ?? "Não conseguimos abrir a disputa agora.");
      return;
    }

    setIsDisputeFormOpen(false);
    setDisputeReason("");
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="worqo-fullscreen-sheet z-[85]"
      >
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 24 }}
          transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
          onClick={(event) => event.stopPropagation()}
          className="worqo-fullscreen-panel custom-scrollbar"
        >
          <div className="worqo-fullscreen-content">
            <div className="worqo-fullscreen-header">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <h2 className="text-2xl font-bold text-slate-900">{request.type}</h2>
                  <p className="mt-2 text-sm leading-relaxed text-slate-500">
                    {request.description}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={onClose}
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-blue-100 bg-white text-slate-500 transition hover:bg-blue-50 hover:text-blue-700"
                  aria-label="Fechar solicitação"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="mt-4 flex flex-wrap items-center gap-2">
                <span className="rounded-full border border-blue-200 bg-blue-50 px-3 py-1.5 text-[11px] font-semibold text-blue-700">
                  {getServiceStatusLabel(request)}
                </span>
                <span className="text-xs text-slate-400">{request.createdAtLabel}</span>
              </div>

              {request.currentUserRole === "requester" && request.workerName ? (
                <p className="mt-3 text-sm text-slate-600">Profissional: {request.workerName}</p>
              ) : null}

              {request.currentUserRole === "worker" && request.status === "confirmed" ? (
                <p className="mt-3 text-sm text-slate-600">Cliente: {request.requesterName}</p>
              ) : null}
            </div>

            <div className="pt-6">
              {request.details ? (
                <section className="worqo-section">
                  {request.details.title ? (
                    <div className="mb-3 worqo-flat-panel px-4 py-3">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">
                        Acordo
                      </p>
                      <p className="mt-1 text-sm font-semibold text-slate-900">
                        {request.details.title}
                      </p>
                    </div>
                  ) : null}
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="worqo-flat-panel px-4 py-3">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">
                        Valor
                      </p>
                      <p className="mt-1 text-sm font-semibold text-slate-900">
                        {request.details.price}
                      </p>
                    </div>
                    <div className="worqo-flat-panel px-4 py-3">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">
                        Data
                      </p>
                      <p className="mt-1 text-sm font-semibold text-slate-900">
                        {formatServiceDate(request.details.serviceDate, "medium") ||
                          "Não informada"}
                      </p>
                    </div>
                    <div className="worqo-flat-panel px-4 py-3">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">
                        Horário
                      </p>
                      <p className="mt-1 text-sm font-semibold text-slate-900">
                        {request.details.schedule}
                      </p>
                    </div>
                    <div className="worqo-flat-panel px-4 py-3">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">
                        Tolerância
                      </p>
                      <p className="mt-1 text-sm font-semibold text-slate-900">
                        {formatDelayTolerance(request.details.delayToleranceMinutes)}
                      </p>
                    </div>
                  </div>

                  <div className="mt-3 worqo-flat-panel px-4 py-3">
                    <div className="flex items-start gap-3">
                      <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-slate-500" />
                      <div>
                        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">
                          Local
                        </p>
                        <p className="mt-1 text-sm font-semibold text-slate-900">
                          {getVisibleServiceLocation(request)}
                        </p>
                      </div>
                    </div>
                  </div>

                  {request.status === "confirmed" ? (
                    <div className="mt-4 worqo-flat-panel worqo-flat-panel--blue px-4 py-3 text-sm font-semibold text-blue-900">
                      <div className="flex items-center gap-3">
                        <CalendarDays className="h-5 w-5 shrink-0 text-blue-600" />
                        Confirmado
                      </div>
                    </div>
                  ) : null}
                </section>
              ) : null}

              {request.dispute?.status ? (
                <section className="worqo-section">
                  <div
                    className={`worqo-flat-panel px-4 py-4 text-sm ${
                      request.dispute.status === "open"
                        ? "border-rose-200 bg-rose-50 text-rose-900"
                        : "border-blue-200 bg-blue-50 text-blue-900"
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0" />
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold">
                          {isNoShowClaim
                            ? request.dispute.status === "open"
                              ? "Ressarcimento em análise"
                              : "Ressarcimento resolvido"
                            : request.dispute.status === "open"
                              ? "Disputa em análise"
                              : "Disputa resolvida"}
                        </p>
                        <p className="mt-1 leading-relaxed">
                          {request.dispute.reason ||
                            "O suporte registrou uma atualização para este atendimento."}
                        </p>

                        {isNoShowClaim && request.dispute.evidenceImage ? (
                          <img
                            src={request.dispute.evidenceImage}
                            alt="Evidência enviada pelo cliente"
                            className="mt-3 max-h-48 w-full rounded-2xl border border-rose-200 object-cover"
                          />
                        ) : null}

                        {isNoShowClaim && request.dispute.responseDueAt ? (
                          <div className="mt-3 flex items-start gap-2 rounded-2xl bg-white/70 px-3 py-2 text-xs font-semibold leading-relaxed">
                            <Clock3 className="mt-0.5 h-4 w-4 shrink-0" />
                            <span>
                              Prazo de resposta do prestador:{" "}
                              {new Intl.DateTimeFormat("pt-BR", {
                                day: "2-digit",
                                month: "2-digit",
                                hour: "2-digit",
                                minute: "2-digit",
                              }).format(new Date(request.dispute.responseDueAt))}.
                            </span>
                          </div>
                        ) : null}

                        {isNoShowClaim && request.dispute.providerResponse ? (
                          <div className="mt-3 rounded-2xl bg-white/80 px-3 py-3">
                            <p className="text-[10px] font-black uppercase tracking-[0.14em] opacity-70">
                              Resposta do prestador
                            </p>
                            <p className="mt-1 leading-relaxed">
                              {request.dispute.providerResponse}
                            </p>
                          </div>
                        ) : null}

                        {isNoShowClaim &&
                        request.dispute.status === "open" &&
                        request.currentUserRole === "worker" &&
                        !request.dispute.providerRespondedAt ? (
                          <div className="mt-4 rounded-2xl border border-rose-200 bg-white p-3">
                            <p className="text-xs font-black text-slate-900">
                              Responda antes do prazo
                            </p>
                            <textarea
                              value={providerResponse}
                              onChange={(event) =>
                                setProviderResponse(event.target.value.slice(0, 500))
                              }
                              rows={3}
                              placeholder="Explique sua versão ou confirme que não compareceu."
                              className="mt-2 w-full resize-none rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700 outline-none focus:border-blue-500"
                            />
                            <div className="mt-2 grid gap-2 sm:grid-cols-2">
                              <button
                                type="button"
                                disabled={isRespondingNoShow}
                                onClick={() => void handleRespondNoShow(false)}
                                className="rounded-xl bg-blue-600 px-3 py-2.5 text-xs font-black text-white disabled:opacity-60"
                              >
                                Contestar ausência
                              </button>
                              <button
                                type="button"
                                disabled={isRespondingNoShow}
                                onClick={() => void handleRespondNoShow(true)}
                                className="rounded-xl bg-rose-600 px-3 py-2.5 text-xs font-black text-white disabled:opacity-60"
                              >
                                Confirmar que não fui
                              </button>
                            </div>
                          </div>
                        ) : null}

                        {noShowError ? (
                          <p className="mt-3 rounded-xl bg-white px-3 py-2 text-xs font-semibold text-rose-700">
                            {noShowError}
                          </p>
                        ) : null}
                      </div>
                    </div>
                  </div>
                </section>
              ) : null}

              {errorMessage ? (
                <section className="worqo-section">
                  <div className="worqo-flat-panel worqo-flat-panel--rose px-4 py-3 text-sm text-rose-700">
                    {errorMessage}
                  </div>
                </section>
              ) : null}

              {request.timeline.length > 0 ? (
                <section className="worqo-section">
                  <ServiceTimeline timeline={request.timeline} />
                </section>
              ) : null}

              <section className="worqo-section">
                {request.status === "interest-received" ? (
                  <div className="grid gap-3">
                    <button
                      type="button"
                      onClick={onAcceptWorker}
                      disabled={isAcceptingWorker || isDecliningWorker}
                      className="rounded-[24px] bg-blue-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-70"
                    >
                      {isAcceptingWorker ? "Abrindo..." : "Abrir conversa"}
                    </button>
                    <button
                      type="button"
                      onClick={() => onDeclineWorker()}
                      disabled={isAcceptingWorker || isDecliningWorker}
                      className="rounded-[24px] border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-600 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-70"
                    >
                      {isDecliningWorker ? "Buscando..." : "Continuar buscando"}
                    </button>
                    <button
                      type="button"
                      onClick={() => onDeclineWorker({ blockWorkerForTenMinutes: true })}
                      disabled={isAcceptingWorker || isDecliningWorker}
                      className="rounded-[24px] border border-rose-100 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700 transition hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-70"
                    >
                      {isDecliningWorker ? "Recusando..." : "Recusar por 10 minutos"}
                    </button>
                  </div>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {request.status !== "searching" &&
                    !(request.status === "assigned" && request.currentUserRole === "worker") ? (
                      <button
                        type="button"
                        onClick={onOpenFlow}
                        className="rounded-[24px] bg-blue-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-blue-700"
                      >
                        {getPrimaryActionLabel(request)}
                      </button>
                    ) : null}

                    {request.status === "confirmed" &&
                    request.currentUserRole === "requester" ? (
                      <>
                        {hasWorkerArrived ? (
                          <span className="inline-flex items-center justify-center gap-2 rounded-[24px] bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700">
                            <CheckCircle2 className="h-4 w-4" />
                            Chegada registrada
                          </span>
                        ) : (
                          <button
                            type="button"
                            onClick={() => void handleMarkWorkerArrived()}
                            disabled={isMarkingWorkerArrived || request.dispute?.status === "open"}
                            className="rounded-[24px] bg-blue-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-wait disabled:opacity-70"
                          >
                            {isMarkingWorkerArrived
                              ? "Registrando..."
                              : "O(a) prestador(a) chegou?"}
                          </button>
                        )}

                        <button
                          type="button"
                          onClick={() => {
                            if (!hasWorkerArrived) {
                              setReviewError(
                                "Confirme a chegada do(a) prestador(a) antes de liberar o pagamento."
                              );
                              return;
                            }

                            setDisputeError("");
                            setIsDisputeFormOpen(false);
                            setReviewError("");
                            setIsReviewFormOpen((current) => !current);
                          }}
                          disabled={
                            isReleasingPayment ||
                            !hasWorkerArrived ||
                            request.dispute?.status === "open"
                          }
                          className="rounded-[24px] border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700 transition hover:bg-emerald-100 disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-100 disabled:text-slate-400"
                          aria-label={isReviewFormOpen ? "Fechar avaliação" : "Liberar pagamento"}
                        >
                          {isReviewFormOpen ? <X className="mx-auto h-4 w-4" /> : "Liberar pagamento"}
                        </button>
                      </>
                    ) : null}

                    {canReportNoShow ? (
                      <button
                        type="button"
                        onClick={() => {
                          setReviewError("");
                          setIsReviewFormOpen(false);
                          setDisputeError("");
                          setIsDisputeFormOpen(false);
                          setNoShowError("");
                          setIsNoShowFormOpen((current) => !current);
                        }}
                        className="rounded-[24px] border border-rose-300 bg-rose-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-rose-700"
                      >
                        {isNoShowFormOpen ? (
                          <X className="mx-auto h-4 w-4" />
                        ) : (
                          "Prestador não compareceu"
                        )}
                      </button>
                    ) : null}

                    {request.status === "searching" ? (
                      <button
                        type="button"
                        onClick={onCancelRequest}
                        disabled={isCancellingRequest}
                        className="rounded-[24px] border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-600 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-70"
                      >
                        {isCancellingRequest ? "Atualizando..." : "Retirar do mapa"}
                      </button>
                    ) : null}

                    {["payment", "confirmed"].includes(request.status) &&
                    request.dispute?.status !== "open" ? (
                      <button
                        type="button"
                        onClick={() => {
                          setReviewError("");
                          setIsReviewFormOpen(false);
                          setDisputeError("");
                          setIsDisputeFormOpen((current) => !current);
                        }}
                        className="rounded-[24px] border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700 transition hover:bg-rose-100"
                        aria-label={isDisputeFormOpen ? "Fechar disputa" : "Abrir disputa"}
                      >
                        {isDisputeFormOpen ? <X className="mx-auto h-4 w-4" /> : "Abrir disputa"}
                      </button>
                    ) : null}
                  </div>
                )}

                {isNoShowFormOpen ? (
                  <div className="mt-5 worqo-flat-panel worqo-flat-panel--rose px-4 py-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-rose-700">
                          Proteção do cliente
                        </p>
                        <h3 className="mt-2 text-xl font-bold text-slate-900">
                          Solicitar ressarcimento integral
                        </h3>
                      </div>
                      <button
                        type="button"
                        onClick={() => setIsNoShowFormOpen(false)}
                        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-rose-200 bg-white text-rose-700"
                        aria-label="Fechar solicitação de ressarcimento"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>

                    <p className="mt-3 text-sm leading-relaxed text-slate-600">
                      Use esta opção somente se o horário e toda a tolerância já terminaram e o
                      prestador realmente não apareceu. O pagamento ficará bloqueado durante a
                      análise.
                    </p>

                    <textarea
                      value={noShowReason}
                      onChange={(event) => setNoShowReason(event.target.value.slice(0, 320))}
                      rows={4}
                      placeholder="Explique há quanto tempo está aguardando e se tentou falar pelo chat."
                      className="mt-4 w-full resize-none rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 outline-none focus:border-rose-400"
                    />

                    <input
                      ref={noShowEvidenceInputRef}
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      capture="environment"
                      className="hidden"
                      onChange={(event) => void handleNoShowEvidence(event)}
                    />

                    {noShowEvidenceImage ? (
                      <div className="mt-3 overflow-hidden rounded-2xl border border-slate-200 bg-white">
                        <img
                          src={noShowEvidenceImage}
                          alt="Evidência selecionada"
                          className="max-h-44 w-full object-cover"
                        />
                        <button
                          type="button"
                          onClick={() => setNoShowEvidenceImage(null)}
                          className="w-full px-3 py-2 text-xs font-black text-rose-700"
                        >
                          Remover foto
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => void handleOpenNoShowEvidencePicker()}
                        className="mt-3 flex h-11 w-full items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white text-xs font-black text-slate-700"
                      >
                        <Camera className="h-4 w-4 text-blue-600" />
                        Anexar foto opcional
                      </button>
                    )}

                    <div className="mt-3 rounded-2xl bg-white px-3 py-3 text-xs font-semibold leading-relaxed text-slate-600">
                      Se aprovado, o cliente recebe o valor do serviço e todas as taxas pagas. O
                      Worko não retém nenhuma taxa quando o serviço não aconteceu.
                    </div>

                    {noShowError ? (
                      <p className="mt-3 text-sm font-semibold text-rose-700">{noShowError}</p>
                    ) : null}

                    <button
                      type="button"
                      onClick={() => void handleReportNoShow()}
                      disabled={isSubmittingNoShow}
                      className="mt-4 inline-flex w-full items-center justify-center rounded-[24px] bg-rose-600 px-4 py-3 text-sm font-semibold text-white disabled:opacity-60"
                    >
                      {isSubmittingNoShow ? "Enviando..." : "Solicitar ressarcimento integral"}
                    </button>
                  </div>
                ) : null}

                {isReviewFormOpen ? (
                  <div className="mt-5 worqo-flat-panel worqo-flat-panel--emerald px-4 py-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-emerald-700">
                          Avaliação final
                        </p>
                        <h3 className="mt-2 text-xl font-bold text-slate-900">
                          Liberar pagamento
                        </h3>
                      </div>
                      <button
                        type="button"
                        onClick={() => setIsReviewFormOpen(false)}
                        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-emerald-200 bg-white text-emerald-700 transition hover:bg-emerald-50"
                        aria-label="Fechar avaliação"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>

                    <div className="mt-5 flex gap-2">
                      {Array.from({ length: 5 }).map((_, index) => {
                        const value = index + 1;
                        return (
                          <button
                            key={value}
                            type="button"
                            onClick={() => setReviewRating(value)}
                            className={`flex h-12 w-12 items-center justify-center rounded-full border transition ${
                              reviewRating >= value
                                ? "border-amber-300 bg-amber-50 text-amber-500"
                                : "border-slate-200 bg-white text-slate-300"
                            }`}
                          >
                            <Star className="h-5 w-5" fill="currentColor" />
                          </button>
                        );
                      })}
                    </div>

                    <textarea
                      value={reviewComment}
                      onChange={(event) => setReviewComment(event.target.value)}
                      rows={4}
                      placeholder="Conte rapidamente como foi o serviço."
                      className="mt-4 w-full resize-none rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 outline-none focus:border-blue-500"
                    />

                    {reviewError ? (
                      <div className="mt-4 worqo-flat-panel worqo-flat-panel--rose px-4 py-3 text-sm text-rose-700">
                        {reviewError}
                      </div>
                    ) : null}

                    <button
                      type="button"
                      onClick={() => void handleReleasePayment()}
                      disabled={isReleasingPayment}
                      className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-[24px] bg-emerald-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-70"
                    >
                      <CheckCircle2 className="h-4 w-4" />
                      {isReleasingPayment ? "Liberando..." : "Confirmar e liberar pagamento"}
                    </button>
                  </div>
                ) : null}

                {isDisputeFormOpen ? (
                  <div className="mt-5 worqo-flat-panel worqo-flat-panel--rose px-4 py-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-rose-700">
                          Disputa
                        </p>
                        <h3 className="mt-2 text-xl font-bold text-slate-900">
                          Abrir disputa do atendimento
                        </h3>
                      </div>
                      <button
                        type="button"
                        onClick={() => setIsDisputeFormOpen(false)}
                        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-rose-200 bg-white text-rose-700 transition hover:bg-rose-50"
                        aria-label="Fechar disputa"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>

                    <textarea
                      value={disputeReason}
                      onChange={(event) => setDisputeReason(event.target.value)}
                      rows={4}
                      placeholder="Explique o motivo da disputa."
                      className="mt-4 w-full resize-none rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 outline-none focus:border-blue-500"
                    />

                    {disputeError ? (
                      <div className="mt-4 worqo-flat-panel worqo-flat-panel--rose px-4 py-3 text-sm text-rose-700">
                        {disputeError}
                      </div>
                    ) : null}

                    <button
                      type="button"
                      onClick={() => void handleOpenDispute()}
                      disabled={isOpeningDispute}
                      className="mt-5 inline-flex w-full items-center justify-center rounded-[24px] bg-rose-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-70"
                    >
                      {isOpeningDispute ? "Abrindo..." : "Confirmar disputa"}
                    </button>
                  </div>
                ) : null}
              </section>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}


