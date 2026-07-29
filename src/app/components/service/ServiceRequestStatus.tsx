import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  Check,
  Clock3,
  MessageCircle,
  ShieldCheck,
  Trash2,
  UserRound,
  X,
} from "lucide-react";
import { Navigate, useNavigate } from "react-router";
import { apiRequest } from "../../api/client";
import { useApp } from "../../context/AppContext";
import { useErrorToast } from "../../hooks/useErrorToast";
import type { ActiveServiceRequest, PublicUserProfile } from "../../types";
import { getInitials } from "../../utils/helpers";
import { VerifiedBadge } from "../ui/verified-badge";

const REQUEST_TTL_MS = 1000 * 60 * 60;

function formatStatus(status: ActiveServiceRequest["status"]) {
  switch (status) {
    case "searching":
      return "Em busca";
    case "assigned":
    case "interest-received":
      return "Interessado";
    case "chatting":
      return "Em conversa";
    case "details":
      return "Detalhes";
    case "waiting-worker":
      return "Aguardando";
    case "payment":
      return "Pagamento";
    case "confirmed":
      return "Confirmado";
    default:
      return "Ativo";
  }
}

function formatRemainingTime(createdAt: string) {
  const expiresAt = new Date(createdAt).getTime() + REQUEST_TTL_MS;
  const remainingMs = Math.max(0, expiresAt - Date.now());
  const totalMinutes = Math.ceil(remainingMs / 60000);

  if (totalMinutes <= 0) {
    return "Expirando agora";
  }

  if (totalMinutes >= 60) {
    return "Expira em 1 hora";
  }

  return `Expira em ${totalMinutes} min`;
}

function formatCreatedAt(createdAt: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(createdAt));
}

export function ServiceRequestStatus() {
  const navigate = useNavigate();
  const {
    state: { activeServiceRequest, sessionToken },
    acceptWorkerInterest,
    declineWorkerInterest,
    deleteActiveServiceRequest,
    openChat,
  } = useApp();
  const [workerProfile, setWorkerProfile] = useState<PublicUserProfile | null>(null);
  const [error, setError] = useState("");
  const [isRemoving, setIsRemoving] = useState(false);
  const [isRemoveConfirmOpen, setIsRemoveConfirmOpen] = useState(false);
  const [isAccepting, setIsAccepting] = useState(false);
  const [isDeclining, setIsDeclining] = useState(false);
  const [remainingLabel, setRemainingLabel] = useState("");
  useErrorToast(error);

  const request = activeServiceRequest;
  const isRequester = request?.currentUserRole === "requester";
  const hasInterestedWorker = Boolean(request?.workerId || request?.workerName);
  const statusLabel = request ? formatStatus(request.status) : "";
  const createdAtLabel = request ? request.createdAtLabel || formatCreatedAt(request.createdAt) : "";
  const workerName = workerProfile?.fullName ?? request?.workerName ?? "Prestador(a) interessado(a)";
  const workerProfession =
    workerProfile?.professions?.[0] ??
    workerProfile?.headline?.trim() ??
    "Prestador(a) Worko";
  const timelinePreview = useMemo(() => {
    return request?.timeline.slice(-3).reverse() ?? [];
  }, [request?.timeline]);

  useEffect(() => {
    if (!request || request.status !== "searching") {
      setRemainingLabel("");
      return;
    }

    setRemainingLabel(formatRemainingTime(request.createdAt));

    const intervalId = window.setInterval(() => {
      setRemainingLabel(formatRemainingTime(request.createdAt));
    }, 30000);

    return () => window.clearInterval(intervalId);
  }, [request?.createdAt, request?.status]);

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
        if (!cancelled) {
          setWorkerProfile(response.profile);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setWorkerProfile(null);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [request?.workerId, sessionToken]);

  if (!request || !isRequester) {
    return <Navigate to="/app" replace />;
  }

  const handleOpenChat = () => {
    if (!request.chatId) {
      return;
    }

    openChat(request.chatId);
    navigate("/app/chat");
  };

  const handleRemoveRequest = () => {
    setError("");
    setIsRemoveConfirmOpen(true);
  };

  const handleConfirmRemoveRequest = async () => {
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

  const handleAcceptWorker = async () => {
    if (isAccepting || !hasInterestedWorker) {
      return;
    }

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
      return;
    }

    navigate("/app");
  };

  const handleDeclineWorker = async () => {
    if (isDeclining || !hasInterestedWorker) {
      return;
    }

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

  return (
    <div className="min-h-full bg-white px-4 pb-[calc(7rem+env(safe-area-inset-bottom,0px))] pt-5 text-neutral-950">
      <div className="mx-auto flex w-full max-w-md flex-col gap-4">
        <header className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => navigate("/app")}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white text-slate-700 ring-1 ring-slate-200 transition active:scale-95"
            aria-label="Voltar"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div className="min-w-0">
            <p className="text-[11px] font-black uppercase tracking-[0.18em] text-blue-600">
              Pedido ativo
            </p>
            <h1 className="text-xl font-black leading-tight text-slate-950">
              Acompanhar pedido
            </h1>
          </div>
        </header>

        <section className="rounded-[28px] bg-neutral-50 p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-400">
                {request.type}
              </p>
              <h2 className="mt-1 text-lg font-black leading-snug text-slate-950">
                {request.description}
              </h2>
            </div>
            <span className="shrink-0 rounded-full bg-blue-50 px-3 py-1 text-xs font-bold text-blue-700">
              {statusLabel}
            </span>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-2">
            <div className="rounded-2xl bg-white p-3">
              <div className="flex items-center gap-2 text-slate-500">
                <Clock3 className="h-4 w-4" />
                <span className="text-[11px] font-bold uppercase tracking-[0.12em]">
                  Publicado
                </span>
              </div>
              <p className="mt-2 text-sm font-extrabold text-slate-900">
                {createdAtLabel}
              </p>
            </div>

            <div className="rounded-2xl bg-white p-3">
              <div className="flex items-center gap-2 text-slate-500">
                <ShieldCheck className="h-4 w-4" />
                <span className="text-[11px] font-bold uppercase tracking-[0.12em]">
                  Mapa
                </span>
              </div>
              <p className="mt-2 text-sm font-extrabold text-slate-900">
                {request.status === "searching" ? remainingLabel : "Em atendimento"}
              </p>
            </div>
          </div>
        </section>

        <section className="rounded-[28px] bg-neutral-50 p-4">
          <div className="flex items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-blue-50 text-blue-600">
              <UserRound className="h-5 w-5" />
            </span>
            <div>
              <h2 className="text-base font-black text-slate-950">
                Prestadores(as) interessados(as)
              </h2>
              <p className="text-xs font-semibold text-slate-500">
                {hasInterestedWorker ? "1 interessado agora" : "Aguardando retorno"}
              </p>
            </div>
          </div>

          {hasInterestedWorker ? (
            <div className="mt-4 rounded-[26px] bg-white p-3">
              <div className="flex items-center gap-3">
                <div className="relative h-16 w-16 shrink-0 overflow-visible">
                  <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-full bg-blue-600 text-lg font-black text-white">
                    {workerProfile?.avatar ? (
                      <img
                        src={workerProfile.avatar}
                        alt={workerName}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      getInitials(workerName)
                    )}
                  </div>
                  {request.workerVerified || workerProfile?.isCpfVerified ? (
                    <VerifiedBadge size="sm" className="absolute bottom-0 right-0" />
                  ) : null}
                </div>

                <div className="min-w-0 flex-1">
                  <p className="truncate text-base font-black text-slate-950">
                    {workerName}
                  </p>
                  <p className="mt-0.5 truncate text-xs font-bold text-blue-600">
                    {workerProfession}
                  </p>
                  <p className="mt-1 text-xs font-semibold text-slate-500">
                    Interessado no seu pedido.
                  </p>
                </div>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => void handleDeclineWorker()}
                  disabled={isDeclining || isAccepting}
                  className="flex h-12 items-center justify-center gap-2 rounded-2xl bg-white text-sm font-black text-slate-800 ring-1 ring-slate-200 transition active:scale-[0.98] disabled:cursor-wait disabled:opacity-60"
                >
                  <X className="h-4 w-4 text-red-500" />
                  Recusar
                </button>
                <button
                  type="button"
                  onClick={() => void handleAcceptWorker()}
                  disabled={isAccepting || isDeclining}
                  className="flex h-12 items-center justify-center gap-2 rounded-2xl bg-blue-600 text-sm font-black text-white transition active:scale-[0.98] disabled:cursor-wait disabled:opacity-60"
                >
                  <Check className="h-4 w-4" />
                  Aceitar
                </button>
              </div>

              {request.chatId ? (
                <button
                  type="button"
                  onClick={handleOpenChat}
                  className="mt-2 flex h-11 w-full items-center justify-center gap-2 rounded-2xl bg-slate-950 text-sm font-bold text-white transition active:scale-[0.98]"
                >
                  Abrir conversa
                  <MessageCircle className="h-4 w-4" />
                </button>
              ) : null}
            </div>
          ) : (
            <div className="mt-4 rounded-[26px] bg-white p-4 text-sm font-bold text-slate-500">
              Nenhum(a) prestador(a) interessado(a) ainda.
            </div>
          )}
        </section>

        {timelinePreview.length > 0 ? (
          <section className="rounded-[28px] bg-neutral-50 p-4">
            <p className="text-[11px] font-black uppercase tracking-[0.18em] text-blue-600">
              Histórico
            </p>
            <div className="mt-3 space-y-2">
              {timelinePreview.map((event) => (
                <div key={event.id} className="flex items-center gap-3 rounded-2xl bg-white p-3">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-blue-50 text-blue-600">
                    <Clock3 className="h-4 w-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-extrabold text-slate-950">
                      {event.title}
                    </p>
                    <p className="truncate text-xs font-semibold text-slate-500">
                      {formatCreatedAt(event.createdAt)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </section>
        ) : null}

        <button
          type="button"
          onClick={handleRemoveRequest}
          disabled={isRemoving}
          className="flex w-full items-center justify-center gap-2 rounded-2xl bg-red-50 px-4 py-3.5 text-sm font-black text-red-600 transition active:scale-[0.98] disabled:cursor-wait disabled:opacity-70"
        >
          <Trash2 className="h-5 w-5" />
          {isRemoving ? "Removendo..." : "Remover pedido do mapa"}
        </button>
      </div>

      {isRemoveConfirmOpen ? (
        <div className="fixed inset-0 z-[90] flex items-end justify-center bg-slate-950/40 px-4 py-5 backdrop-blur-[2px] sm:items-center">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="remove-request-title"
            className="w-full max-w-sm rounded-[28px] bg-white p-5 text-neutral-950 shadow-[0_18px_55px_rgba(15,23,42,0.20)]"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p id="remove-request-title" className="text-lg font-black">
                  Remover pedido?
                </p>
                <p className="mt-2 text-sm font-semibold leading-relaxed text-slate-500">
                  Prestadores(as) não verão mais esta solicitação no mapa.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsRemoveConfirmOpen(false)}
                disabled={isRemoving}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-600 transition active:scale-95 disabled:opacity-50"
                aria-label="Fechar confirmação"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="mt-5 grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setIsRemoveConfirmOpen(false)}
                disabled={isRemoving}
                className="rounded-2xl bg-slate-100 px-4 py-3 text-sm font-black text-slate-700 transition active:scale-[0.98] disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => void handleConfirmRemoveRequest()}
                disabled={isRemoving}
                className="rounded-2xl bg-red-600 px-4 py-3 text-sm font-black text-white transition active:scale-[0.98] disabled:cursor-wait disabled:opacity-70"
              >
                {isRemoving ? "Removendo..." : "Remover"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

