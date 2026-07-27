import { useEffect, useState } from "react";
import {
  CalendarDays,
  Clock3,
  DollarSign,
  FileText,
  Home,
  MapPin,
  MoveRight,
  Trash2,
  X,
} from "lucide-react";
import { motion } from "motion/react";
import { Navigate, useNavigate } from "react-router";
import { useApp } from "../../context/AppContext";
import { useErrorToast } from "../../hooks/useErrorToast";
import type { ServiceLocationMode } from "../../types";
import {
  calculateAppServiceFeeAmount,
  calculateAsaasFixedFeeAmount,
  calculateServiceFeeAmount,
  formatCurrencyAmount,
  formatCurrencyInput,
  formatDelayTolerance,
  formatScheduleInput,
  parseCurrencyValue,
} from "../../utils/helpers";

export function ServiceDetails() {
  const navigate = useNavigate();
  const {
    state: { activeServiceRequest, user },
    deleteActiveServiceRequest,
    submitServiceDetails,
  } = useApp();
  const [title, setTitle] = useState("");
  const [price, setPrice] = useState("");
  const [serviceDate, setServiceDate] = useState("");
  const [schedule, setSchedule] = useState("");
  const [delayToleranceMinutes, setDelayToleranceMinutes] = useState(15);
  const [locationMode, setLocationMode] = useState<ServiceLocationMode>("residence");
  const [address, setAddress] = useState("");
  const [error, setError] = useState("");
  const [deleteError, setDeleteError] = useState("");
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const [isDeletingRequest, setIsDeletingRequest] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  useErrorToast(error);
  useErrorToast(deleteError);
  const remoteTitle = activeServiceRequest?.details?.title ?? "";
  const remotePrice = activeServiceRequest?.details?.price ?? "";
  const remoteServiceDate = activeServiceRequest?.details?.serviceDate ?? "";
  const remoteSchedule = activeServiceRequest?.details?.schedule ?? "";
  const remoteDelayToleranceMinutes =
    activeServiceRequest?.details?.delayToleranceMinutes ?? 15;
  const remoteLocationMode = activeServiceRequest?.details?.locationMode ?? "residence";
  const remoteAddress = activeServiceRequest?.details?.address ?? user?.address ?? "";
  const serviceBaseAmount = parseCurrencyValue(price);
  const appFeeAmount = calculateAppServiceFeeAmount(serviceBaseAmount);
  const asaasFeeAmount = calculateAsaasFixedFeeAmount(serviceBaseAmount);
  const serviceFeeAmount = calculateServiceFeeAmount(serviceBaseAmount);
  const totalAmountWithFee = serviceBaseAmount + serviceFeeAmount;

  useEffect(() => {
    if (!activeServiceRequest) {
      return;
    }

    setTitle(remoteTitle);
    setPrice(formatCurrencyInput(remotePrice));
    setServiceDate(remoteServiceDate);
    setSchedule(formatScheduleInput(remoteSchedule));
    setDelayToleranceMinutes(remoteDelayToleranceMinutes);
    setLocationMode(remoteLocationMode);
    setAddress(remoteAddress);
  }, [
    activeServiceRequest?.id,
    remoteAddress,
    remoteDelayToleranceMinutes,
    remoteLocationMode,
    remotePrice,
    remoteServiceDate,
    remoteSchedule,
    remoteTitle,
  ]);

  if (!activeServiceRequest) {
    return <Navigate to="/app" replace />;
  }

  if (activeServiceRequest.currentUserRole !== "requester") {
    return <Navigate to="/app/chat" replace />;
  }

  if (!["details", "waiting-worker", "payment", "completed"].includes(activeServiceRequest.status)) {
    return <Navigate to="/app/chat" replace />;
  }

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!title.trim() || !price.trim() || !serviceDate || !schedule.trim()) {
      setError("Preencha título, valor, data e horário para continuar.");
      return;
    }

    if (title.trim().length < 4) {
      setError("Informe um título mais claro para o acordo.");
      return;
    }

    if (parseCurrencyValue(price) <= 0) {
      setError("Informe um valor válido para o serviço.");
      return;
    }

    const scheduleMatch = /^(\d{2}):(\d{2})$/.exec(schedule.trim());

    if (!scheduleMatch) {
      setError("Informe o horário no formato HH:MM.");
      return;
    }

    const [, hoursText, minutesText] = scheduleMatch;
    const hours = Number(hoursText);
    const minutes = Number(minutesText);

    if (hours > 23 || minutes > 59) {
      setError("Informe um horário válido no formato HH:MM.");
      return;
    }

    if (locationMode === "street" && !address.trim()) {
      setError("Informe o endereço ou ponto de encontro do serviço.");
      return;
    }

    if (locationMode === "residence" && !(user?.address ?? "").trim()) {
      setError("Cadastre seu endereço no perfil para usar a opção de residência.");
      return;
    }

    setIsSubmitting(true);
    const result = await submitServiceDetails({
      title: title.trim(),
      price: price.trim(),
      serviceDate,
      schedule: schedule.trim(),
      delayToleranceMinutes,
      locationMode,
      address: locationMode === "residence" ? user?.address ?? "" : address.trim(),
    });
    setIsSubmitting(false);

    if (!result.ok) {
      setError(result.error ?? "Não conseguimos enviar os detalhes agora.");
      return;
    }

    navigate("/app/service/waiting");
  };

  const handleDeleteRequest = async () => {
    if (isDeletingRequest) {
      return;
    }

    setIsDeletingRequest(true);
    setDeleteError("");
    const result = await deleteActiveServiceRequest();
    setIsDeletingRequest(false);

    if (!result.ok) {
      setDeleteError(result.error ?? "Não conseguimos apagar este pedido agora.");
      return;
    }

    setIsDeleteConfirmOpen(false);
    navigate("/app/chat", { replace: true });
  };

  return (
    <div className="min-h-full bg-slate-50 px-4 py-6 sm:px-6">
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-5">
        <div className="flex items-start justify-between gap-4 rounded-[30px] border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <div className="min-w-0">
            <h1 className="text-2xl font-bold text-slate-900">
              Confirme o combinado antes do pagamento
            </h1>
          </div>

          <button
            type="button"
            onClick={() => navigate("/app/chat")}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-slate-200 bg-slate-50 text-slate-500 transition hover:bg-slate-100 hover:text-slate-700"
            aria-label="Voltar para o chat"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <motion.form
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          onSubmit={handleSubmit}
          className="rounded-[32px] border border-slate-200 bg-white p-5 shadow-sm sm:p-7"
        >
          <div className="rounded-[28px] border border-slate-100 bg-slate-50 p-4">
            <h2 className="text-lg font-bold text-slate-900">
              {activeServiceRequest.type}
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-slate-600">
              {activeServiceRequest.description}
            </p>
          </div>

          <label className="mt-6 block space-y-2">
            <span className="flex items-center gap-2 text-sm font-semibold text-slate-700">
              <FileText className="h-4 w-4 text-blue-600" />
              Título do acordo
            </span>
            <input
              type="text"
              value={title}
              onChange={(event) => setTitle(event.target.value.slice(0, 80))}
              placeholder="Ex.: Conserto do chuveiro"
              className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 outline-none transition focus:border-blue-500 focus:bg-white"
            />
          </label>

          <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <label className="space-y-2">
              <span className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                <DollarSign className="h-4 w-4 text-blue-600" />
                Valor combinado
              </span>
              <input
                type="text"
                value={price}
                onChange={(event) => setPrice(formatCurrencyInput(event.target.value))}
                inputMode="numeric"
                placeholder="Ex.: R$ 180,00"
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 outline-none transition focus:border-blue-500 focus:bg-white"
              />
            </label>

            <label className="space-y-2">
              <span className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                <CalendarDays className="h-4 w-4 text-blue-600" />
                Data do serviço
              </span>
              <input
                type="date"
                value={serviceDate}
                onChange={(event) => setServiceDate(event.target.value)}
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 outline-none transition focus:border-blue-500 focus:bg-white"
              />
            </label>

            <label className="space-y-2">
              <span className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                <Clock3 className="h-4 w-4 text-blue-600" />
                Horário combinado
              </span>
              <input
                type="text"
                value={schedule}
                onChange={(event) => setSchedule(formatScheduleInput(event.target.value))}
                inputMode="numeric"
                placeholder="Ex.: 19:30"
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 outline-none transition focus:border-blue-500 focus:bg-white"
              />
            </label>

            <label className="space-y-2">
              <span className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                <Clock3 className="h-4 w-4 text-blue-600" />
                Tolerância de atraso
              </span>
              <select
                value={String(delayToleranceMinutes)}
                onChange={(event) => setDelayToleranceMinutes(Number(event.target.value))}
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 outline-none transition focus:border-blue-500 focus:bg-white"
              >
                {[0, 5, 10, 15, 20, 30, 45, 60].map((minutes) => (
                  <option key={minutes} value={minutes}>
                    {formatDelayTolerance(minutes)}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="mt-5 rounded-[26px] border border-blue-100 bg-blue-50 p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-blue-700">
              Total no app
            </p>
            <div className="mt-3 grid gap-3 sm:grid-cols-4">
              <div className="rounded-2xl border border-white bg-white px-4 py-3">
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">
                  Serviço
                </p>
                <p className="mt-1 text-sm font-semibold text-slate-900">
                  {formatCurrencyAmount(serviceBaseAmount)}
                </p>
              </div>
              <div className="rounded-2xl border border-white bg-white px-4 py-3">
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">
                  Taxa Worko
                </p>
                <p className="mt-1 text-sm font-semibold text-slate-900">
                  {formatCurrencyAmount(appFeeAmount)}
                </p>
              </div>
              <div className="rounded-2xl border border-white bg-white px-4 py-3">
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">
                  Asaas fixo
                </p>
                <p className="mt-1 text-sm font-semibold text-slate-900">
                  {formatCurrencyAmount(asaasFeeAmount)}
                </p>
              </div>
              <div className="rounded-2xl border border-white bg-white px-4 py-3">
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">
                  Total a pagar
                </p>
                <p className="mt-1 text-sm font-semibold text-slate-900">
                  {formatCurrencyAmount(totalAmountWithFee)}
                </p>
              </div>
            </div>
          </div>

          <div className="mt-6 space-y-3">
            <p className="text-sm font-semibold text-slate-700">Onde o atendimento será realizado?</p>
            <div className="grid gap-3 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => setLocationMode("residence")}
                className={`rounded-2xl border px-4 py-3 text-left text-sm font-semibold transition ${
                  locationMode === "residence"
                    ? "border-blue-200 bg-blue-50 text-blue-700"
                    : "border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100"
                }`}
              >
                <span className="flex items-center gap-2">
                  <Home className="h-4 w-4" />
                  Sim, no meu endereço
                </span>
              </button>

              <button
                type="button"
                onClick={() => setLocationMode("street")}
                className={`rounded-2xl border px-4 py-3 text-left text-sm font-semibold transition ${
                  locationMode === "street"
                    ? "border-blue-200 bg-blue-50 text-blue-700"
                    : "border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100"
                }`}
              >
                <span className="flex items-center gap-2">
                  <MapPin className="h-4 w-4" />
                  Não, em outro local
                </span>
              </button>
            </div>
          </div>

          {locationMode === "residence" ? (
            <div className="mt-5 rounded-[26px] border border-emerald-200 bg-emerald-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-emerald-700">
                Endereço que será enviado
              </p>
              <p className="mt-2 text-sm font-medium text-emerald-900">
                {user?.address?.trim() || "Cadastre seu endereço no perfil para prosseguir."}
              </p>
            </div>
          ) : (
            <label className="mt-5 block space-y-2">
              <span className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                <MapPin className="h-4 w-4 text-blue-600" />
                Endereço do atendimento
              </span>
              <textarea
                value={address}
                onChange={(event) => setAddress(event.target.value)}
                rows={4}
                placeholder="Ex.: Rua principal, próximo a praca central..."
                className="w-full resize-none rounded-[26px] border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 outline-none transition focus:border-blue-500 focus:bg-white"
              />
            </label>
          )}

          {error && (
            <div className="mt-5 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={isSubmitting}
            className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-[26px] bg-blue-600 px-5 py-4 text-sm font-semibold text-white shadow-[0_18px_40px_rgba(37,99,235,0.18)] transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {isSubmitting ? "Enviando..." : "Enviar para confirmação"}
            <MoveRight className="h-4 w-4" />
          </button>

          <div className="mt-6 rounded-[26px] border border-rose-200 bg-rose-50 p-4">
            {deleteError && (
              <div className="mt-3 rounded-2xl border border-rose-200 bg-white px-4 py-3 text-sm text-rose-700">
                {deleteError}
              </div>
            )}

            <button
              type="button"
              onClick={() => {
                setDeleteError("");
                setIsDeleteConfirmOpen(true);
              }}
              className="mt-4 inline-flex items-center gap-2 rounded-2xl border border-rose-300 bg-white px-4 py-3 text-sm font-semibold text-rose-700 transition hover:bg-rose-100"
            >
              <Trash2 className="h-4 w-4" />
              Cancelar e apagar pedido
            </button>
          </div>
        </motion.form>

      </div>

      {isDeleteConfirmOpen && (
        <div className="fixed inset-0 z-[80] flex items-end justify-center bg-slate-950/45 p-4 backdrop-blur-sm sm:items-center">
          <motion.div
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            className="w-full max-w-md rounded-[30px] border border-slate-200 bg-white p-5 shadow-2xl sm:p-6"
          >
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-rose-600">
              Apagar pedido
            </p>
            <h2 className="mt-2 text-2xl font-bold text-slate-900">
              Remover este serviço sem deixar rastro?
            </h2>

            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              <button
                type="button"
                onClick={handleDeleteRequest}
                disabled={isDeletingRequest}
                className="rounded-[24px] bg-rose-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-70"
              >
                {isDeletingRequest ? "Apagando..." : "Apagar pedido"}
              </button>
              <button
                type="button"
                onClick={() => setIsDeleteConfirmOpen(false)}
                disabled={isDeletingRequest}
                className="rounded-[24px] border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-600 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-70"
              >
                Voltar
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}

