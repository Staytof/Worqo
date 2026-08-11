import { useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
import {
  AlertTriangle,
  ArrowRight,
  Banknote,
  CalendarDays,
  Camera,
  CheckCircle2,
  ClipboardList,
  Clock3,
  MessageCircle,
  ShieldAlert,
  ShieldCheck,
  Star,
  Trash2,
  UserRound,
  X,
} from "lucide-react";
import { Navigate, useNavigate } from "react-router";
import { apiRequest } from "../api/client";
import { useApp } from "../context/AppContext";
import { useErrorToast } from "../hooks/useErrorToast";
import { requestNativeCameraPermission } from "../lib/nativeMediaPermissions";
import type { ActiveServiceRequest, PublicUserProfile, ServiceReviewPayload } from "../types";
import {
  formatCurrencyAmount,
  formatDelayTolerance,
  formatServiceDate,
  getInitials,
  readImageAsOptimizedDataUrl,
} from "../utils/helpers";
import { ServiceTimeline } from "./service/ServiceTimeline";
import { VerifiedBadge } from "./ui/verified-badge";

const activeStatuses = new Set<ActiveServiceRequest["status"]>([
  "searching",
  "assigned",
  "interest-received",
  "chatting",
  "details",
  "waiting-worker",
  "payment",
  "confirmed",
]);

function formatStatusLabel(status: ActiveServiceRequest["status"]) {
  switch (status) {
    case "searching":
      return "Buscando";
    case "assigned":
    case "interest-received":
      return "Interessado";
    case "chatting":
      return "Em conversa";
    case "details":
      return "Ajustando acordo";
    case "waiting-worker":
      return "Aguardando aceite";
    case "payment":
      return "Pagamento";
    case "confirmed":
      return "Pago e em andamento";
    default:
      return "Ativo";
  }
}

function getPrimaryActionLabel(request: ActiveServiceRequest) {
  if (request.status === "payment") return "Pagar agora";
  if (request.status === "waiting-worker") return "Ver acordo";
  if (request.status === "details") return "Completar acordo";
  if (request.status === "confirmed") return "Abrir conversa";
  if (request.chatId) return "Abrir conversa";
  return "Acompanhar";
}

function formatCreatedAt(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Agora";

  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function formatPaymentAmount(request: ActiveServiceRequest) {
  if (request.payment?.totalCents) {
    return formatCurrencyAmount(request.payment.totalCents / 100);
  }

  return request.details?.price || "Aguardando";
}

function getVisibleLocation(request: ActiveServiceRequest) {
  if (!request.details) return request.locationLabel || "Local protegido";
  if (request.details.locationMode === "residence") return request.details.address || "Endereço do perfil";
  return request.details.address || "Local combinado no chat";
}

function hasWorkerArrivalEvent(request: ActiveServiceRequest) {
  return (Array.isArray(request.timeline) ? request.timeline : []).some(
    (event) => event?.kind === "worker-arrived"
  );
}

export function ClientOrders() {
  const navigate = useNavigate();
  const {
    state: { activeServiceRequest, sessionToken, user },
    acceptWorkerInterest,
    declineWorkerInterest,
    deleteActiveServiceRequest,
    openChat,
    openServiceDispute,
    reportProviderNoShow,
    markWorkerArrived,
    releaseServicePayment,
    listCompletedServiceRequests,
  } = useApp();
  const [workerProfile, setWorkerProfile] = useState<PublicUserProfile | null>(null);
  const [error, setError] = useState("");
  const [isAccepting, setIsAccepting] = useState(false);
  const [isDeclining, setIsDeclining] = useState(false);
  const [isRemoving, setIsRemoving] = useState(false);
  const [isRemoveConfirmOpen, setIsRemoveConfirmOpen] = useState(false);
  const [isReviewOpen, setIsReviewOpen] = useState(false);
  const [reviewRating, setReviewRating] = useState(0);
  const [reviewComment, setReviewComment] = useState("");
  const [isMarkingArrival, setIsMarkingArrival] = useState(false);
  const [isReleasing, setIsReleasing] = useState(false);
  const [isDisputeOpen, setIsDisputeOpen] = useState(false);
  const [disputeReason, setDisputeReason] = useState("");
  const [isOpeningDispute, setIsOpeningDispute] = useState(false);
  const noShowEvidenceInputRef = useRef<HTMLInputElement | null>(null);
  const [isNoShowOpen, setIsNoShowOpen] = useState(false);
  const [noShowReason, setNoShowReason] = useState("");
  const [noShowEvidenceImage, setNoShowEvidenceImage] = useState<string | null>(null);
  const [isReportingNoShow, setIsReportingNoShow] = useState(false);
  const [currentTimestamp, setCurrentTimestamp] = useState(() => Date.now());
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [completedRequests, setCompletedRequests] = useState<ActiveServiceRequest[]>([]);
  useErrorToast(error);

  const request =
    activeServiceRequest?.currentUserRole === "requester" &&
    activeStatuses.has(activeServiceRequest.status)
      ? activeServiceRequest
      : null;
  const hasWorker = Boolean(request?.workerId || request?.workerName);
  const workerName = workerProfile?.fullName ?? request?.workerName ?? "Prestador(a)";
  const workerProfession = workerProfile?.professions?.[0] ?? workerProfile?.headline?.trim() ?? "Prestador(a) Worko";
  const timeline = useMemo(
    () => (Array.isArray(request?.timeline) ? request.timeline : []),
    [request?.timeline]
  );
  const hasWorkerArrived = request ? hasWorkerArrivalEvent(request) : false;
  const noShowEligibleTimestamp = request?.noShowEligibleAt
    ? new Date(request.noShowEligibleAt).getTime()
    : Number.NaN;
  const canReportNoShow = Boolean(
    request?.status === "confirmed" &&
      !request.dispute?.status &&
      !hasWorkerArrived &&
      Number.isFinite(noShowEligibleTimestamp) &&
      currentTimestamp >= noShowEligibleTimestamp
  );

  useEffect(() => {
    const intervalId = window.setInterval(() => setCurrentTimestamp(Date.now()), 30_000);
    return () => window.clearInterval(intervalId);
  }, []);

  useEffect(() => {
    if (!request?.workerId || !sessionToken) {
      setWorkerProfile(null);
      return;
    }

    let cancelled = false;
    void apiRequest<{ profile: PublicUserProfile }>(
      `/api/users/${encodeURIComponent(request.workerId)}/profile`,
      { token: sessionToken }
    )
      .then((response) => {
        if (!cancelled) setWorkerProfile(response.profile);
      })
      .catch(() => {
        if (!cancelled) setWorkerProfile(null);
      });

    return () => {
      cancelled = true;
    };
  }, [request?.workerId, sessionToken]);

  if (user?.accountKind !== "client") {
    return <Navigate to="/app" replace />;
  }

  const handleOpenFlow = () => {
    if (!request) return;

    if (request.status === "payment") {
      navigate("/app/service/payment");
      return;
    }

    if (request.status === "waiting-worker") {
      navigate("/app/service/waiting");
      return;
    }

    if (request.status === "details") {
      navigate("/app/service/details");
      return;
    }

    if (request.status === "searching" || request.status === "interest-received") {
      navigate("/app/service/request");
      return;
    }

    if (request.chatId) {
      openChat(request.chatId);
      navigate("/app/chat");
      return;
    }

    navigate("/app/service/request");
  };

  const handleAcceptWorker = async () => {
    if (!request || isAccepting) return;

    setError("");
    setIsAccepting(true);
    const result = await acceptWorkerInterest();
    setIsAccepting(false);

    if (!result.ok) {
      setError(result.error ?? "Não conseguimos aceitar este(a) prestador(a) agora.");
      return;
    }

    if (result.chatId) {
      openChat(result.chatId);
      navigate("/app/chat");
    }
  };

  const handleDeclineWorker = async () => {
    if (!request || isDeclining) return;

    setError("");
    setIsDeclining(true);
    const result = await declineWorkerInterest({ blockWorkerForTenMinutes: true });
    setIsDeclining(false);

    if (!result.ok) {
      setError(result.error ?? "Não conseguimos recusar este(a) prestador(a) agora.");
      return;
    }

    setWorkerProfile(null);
  };

  const handleRemoveRequest = async () => {
    setError("");
    setIsRemoving(true);
    const result = await deleteActiveServiceRequest();
    setIsRemoving(false);

    if (!result.ok) {
      setError(result.error ?? "Não conseguimos remover este pedido agora.");
      return;
    }

    setIsRemoveConfirmOpen(false);
    navigate("/app", { replace: true });
  };

  const handleReleasePayment = async () => {
    if (!request || !hasWorkerArrivalEvent(request)) {
      setError("Confirme a chegada do(a) prestador(a) antes de liberar o pagamento.");
      return;
    }

    if (reviewRating < 1) {
      setError("Selecione uma nota para liberar o pagamento.");
      return;
    }

    if (reviewComment.trim().length < 8) {
      setError("Escreva uma avaliação breve antes de liberar o pagamento.");
      return;
    }

    const payload: ServiceReviewPayload = {
      rating: reviewRating,
      comment: reviewComment.trim(),
    };

    setError("");
    setIsReleasing(true);
    const result = await releaseServicePayment(payload);
    setIsReleasing(false);

    if (!result.ok) {
      setError(result.error ?? "Não conseguimos liberar o pagamento agora.");
      return;
    }

    setIsReviewOpen(false);
    navigate("/app", { replace: true });
  };

  const handleMarkWorkerArrived = async () => {
    if (!request || isMarkingArrival) return;

    setError("");
    setIsMarkingArrival(true);
    const result = await markWorkerArrived();
    setIsMarkingArrival(false);

    if (!result.ok) {
      setError(result.error ?? "Não conseguimos registrar a chegada agora.");
    }
  };

  const handleOpenDispute = async () => {
    if (disputeReason.trim().length < 12) {
      setError("Explique em poucas palavras o motivo da disputa.");
      return;
    }

    setError("");
    setIsOpeningDispute(true);
    const result = await openServiceDispute(disputeReason.trim());
    setIsOpeningDispute(false);

    if (!result.ok) {
      setError(result.error ?? "Não conseguimos abrir a disputa agora.");
      return;
    }

    setDisputeReason("");
    setIsDisputeOpen(false);
  };

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
      setError("");
    } catch (uploadError) {
      setError(
        uploadError instanceof Error
          ? uploadError.message
          : "Não conseguimos anexar a foto."
      );
    }
  };

  const handleOpenNoShowEvidencePicker = async () => {
    const allowed = await requestNativeCameraPermission();

    if (!allowed) {
      setError("Ative a permissão da câmera para anexar uma foto.");
      return;
    }

    noShowEvidenceInputRef.current?.click();
  };

  const handleReportNoShow = async () => {
    if (noShowReason.trim().length < 12) {
      setError("Explique o que aconteceu em pelo menos 12 caracteres.");
      return;
    }

    setError("");
    setIsReportingNoShow(true);
    const result = await reportProviderNoShow({
      reason: noShowReason.trim(),
      evidenceImage: noShowEvidenceImage,
    });
    setIsReportingNoShow(false);

    if (!result.ok) {
      setError(result.error ?? "Não conseguimos solicitar o ressarcimento agora.");
      return;
    }

    setNoShowReason("");
    setNoShowEvidenceImage(null);
    setIsNoShowOpen(false);
  };

  const handleOpenHistory = async () => {
    setIsHistoryOpen(true);
    setIsLoadingHistory(true);
    setError("");

    const result = await listCompletedServiceRequests();

    setIsLoadingHistory(false);

    if (!result.ok) {
      setError(result.error ?? "Não conseguimos carregar o histórico agora.");
      return;
    }

    setCompletedRequests(result.requests ?? []);
  };

  return (
    <div className="min-h-full bg-white px-4 pb-[calc(7rem+env(safe-area-inset-bottom,0px))] pt-5 text-neutral-950">
      <div className="mx-auto flex w-full max-w-md flex-col gap-5">
        <header>
          <p className="text-[11px] font-black uppercase tracking-[0.18em] text-blue-600">
            área do cliente
          </p>
          <h1 className="mt-1 text-2xl font-black text-slate-950">Pedidos</h1>
        </header>

        <button
          type="button"
          onClick={() => void handleOpenHistory()}
          className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-blue-50 px-4 text-sm font-black text-blue-700 transition active:scale-[0.98]"
        >
          <Clock3 className="h-4 w-4" />
          Histórico de pedidos
        </button>

        {!request ? (
          <section className="flex min-h-[52dvh] flex-col items-center justify-center text-center">
            <span className="flex h-16 w-16 items-center justify-center rounded-full bg-blue-50 text-blue-600">
              <ClipboardList className="h-8 w-8" />
            </span>
            <h2 className="mt-5 text-lg font-black text-slate-950">Nenhum pedido ativo</h2>
            <p className="mt-2 max-w-[15rem] text-sm font-semibold leading-relaxed text-slate-500">
              Pedidos pagos ou em andamento aparecerão aqui para acompanhamento.
            </p>
            <button
              type="button"
              onClick={() => navigate("/app")}
              className="mt-6 rounded-2xl bg-blue-600 px-5 py-3 text-sm font-black text-white transition active:scale-[0.98]"
            >
              Solicitar serviço
            </button>
          </section>
        ) : (
          <>
            <section className="rounded-[28px] bg-neutral-50 p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[11px] font-black uppercase tracking-[0.16em] text-blue-600">
                    Pedido ativo
                  </p>
                  <h2 className="mt-1 text-xl font-black leading-snug text-slate-950">
                    {request.details?.title || request.description}
                  </h2>
                  <p className="mt-1 text-sm font-semibold text-slate-500">{request.type}</p>
                </div>
                <span className="shrink-0 rounded-full bg-blue-50 px-3 py-1 text-xs font-black text-blue-700">
                  {formatStatusLabel(request.status)}
                </span>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-2">
                <div className="rounded-2xl bg-white p-3">
                  <div className="flex items-center gap-2 text-slate-500">
                    <Clock3 className="h-4 w-4" />
                    <span className="text-[11px] font-black uppercase tracking-[0.12em]">Criado</span>
                  </div>
                  <p className="mt-2 text-sm font-extrabold text-slate-900">
                    {request.createdAtLabel || formatCreatedAt(request.createdAt)}
                  </p>
                </div>
                <div className="rounded-2xl bg-white p-3">
                  <div className="flex items-center gap-2 text-slate-500">
                    <Banknote className="h-4 w-4" />
                    <span className="text-[11px] font-black uppercase tracking-[0.12em]">Valor</span>
                  </div>
                  <p className="mt-2 text-sm font-extrabold text-slate-900">
                    {formatPaymentAmount(request)}
                  </p>
                </div>
              </div>

              {request.details ? (
                <div className="mt-2 grid grid-cols-2 gap-2">
                  <div className="rounded-2xl bg-white p-3">
                    <div className="flex items-center gap-2 text-slate-500">
                      <CalendarDays className="h-4 w-4" />
                      <span className="text-[11px] font-black uppercase tracking-[0.12em]">Data</span>
                    </div>
                    <p className="mt-2 text-sm font-extrabold text-slate-900">
                      {formatServiceDate(request.details.serviceDate, "short") || "A combinar"}
                    </p>
                  </div>
                  <div className="rounded-2xl bg-white p-3">
                    <div className="flex items-center gap-2 text-slate-500">
                      <ShieldCheck className="h-4 w-4" />
                      <span className="text-[11px] font-black uppercase tracking-[0.12em]">Local</span>
                    </div>
                    <p className="mt-2 truncate text-sm font-extrabold text-slate-900">
                      {getVisibleLocation(request)}
                    </p>
                  </div>
                </div>
              ) : null}
            </section>

            <section className="rounded-[28px] bg-neutral-50 p-4">
              <div className="flex items-center gap-2">
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-blue-50 text-blue-600">
                  <UserRound className="h-5 w-5" />
                </span>
                <div>
                  <h2 className="text-base font-black text-slate-950">Prestador(a)</h2>
                  <p className="text-xs font-semibold text-slate-500">
                    {hasWorker ? "Vinculado ao atendimento" : "Aguardando interesse"}
                  </p>
                </div>
              </div>

              {hasWorker ? (
                <div className="mt-4 rounded-[26px] bg-white p-3">
                  <div className="flex items-center gap-3">
                    <div className="relative h-16 w-16 shrink-0 overflow-visible">
                      <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-full bg-blue-600 text-lg font-black text-white">
                        {workerProfile?.avatar ? (
                          <img src={workerProfile.avatar} alt={workerName} className="h-full w-full object-cover" />
                        ) : (
                          getInitials(workerName)
                        )}
                      </div>
                      {request.workerVerified || workerProfile?.isCpfVerified ? (
                        <VerifiedBadge size="sm" className="absolute bottom-0 right-0" />
                      ) : null}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-base font-black text-slate-950">{workerName}</p>
                      <p className="mt-0.5 truncate text-xs font-bold text-blue-600">{workerProfession}</p>
                      {request.details?.schedule ? (
                        <p className="mt-1 text-xs font-semibold text-slate-500">
                          {request.details.schedule} é tolerância {formatDelayTolerance(request.details.delayToleranceMinutes)}
                        </p>
                      ) : null}
                    </div>
                  </div>

                  {request.status === "interest-received" ? (
                    <div className="mt-4 grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => void handleDeclineWorker()}
                        disabled={isDeclining || isAccepting}
                        className="flex h-12 items-center justify-center gap-2 rounded-2xl bg-red-50 text-sm font-black text-red-600 transition active:scale-[0.98] disabled:cursor-wait disabled:opacity-60"
                      >
                        <X className="h-4 w-4" />
                        Recusar
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleAcceptWorker()}
                        disabled={isAccepting || isDeclining}
                        className="flex h-12 items-center justify-center gap-2 rounded-2xl bg-blue-600 text-sm font-black text-white transition active:scale-[0.98] disabled:cursor-wait disabled:opacity-60"
                      >
                        <CheckCircle2 className="h-4 w-4" />
                        Aceitar
                      </button>
                    </div>
                  ) : null}
                </div>
              ) : (
                <div className="mt-4 rounded-[26px] bg-white p-4 text-sm font-bold text-slate-500">
                  Nenhum(a) prestador(a) vinculado(a) ainda.
                </div>
              )}
            </section>

            {request.details || request.payment ? (
              <section className="rounded-[28px] bg-neutral-50 p-4">
                <h2 className="text-base font-black text-slate-950">Pagamento</h2>
                <div className="mt-3 space-y-2">
                  {request.details?.title ? (
                    <div className="flex items-center justify-between gap-3 rounded-2xl bg-white px-4 py-3">
                      <span className="text-sm font-bold text-slate-500">Acordo</span>
                      <span className="text-right text-sm font-black text-slate-900">{request.details.title}</span>
                    </div>
                  ) : null}
                  <div className="flex items-center justify-between gap-3 rounded-2xl bg-white px-4 py-3">
                    <span className="text-sm font-bold text-slate-500">Serviço</span>
                    <span className="text-sm font-black text-slate-900">{request.details?.price || "Aguardando"}</span>
                  </div>
                  {request.payment ? (
                    <>
                      <div className="flex items-center justify-between gap-3 rounded-2xl bg-white px-4 py-3">
                        <span className="text-sm font-bold text-slate-500">Taxas</span>
                        <span className="text-sm font-black text-slate-900">
                          {formatCurrencyAmount((request.payment.feeCents || 0) / 100)}
                        </span>
                      </div>
                      <div className="flex items-center justify-between gap-3 rounded-2xl bg-blue-50 px-4 py-3">
                        <span className="text-sm font-black text-blue-700">Total</span>
                        <span className="text-base font-black text-slate-950">
                          {formatCurrencyAmount(request.payment.totalCents / 100)}
                        </span>
                      </div>
                    </>
                  ) : null}
                </div>
              </section>
            ) : null}

            {request.dispute?.status ? (
              <section className="rounded-[28px] bg-red-50 p-4 text-red-800">
                <div className="flex gap-3">
                  <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0" />
                  <div className="min-w-0 flex-1">
                    <h2 className="text-base font-black">
                      {request.dispute.kind === "provider-no-show"
                        ? "Ressarcimento em análise"
                        : "Disputa em análise"}
                    </h2>
                    <p className="mt-1 text-sm font-semibold leading-relaxed">
                      {request.dispute.reason || "O suporte acompanha este atendimento."}
                    </p>
                    {request.dispute.evidenceImage ? (
                      <img
                        src={request.dispute.evidenceImage}
                        alt="Evidência enviada"
                        className="mt-3 max-h-48 w-full rounded-2xl object-cover"
                      />
                    ) : null}
                    {request.dispute.providerResponse ? (
                      <div className="mt-3 rounded-2xl bg-white px-3 py-3 text-sm">
                        <strong className="block text-xs uppercase tracking-wider text-red-600">
                          Resposta do prestador
                        </strong>
                        <p className="mt-1 font-semibold leading-relaxed">
                          {request.dispute.providerResponse}
                        </p>
                      </div>
                    ) : null}
                    {request.dispute.kind === "provider-no-show" &&
                    request.dispute.responseDueAt &&
                    !request.dispute.providerRespondedAt ? (
                      <p className="mt-3 text-xs font-bold leading-relaxed">
                        O prestador pode responder até{" "}
                        {new Intl.DateTimeFormat("pt-BR", {
                          day: "2-digit",
                          month: "2-digit",
                          hour: "2-digit",
                          minute: "2-digit",
                        }).format(new Date(request.dispute.responseDueAt))}. Se não responder, o
                        ressarcimento integral será processado automaticamente.
                      </p>
                    ) : null}
                  </div>
                </div>
              </section>
            ) : null}

            <section className="grid gap-2">
              <button
                type="button"
                onClick={handleOpenFlow}
                className="flex h-12 items-center justify-center gap-2 rounded-2xl bg-blue-600 px-4 py-3.5 text-sm font-black text-white transition active:scale-[0.98]"
              >
                {getPrimaryActionLabel(request)}
                <ArrowRight className="h-4 w-4" />
              </button>

              {request.status === "confirmed" ? (
                <div className="grid gap-2">
                  {hasWorkerArrived ? (
                    <div className="flex h-12 items-center justify-center gap-2 rounded-2xl bg-emerald-50 text-sm font-black text-emerald-700">
                      <CheckCircle2 className="h-4 w-4" />
                      Chegada registrada
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => void handleMarkWorkerArrived()}
                      disabled={isMarkingArrival || request.dispute?.status === "open"}
                      className="flex h-12 items-center justify-center gap-2 rounded-2xl bg-blue-600 text-sm font-black text-white transition active:scale-[0.98] disabled:cursor-wait disabled:opacity-60"
                    >
                      <CheckCircle2 className="h-4 w-4" />
                      {isMarkingArrival ? "Registrando..." : "O(a) prestador(a) chegou?"}
                    </button>
                  )}

                  {canReportNoShow ? (
                    <button
                      type="button"
                      onClick={() => setIsNoShowOpen(true)}
                      className="flex h-12 items-center justify-center gap-2 rounded-2xl bg-rose-600 px-3 text-sm font-black text-white transition active:scale-[0.98]"
                    >
                      <ShieldAlert className="h-4 w-4" />
                      Prestador não compareceu
                    </button>
                  ) : null}

                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setIsDisputeOpen(true)}
                      disabled={request.dispute?.status === "open"}
                      className="flex h-12 items-center justify-center gap-2 rounded-2xl bg-red-50 text-sm font-black text-red-600 transition active:scale-[0.98] disabled:opacity-60"
                    >
                      <ShieldAlert className="h-4 w-4" />
                      Disputa
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (!hasWorkerArrived) {
                          setError("Confirme a chegada do(a) prestador(a) antes de liberar o pagamento.");
                          return;
                        }

                        setIsReviewOpen(true);
                      }}
                      disabled={!hasWorkerArrived || request.dispute?.status === "open"}
                      className="flex h-12 items-center justify-center gap-2 rounded-2xl bg-emerald-600 text-sm font-black text-white transition active:scale-[0.98] disabled:bg-slate-200 disabled:text-slate-400"
                    >
                      <CheckCircle2 className="h-4 w-4" />
                      Liberar
                    </button>
                  </div>
                </div>
              ) : null}

              {request.status === "searching" ? (
                <button
                  type="button"
                  onClick={() => setIsRemoveConfirmOpen(true)}
                  disabled={isRemoving}
                  className="flex h-12 items-center justify-center gap-2 rounded-2xl bg-red-50 text-sm font-black text-red-600 transition active:scale-[0.98] disabled:opacity-60"
                >
                  <Trash2 className="h-4 w-4" />
                  Remover do mapa
                </button>
              ) : null}
            </section>

            {timeline.length > 0 ? (
              <section className="rounded-[28px] bg-neutral-50 p-4">
                <p className="text-[11px] font-black uppercase tracking-[0.18em] text-blue-600">Histórico</p>
                <div className="mt-3">
                  <ServiceTimeline timeline={timeline.slice().reverse()} />
                </div>
              </section>
            ) : null}
          </>
        )}
      </div>

      {isRemoveConfirmOpen ? (
        <ConfirmDialog
          title="Remover pedido?"
          message="Prestadores(as) não verão mais esta solicitação no mapa."
          confirmLabel={isRemoving ? "Removendo..." : "Remover"}
          tone="danger"
          onCancel={() => setIsRemoveConfirmOpen(false)}
          onConfirm={() => void handleRemoveRequest()}
          disabled={isRemoving}
        />
      ) : null}

      {isHistoryOpen ? (
        <div className="fixed inset-0 z-[90] flex items-end justify-center bg-slate-950/40 px-4 py-5 backdrop-blur-[2px] sm:items-center">
          <div className="flex max-h-[86dvh] w-full max-w-md flex-col rounded-[24px] bg-white text-neutral-950 shadow-[0_18px_55px_rgba(15,23,42,0.20)]">
            <div className="flex items-start justify-between gap-4 border-b border-slate-100 px-4 py-3.5">
              <div>
                <p className="text-[11px] font-black uppercase tracking-[0.18em] text-blue-600">
                  Histórico
                </p>
                <h2 className="mt-1 text-xl font-black text-slate-950">Histórico de pedidos</h2>
              </div>
              <button
                type="button"
                onClick={() => setIsHistoryOpen(false)}
                className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-slate-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto p-3.5">
              {isLoadingHistory ? (
                <div className="rounded-3xl bg-slate-50 px-4 py-8 text-center text-sm font-bold text-slate-500">
                  Carregando histórico...
                </div>
              ) : completedRequests.length > 0 ? (
                <div className="space-y-3">
                  {completedRequests.map((completedRequest) => (
                    <details key={completedRequest.id} className="group rounded-2xl border border-slate-100 bg-slate-50 p-3 open:bg-white open:shadow-sm">
                      <summary className="flex cursor-pointer list-none items-start justify-between gap-3 [&::-webkit-details-marker]:hidden">
                        <div className="min-w-0">
                          <p className="text-[11px] font-black uppercase tracking-[0.16em] text-blue-600">
                            {completedRequest.type}
                          </p>
                          <h3 className="mt-0.5 truncate text-sm font-black text-slate-950">
                            {completedRequest.details?.title || completedRequest.description}
                          </h3>
                          <p className="mt-0.5 text-[11px] font-bold text-slate-500">
                            {completedRequest.workerName || "Prestador(a)"} • {formatPaymentAmount(completedRequest)}
                          </p>
                        </div>
                        <span
                          className={`rounded-full px-3 py-1 text-[11px] font-black ${
                            completedRequest.dispute?.status === "refunded"
                              ? "bg-blue-50 text-blue-700"
                              : "bg-emerald-50 text-emerald-700"
                          }`}
                        >
                          {completedRequest.dispute?.status === "refunded"
                            ? "Reembolsado"
                            : "Concluído"}
                        </span>
                      </summary>

                      <div className="mt-2 grid grid-cols-2 gap-1.5 border-t border-slate-100 pt-2 text-[11px] font-bold text-slate-600">
                        <div className="rounded-xl bg-slate-50 px-2.5 py-1.5">
                          <span className="block text-slate-400">Criado</span>
                          {completedRequest.createdAtLabel || formatCreatedAt(completedRequest.createdAt)}
                        </div>
                        <div className="rounded-xl bg-slate-50 px-2.5 py-1.5">
                          <span className="block text-slate-400">Local</span>
                          <span className="line-clamp-2">{getVisibleLocation(completedRequest)}</span>
                        </div>
                        {completedRequest.details?.schedule ? (
                          <div className="rounded-xl bg-slate-50 px-2.5 py-1.5">
                            <span className="block text-slate-400">Horário</span>
                            {completedRequest.details.schedule}
                          </div>
                        ) : null}
                        {completedRequest.payment ? (
                          <div className="rounded-xl bg-slate-50 px-2.5 py-1.5">
                            <span className="block text-slate-400">Total</span>
                            {formatCurrencyAmount(completedRequest.payment.totalCents / 100)}
                          </div>
                        ) : null}
                      </div>

                      {completedRequest.timeline.length > 0 ? (
                        <div className="mt-2">
                          <ServiceTimeline timeline={completedRequest.timeline.slice().reverse()} />
                        </div>
                      ) : null}
                    </details>
                  ))}
                </div>
              ) : (
                <div className="rounded-3xl bg-slate-50 px-4 py-8 text-center text-sm font-bold text-slate-500">
                  Nenhum pedido encerrado ainda.
                </div>
              )}
            </div>
          </div>
        </div>
      ) : null}

      {isNoShowOpen ? (
        <div className="fixed inset-0 z-[92] flex items-end justify-center bg-slate-950/45 px-4 py-5 backdrop-blur-[2px] sm:items-center">
          <div className="max-h-[88dvh] w-full max-w-sm overflow-y-auto rounded-[28px] bg-white p-5 text-neutral-950 shadow-[0_18px_55px_rgba(15,23,42,0.20)]">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[11px] font-black uppercase tracking-[0.18em] text-rose-600">
                  Proteção do cliente
                </p>
                <h2 className="mt-1 text-xl font-black text-slate-950">
                  Prestador não compareceu
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setIsNoShowOpen(false)}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <p className="mt-4 text-sm font-semibold leading-relaxed text-slate-600">
              Ao enviar, o pagamento continuará bloqueado. O prestador terá 12 horas para
              responder e a administração poderá analisar o chat, o horário e os registros de
              chegada.
            </p>

            <textarea
              value={noShowReason}
              onChange={(event) => setNoShowReason(event.target.value.slice(0, 320))}
              rows={4}
              placeholder="Explique há quanto tempo está aguardando e se tentou contato pelo chat."
              className="mt-4 w-full resize-none rounded-2xl bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-700 outline-none focus:ring-2 focus:ring-rose-200"
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
              <div className="mt-3 overflow-hidden rounded-2xl border border-slate-200">
                <img
                  src={noShowEvidenceImage}
                  alt="Evidência selecionada"
                  className="max-h-48 w-full object-cover"
                />
                <button
                  type="button"
                  onClick={() => setNoShowEvidenceImage(null)}
                  className="w-full py-2 text-xs font-black text-rose-700"
                >
                  Remover foto
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => void handleOpenNoShowEvidencePicker()}
                className="mt-3 flex h-11 w-full items-center justify-center gap-2 rounded-2xl border border-slate-200 text-xs font-black text-slate-700"
              >
                <Camera className="h-4 w-4 text-blue-600" />
                Anexar foto opcional
              </button>
            )}

            <div className="mt-3 rounded-2xl bg-emerald-50 px-4 py-3 text-xs font-bold leading-relaxed text-emerald-800">
              Quando aprovado, o ressarcimento devolve o valor do serviço, a taxa do app e a taxa
              de intermediação. O Worko não fica com nenhuma taxa.
            </div>

            <button
              type="button"
              onClick={() => void handleReportNoShow()}
              disabled={isReportingNoShow}
              className="mt-4 flex h-12 w-full items-center justify-center rounded-2xl bg-rose-600 text-sm font-black text-white disabled:opacity-60"
            >
              {isReportingNoShow ? "Enviando..." : "Solicitar ressarcimento integral"}
            </button>
          </div>
        </div>
      ) : null}

      {isReviewOpen ? (
        <div className="fixed inset-0 z-[90] flex items-end justify-center bg-slate-950/40 px-4 py-5 backdrop-blur-[2px] sm:items-center">
          <div className="w-full max-w-sm rounded-[28px] bg-white p-5 text-neutral-950 shadow-[0_18px_55px_rgba(15,23,42,0.20)]">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[11px] font-black uppercase tracking-[0.18em] text-emerald-600">Finalizar</p>
                <h2 className="mt-1 text-xl font-black text-slate-950">Liberar pagamento</h2>
              </div>
              <button type="button" onClick={() => setIsReviewOpen(false)} className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-slate-600">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="mt-5 flex justify-center gap-2">
              {Array.from({ length: 5 }).map((_, index) => {
                const value = index + 1;
                return (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setReviewRating(value)}
                    className={`flex h-11 w-11 items-center justify-center rounded-full ${reviewRating >= value ? "bg-amber-50 text-amber-500" : "bg-slate-100 text-slate-300"}`}
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
              placeholder="Conte rapidamente como foi o atendimento."
              className="mt-4 w-full resize-none rounded-2xl bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-700 outline-none focus:ring-2 focus:ring-blue-200"
            />
            <button
              type="button"
              onClick={() => void handleReleasePayment()}
              disabled={isReleasing}
              className="mt-4 flex h-12 w-full items-center justify-center rounded-2xl bg-emerald-600 text-sm font-black text-white disabled:opacity-60"
            >
                {isReleasing ? "Liberando..." : "Confirmar liberação"}
            </button>
          </div>
        </div>
      ) : null}

      {isDisputeOpen ? (
        <div className="fixed inset-0 z-[90] flex items-end justify-center bg-slate-950/40 px-4 py-5 backdrop-blur-[2px] sm:items-center">
          <div className="w-full max-w-sm rounded-[28px] bg-white p-5 text-neutral-950 shadow-[0_18px_55px_rgba(15,23,42,0.20)]">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[11px] font-black uppercase tracking-[0.18em] text-red-600">Suporte</p>
                <h2 className="mt-1 text-xl font-black text-slate-950">Abrir disputa</h2>
              </div>
              <button type="button" onClick={() => setIsDisputeOpen(false)} className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-slate-600">
                <X className="h-5 w-5" />
              </button>
            </div>
            <textarea
              value={disputeReason}
              onChange={(event) => setDisputeReason(event.target.value)}
              rows={4}
              placeholder="Explique o que aconteceu."
              className="mt-4 w-full resize-none rounded-2xl bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-700 outline-none focus:ring-2 focus:ring-blue-200"
            />
            <button
              type="button"
              onClick={() => void handleOpenDispute()}
              disabled={isOpeningDispute}
              className="mt-4 flex h-12 w-full items-center justify-center rounded-2xl bg-red-600 text-sm font-black text-white disabled:opacity-60"
            >
              {isOpeningDispute ? "Abrindo..." : "Enviar disputa"}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function ConfirmDialog({
  title,
  message,
  confirmLabel,
  tone,
  disabled,
  onCancel,
  onConfirm,
}: {
  title: string;
  message: string;
  confirmLabel: string;
  tone: "danger" | "default";
  disabled: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <div className="fixed inset-0 z-[90] flex items-end justify-center bg-slate-950/40 px-4 py-5 backdrop-blur-[2px] sm:items-center">
      <div className="w-full max-w-sm rounded-[28px] bg-white p-5 text-neutral-950 shadow-[0_18px_55px_rgba(15,23,42,0.20)]">
        <div className="flex items-start gap-3">
          <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${tone === "danger" ? "bg-red-50 text-red-600" : "bg-blue-50 text-blue-600"}`}>
            <AlertTriangle className="h-5 w-5" />
          </span>
          <div>
            <h2 className="text-lg font-black text-slate-950">{title}</h2>
            <p className="mt-1 text-sm font-semibold leading-relaxed text-slate-500">{message}</p>
          </div>
        </div>
        <div className="mt-5 grid grid-cols-2 gap-2">
          <button type="button" onClick={onCancel} disabled={disabled} className="h-12 rounded-2xl bg-slate-100 text-sm font-black text-slate-700 disabled:opacity-60">
            Não
          </button>
          <button type="button" onClick={onConfirm} disabled={disabled} className="h-12 rounded-2xl bg-red-600 text-sm font-black text-white disabled:opacity-60">
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

