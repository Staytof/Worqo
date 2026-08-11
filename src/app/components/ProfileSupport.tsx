import { ArrowRight, Headset, LoaderCircle, Mail, MessageSquare, ShieldCheck } from "lucide-react";
import { useEffect, useState } from "react";
import { Navigate, useNavigate } from "react-router";
import { apiRequest } from "../api/client";
import { supportInfo } from "../content/support";
import { useApp } from "../context/AppContext";
import { useErrorToast } from "../hooks/useErrorToast";
import type { SupportTicket } from "../types";
import { AdminSupportDesk } from "./admin/AdminSupportDesk";
import { ProfileSectionLayout } from "./profile/ProfileSectionLayout";

function formatSupportDate(value: string | null) {
  if (!value) return "";
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function statusLabel(ticket: SupportTicket) {
  if (ticket.status === "active") return "Em atendimento";
  if (ticket.status === "closed") return "Encerrado";
  if (ticket.queueAheadCount <= 0) return "Próximo da fila";
  return `${ticket.queueAheadCount} na sua frente`;
}

export function ProfileSupport() {
  const navigate = useNavigate();
  const {
    state: { sessionToken, user },
  } = useApp();
  const [ticket, setTicket] = useState<SupportTicket | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isOpening, setIsOpening] = useState(false);
  const [error, setError] = useState("");
  useErrorToast(error);

  useEffect(() => {
    if (!sessionToken) return;
    void apiRequest<{ ticket: SupportTicket | null }>("/api/support/ticket", {
      token: sessionToken,
    })
      .then((data) => setTicket(data.ticket))
      .catch((loadError) =>
        setError(loadError instanceof Error ? loadError.message : "Não foi possível carregar o SAC.")
      )
      .finally(() => setIsLoading(false));
  }, [sessionToken]);

  if (!user) return <Navigate to="/" replace />;

  if (user.isAdmin) {
    return (
      <ProfileSectionLayout eyebrow="SAC Worko" title="Mesa de atendimento">
        <AdminSupportDesk sessionToken={sessionToken ?? ""} />
      </ProfileSectionLayout>
    );
  }

  async function openSupportChat() {
    if (!sessionToken || isOpening) return;
    if (ticket && ticket.status !== "closed") {
      navigate(`/app/profile/support/${ticket.id}`);
      return;
    }

    setIsOpening(true);
    setError("");
    try {
      const data = await apiRequest<{ ticket: SupportTicket }>("/api/support/ticket", {
        method: "POST",
        token: sessionToken,
      });
      setTicket(data.ticket);
      navigate(`/app/profile/support/${data.ticket.id}`);
    } catch (openError) {
      setError(openError instanceof Error ? openError.message : "Não foi possível abrir o SAC.");
    } finally {
      setIsOpening(false);
    }
  }

  const lastMessage = ticket?.messages.at(-1) ?? null;

  return (
    <ProfileSectionLayout eyebrow="SAC Worko" title="Suporte e atendimento">
      <div className="mx-auto grid max-w-2xl gap-4">
        <section className="worqo-section">
          <div className="flex items-start gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-50 text-blue-600">
              <Headset className="h-5 w-5" />
            </div>
            <div>
              <h2 className="font-bold text-slate-900">Fale com a equipe Worko</h2>
              <p className="mt-1 text-sm leading-5 text-slate-500">
                Abra uma conversa reservada com o SAC. O atendimento será exibido em uma tela própria.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => void openSupportChat()}
            disabled={isLoading || isOpening}
            className="mt-5 flex w-full items-center gap-3 rounded-2xl bg-blue-600 px-4 py-4 text-left text-white shadow-lg shadow-blue-100 transition active:scale-[0.99] disabled:opacity-60"
          >
            {isOpening || isLoading ? <LoaderCircle className="h-5 w-5 animate-spin" /> : <MessageSquare className="h-5 w-5" />}
            <span className="min-w-0 flex-1">
              <strong className="block text-sm">{ticket && ticket.status !== "closed" ? "Continuar atendimento" : "Iniciar atendimento"}</strong>
              <span className="mt-0.5 block text-xs text-blue-100">Chat direto com o SAC</span>
            </span>
            <ArrowRight className="h-5 w-5" />
          </button>
        </section>

        {ticket ? (
          <section className="rounded-[24px] border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <span className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1.5 text-xs font-bold text-slate-700">
                <ShieldCheck className="h-3.5 w-3.5 text-blue-600" />
                {statusLabel(ticket)}
              </span>
              <span className="text-xs text-slate-400">{formatSupportDate(ticket.updatedAt)}</span>
            </div>
            <p className="mt-3 line-clamp-2 text-sm text-slate-600">
              {lastMessage?.body || "Atendimento aberto. Envie sua primeira mensagem."}
            </p>
          </section>
        ) : null}

        {supportInfo.email ? (
          <a href={`mailto:${supportInfo.email}`} className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700">
            <Mail className="h-4 w-4 text-blue-600" />
            {supportInfo.email}
          </a>
        ) : null}

        {error ? <p className="rounded-2xl bg-rose-50 p-3 text-sm font-semibold text-rose-700">{error}</p> : null}
      </div>
    </ProfileSectionLayout>
  );
}
