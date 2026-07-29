import { useEffect, useMemo, useRef, useState } from "react";
import { Check, Clock3, LoaderCircle, ShieldCheck, X } from "lucide-react";
import { motion } from "motion/react";
import { Navigate, useNavigate } from "react-router";
import { apiRequest } from "../../api/client";
import { useApp } from "../../context/AppContext";
import { useErrorToast } from "../../hooks/useErrorToast";
import type { PublicUserProfile } from "../../types";
import {
  formatDelayTolerance,
  formatServiceDate,
  getFirstNames,
  getInitials,
} from "../../utils/helpers";
import { VerifiedBadge } from "../ui/verified-badge";
import { WorkoMatchTransition } from "./WorkoMatchTransition";

export function ServiceWaiting() {
  const navigate = useNavigate();
  const {
    state: { activeServiceRequest, user, sessionToken },
    cancelActiveServiceRequest,
  } = useApp();
  const [showReviewing, setShowReviewing] = useState(false);
  const [workerProfile, setWorkerProfile] = useState<PublicUserProfile | null>(null);
  const [closeError, setCloseError] = useState("");
  const [isWorkoTransitionOpen, setIsWorkoTransitionOpen] = useState(false);
  useErrorToast(closeError);
  const previousStatusRef = useRef(activeServiceRequest?.status ?? null);
  const hasPlayedPaymentTransitionRef = useRef(false);

  const workerName = useMemo(() => {
    return workerProfile?.fullName ?? activeServiceRequest?.workerName ?? "Profissional";
  }, [activeServiceRequest?.workerName, workerProfile?.fullName]);
  const workerDisplayName = useMemo(() => getFirstNames(workerName, 1), [workerName]);

  useEffect(() => {
    if (!activeServiceRequest || activeServiceRequest.status !== "waiting-worker") {
      setShowReviewing(false);
      return;
    }

    setShowReviewing(false);

    const reviewingTimeoutId = window.setTimeout(() => {
      setShowReviewing(true);
    }, 1600);

    return () => {
      window.clearTimeout(reviewingTimeoutId);
    };
  }, [activeServiceRequest?.id, activeServiceRequest?.status]);

  useEffect(() => {
    const previousStatus = previousStatusRef.current;
    const currentStatus = activeServiceRequest?.status ?? null;

    if (
      previousStatus === "waiting-worker" &&
      currentStatus === "payment" &&
      activeServiceRequest?.currentUserRole === "requester" &&
      !hasPlayedPaymentTransitionRef.current
    ) {
      hasPlayedPaymentTransitionRef.current = true;
      previousStatusRef.current = currentStatus;
      setIsWorkoTransitionOpen(true);
      return;
    }

    if (currentStatus === "payment" && !isWorkoTransitionOpen) {
      navigate("/app/service/payment", { replace: true });
    }

    if (currentStatus !== "payment") {
      hasPlayedPaymentTransitionRef.current = false;
    }

    previousStatusRef.current = currentStatus;
  }, [
    activeServiceRequest?.currentUserRole,
    activeServiceRequest?.status,
    navigate,
  ]);

  useEffect(() => {
    if (!activeServiceRequest?.workerId || !sessionToken) {
      setWorkerProfile(null);
      return;
    }

    let cancelled = false;

    void apiRequest<{ profile: PublicUserProfile }>(
      `/api/users/${encodeURIComponent(activeServiceRequest.workerId)}/profile`,
      {
        token: sessionToken,
      }
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
  }, [activeServiceRequest?.workerId, sessionToken]);

  if (!activeServiceRequest || !activeServiceRequest.details) {
    return <Navigate to="/app" replace />;
  }

  if (activeServiceRequest.currentUserRole !== "requester") {
    return <Navigate to="/app/chat" replace />;
  }

  const handleClose = async () => {
    const confirmed = window.confirm(
      "Sair agora cancela este atendimento. Deseja realmente sair?"
    );

    if (!confirmed) {
      return;
    }

    setCloseError("");
    const result = await cancelActiveServiceRequest();

    if (!result.ok) {
      setCloseError(result.error ?? "Não conseguimos cancelar este atendimento agora.");
      return;
    }

    navigate("/app", { replace: true });
  };

  return (
    <div className="min-h-full bg-slate-50 px-4 py-6 sm:px-6">
      <div className="mx-auto flex w-full max-w-xl flex-col gap-5">
        <div className="flex items-start justify-between gap-4 rounded-[30px] border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <div className="min-w-0">
            <h1 className="text-2xl font-bold text-slate-900">
              Aguardando confirmação do(a) profissional
            </h1>
          </div>

          <button
            type="button"
            onClick={handleClose}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-slate-200 bg-slate-50 text-slate-500 transition hover:bg-slate-100 hover:text-slate-700"
            aria-label="Cancelar acordo"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {closeError ? (
          <div className="rounded-[24px] border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {closeError}
          </div>
        ) : null}

        <motion.div
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-[32px] border border-slate-200 bg-white p-5 shadow-sm sm:p-7"
        >
          <div className="flex items-center justify-center gap-6 sm:gap-10">
            <div className="text-center">
              <div className="relative mx-auto h-24 w-24">
                <div className="flex h-24 w-24 items-center justify-center overflow-hidden rounded-full bg-blue-600 text-2xl font-bold text-white shadow-[0_18px_35px_rgba(37,99,235,0.18)]">
                  {user?.avatar ? (
                    <img
                      src={user.avatar}
                      alt={user.fullName}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    getInitials(user?.fullName ?? "Usuário")
                  )}
                </div>
                {user?.isCpfVerified ? (
                  <VerifiedBadge size="md" className="absolute bottom-1 right-1" />
                ) : null}
              </div>
              <p className="mt-3 text-sm font-semibold text-slate-900">Eu</p>
              <div className="mt-3 flex items-center justify-center">
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
                  <Check className="h-5 w-5" />
                </span>
              </div>
            </div>

            <div className="flex flex-col items-center gap-2 text-slate-300">
              <span className="h-2.5 w-2.5 rounded-full bg-blue-400" />
              <span className="h-2.5 w-2.5 rounded-full bg-blue-300" />
              <span className="h-2.5 w-2.5 rounded-full bg-blue-200" />
            </div>

            <div className="text-center">
              <div className="relative mx-auto h-24 w-24">
                <div className="mx-auto flex h-24 w-24 items-center justify-center overflow-hidden rounded-full bg-slate-200 text-2xl font-bold text-slate-700 shadow-inner">
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
                {workerProfile?.isCpfVerified || activeServiceRequest.workerVerified ? (
                  <VerifiedBadge size="md" className="absolute bottom-1 right-1" />
                ) : null}
              </div>
              <p className="mt-3 text-sm font-semibold text-slate-900">{workerDisplayName}</p>
              <div className="mt-3 flex items-center justify-center">
                {showReviewing ? (
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-100 text-blue-700">
                    <LoaderCircle className="h-5 w-5 animate-spin" />
                  </span>
                ) : (
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-slate-500">
                    <Clock3 className="h-5 w-5" />
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="mt-8 rounded-[28px] border border-slate-100 bg-slate-50 p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
              Informações enviadas
            </p>
            {activeServiceRequest.details.title ? (
              <div className="mt-4 rounded-2xl border border-white bg-white px-4 py-3">
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">
                  Acordo
                </p>
                <p className="mt-1 text-sm font-semibold text-slate-900">
                  {activeServiceRequest.details.title}
                </p>
              </div>
            ) : null}
            <div className="mt-4 grid gap-3 sm:grid-cols-4">
              <div className="rounded-2xl border border-white bg-white px-4 py-3">
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">
                  Valor
                </p>
                <p className="mt-1 text-sm font-semibold text-slate-900">
                  {activeServiceRequest.details.price}
                </p>
              </div>
              <div className="rounded-2xl border border-white bg-white px-4 py-3">
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">
                  Data
                </p>
                <p className="mt-1 text-sm font-semibold text-slate-900">
                  {formatServiceDate(activeServiceRequest.details.serviceDate, "medium") ||
                    "Não informada"}
                </p>
              </div>
              <div className="rounded-2xl border border-white bg-white px-4 py-3">
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">
                  Horário
                </p>
                <p className="mt-1 text-sm font-semibold text-slate-900">
                  {activeServiceRequest.details.schedule}
                </p>
              </div>
              <div className="rounded-2xl border border-white bg-white px-4 py-3">
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">
                  Tolerância
                </p>
                <p className="mt-1 text-sm font-semibold text-slate-900">
                  {formatDelayTolerance(activeServiceRequest.details.delayToleranceMinutes)}
                </p>
              </div>
            </div>

            <div className="mt-3 rounded-2xl border border-white bg-white px-4 py-3">
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">
                Local informado
              </p>
              <p className="mt-1 text-sm font-semibold text-slate-900">
                {String(activeServiceRequest.currentUserRole) === "worker"
                  ? "Local protegido pelo Worko"
                  : activeServiceRequest.details.locationMode === "residence"
                    ? "Endereço do perfil"
                    : activeServiceRequest.details.address}
              </p>
            </div>
          </div>

          <div className="mt-5 rounded-[26px] border border-blue-100 bg-blue-50 px-4 py-3 text-sm font-semibold text-blue-900">
            <div className="flex items-center gap-3">
              <ShieldCheck className="h-5 w-5 shrink-0 text-blue-600" />
              {showReviewing ? "Em revisão" : "Enviado"}
            </div>
          </div>
        </motion.div>

      </div>

      <WorkoMatchTransition
        isOpen={isWorkoTransitionOpen}
        currentUserName={user?.fullName ?? "Usuário"}
        currentUserAvatar={user?.avatar ?? null}
        partnerName={workerName}
        partnerAvatar={workerProfile?.avatar ?? null}
        onFinish={() => {
          setIsWorkoTransitionOpen(false);
          navigate("/app/service/payment", { replace: true });
        }}
      />
    </div>
  );
}


