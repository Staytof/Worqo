import {
  ArrowLeft,
  CalendarDays,
  CircleDollarSign,
  Clock3,
  MapPin,
  ShieldCheck,
  Wrench,
} from "lucide-react";
import { Navigate, useNavigate } from "react-router";
import { useApp } from "../context/AppContext";

function formatServiceDate(value?: string | null) {
  if (!value) return "Conforme combinado";

  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(new Date(`${value}T12:00:00`));
}

export function CurrentServiceInfo() {
  const navigate = useNavigate();
  const {
    state: { activeServiceRequest },
  } = useApp();

  if (
    !activeServiceRequest ||
    activeServiceRequest.currentUserRole !== "worker" ||
    activeServiceRequest.status !== "confirmed"
  ) {
    return <Navigate to="/app" replace />;
  }

  const details = activeServiceRequest.details;
  const location = details?.address || activeServiceRequest.locationLabel || "Local combinado com o cliente";

  return (
    <main className="min-h-full bg-slate-50 px-4 pb-8 pt-5 text-slate-950 sm:px-6">
      <div className="mx-auto w-full max-w-2xl">
        <header className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white text-slate-700 shadow-sm"
            aria-label="Voltar ao mapa"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div className="min-w-0">
            <p className="text-[11px] font-black uppercase tracking-[0.18em] text-blue-600">Atendimento atual</p>
            <h1 className="truncate text-xl font-black">Informações do serviço</h1>
          </div>
        </header>

        <section className="mt-5 rounded-[28px] bg-white p-5 shadow-sm">
          <p className="text-xs font-black uppercase tracking-[0.15em] text-slate-400">Cliente</p>
          <h2 className="mt-1 text-xl font-black">{activeServiceRequest.requesterName}</h2>
          <p className="mt-1 text-sm font-bold text-blue-600">
            {details?.title || activeServiceRequest.type}
          </p>
          <p className="mt-4 rounded-2xl bg-slate-50 p-3.5 text-sm font-medium leading-6 text-slate-700">
            {activeServiceRequest.description}
          </p>

          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            <Info icon={CalendarDays} label="Data" value={formatServiceDate(details?.serviceDate)} />
            <Info
              icon={Clock3}
              label="Horário"
              value={details?.schedule || "Conforme combinado"}
              detail={details ? `Tolerância: ${details.delayToleranceMinutes} min` : undefined}
            />
            <Info icon={MapPin} label="Local" value={location} wide />
            <Info
              icon={CircleDollarSign}
              label="Valor do serviço"
              value={details?.price || "Conforme combinado"}
              detail="O cliente não paga deslocamento."
              wide
              tone="green"
            />
          </div>
        </section>

        <section className="mt-4 rounded-[24px] border border-amber-200 bg-amber-50 p-4">
          <div className="flex items-start gap-3">
            <Wrench className="mt-0.5 h-5 w-5 shrink-0 text-amber-700" />
            <div>
              <h2 className="font-black text-amber-950">Responsabilidades do prestador</h2>
              <ul className="mt-2 grid gap-2 text-sm font-semibold leading-5 text-amber-900">
                <li>Leve todas as ferramentas necessárias para executar o trabalho.</li>
                <li>O trajeto e seus custos são responsabilidade exclusiva do prestador.</li>
                <li>Nunca cobre do cliente combustível, transporte ou deslocamento.</li>
                <li>Respeite o escopo, a data, o horário e a tolerância combinados.</li>
              </ul>
            </div>
          </div>
        </section>

        <div className="mt-4 flex items-center gap-3 rounded-2xl bg-blue-50 p-4 text-sm font-semibold leading-5 text-blue-900">
          <ShieldCheck className="h-5 w-5 shrink-0 text-blue-600" />
          Conversas ficam na aba Mensagens e a rota permanece disponível no mapa.
        </div>
      </div>
    </main>
  );
}

function Info({
  icon: Icon,
  label,
  value,
  detail,
  wide = false,
  tone = "blue",
}: {
  icon: typeof CalendarDays;
  label: string;
  value: string;
  detail?: string;
  wide?: boolean;
  tone?: "blue" | "green";
}) {
  return (
    <div className={`flex items-start gap-3 rounded-2xl border border-slate-200 p-3.5 ${wide ? "sm:col-span-2" : ""}`}>
      <Icon className={`mt-0.5 h-5 w-5 shrink-0 ${tone === "green" ? "text-emerald-600" : "text-blue-600"}`} />
      <div className="min-w-0">
        <p className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-400">{label}</p>
        <p className="mt-1 break-words text-sm font-black leading-5 text-slate-900">{value}</p>
        {detail ? <p className="mt-0.5 text-xs text-slate-500">{detail}</p> : null}
      </div>
    </div>
  );
}
