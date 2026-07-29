import {
  Headset,
  Mail,
  MessageSquare,
  RefreshCcw,
  SendHorizontal,
  ShieldCheck,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Navigate } from "react-router";
import { apiRequest } from "../api/client";
import { supportInfo } from "../content/support";
import { useApp } from "../context/AppContext";
import { useErrorToast } from "../hooks/useErrorToast";
import type { SupportTicket } from "../types";
import { getFirstNames, getInitials } from "../utils/helpers";
import { ProfileSectionLayout } from "./profile/ProfileSectionLayout";
import { VerifiedBadge } from "./ui/verified-badge";
import { AdminSupportDesk } from "./admin/AdminSupportDesk";

function formatSupportDate(value: string | null) {
  if (!value) return "";

  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function getQueueLabel(queueAheadCount: number, status: SupportTicket["status"]) {
  if (status === "closed") return "Atendimento encerrado";
  if (queueAheadCount <= 0) {
    return status === "active"
      ? "Você está sendo atendido agora"
      : "Você é o próximo da fila";
  }
  if (queueAheadCount === 1) return "1 pessoa está na sua frente";
  return `${queueAheadCount} pessoas estáo na sua frente`;
}

function getStatusTone(status: SupportTicket["status"]) {
  if (status === "active") return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (status === "closed") return "border-slate-200 bg-slate-100 text-slate-600";
  return "border-amber-200 bg-amber-50 text-amber-700";
}

export function ProfileSupport() {
  const endRef = useRef<HTMLDivElement | null>(null);
  const {
    state: { sessionToken, user },
  } = useApp();
  const [ticket, setTicket] = useState<SupportTicket | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isOpening, setIsOpening] = useState(false);
  const [isSending, setIsSending] = useState(false);
  useErrorToast(error);

  const mailHref = supportInfo.email ? `mailto:${supportInfo.email}` : "";
  const hasOpenTicket = Boolean(ticket && ticket.status !== "closed");

  const loadTicket = async (mode: "initial" | "refresh" = "initial") => {
    if (!sessionToken) return;

    if (mode === "refresh") setIsRefreshing(true);
    else setIsLoading(true);

    try {
      const data = await apiRequest<{ ticket: SupportTicket | null }>("/api/support/ticket", {
        token: sessionToken,
      });
      setTicket(data.ticket);
      setError("");
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Não conseguimos carregar seu atendimento agora."
      );
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    void loadTicket();
  }, [sessionToken]);

  useEffect(() => {
    if (!sessionToken) return;
    const intervalId = window.setInterval(() => {
      void loadTicket("refresh");
    }, 3000);
    return () => window.clearInterval(intervalId);
  }, [sessionToken]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [ticket?.messages.length]);

  const lastMessageLabel = useMemo(() => {
    if (!ticket?.messages.length) return "";
    return formatSupportDate(ticket.messages[ticket.messages.length - 1]?.createdAt ?? null);
  }, [ticket?.messages]);

  const handleOpenSupport = async () => {
    if (!sessionToken || isOpening) return;
    setIsOpening(true);
    setError("");
    try {
      const data = await apiRequest<{ ticket: SupportTicket }>("/api/support/ticket", {
        method: "POST",
        token: sessionToken,
      });
      setTicket(data.ticket);
    } catch (openError) {
      setError(
        openError instanceof Error
          ? openError.message
          : "Não foi possível abrir o suporte online agora."
      );
    } finally {
      setIsOpening(false);
    }
  };

  const handleSendMessage = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!sessionToken || !ticket || ticket.status === "closed" || isSending) return;

    setIsSending(true);
    setError("");

    try {
      const data = await apiRequest<{ ticket: SupportTicket }>(
        `/api/support/tickets/${ticket.id}/messages`,
        {
          method: "POST",
          token: sessionToken,
          body: { body: message },
        }
      );
      setTicket(data.ticket);
      setMessage("");
    } catch (sendError) {
      setError(
        sendError instanceof Error
          ? sendError.message
          : "Não conseguimos enviar sua mensagem agora."
      );
    } finally {
      setIsSending(false);
    }
  };

  if (!user) return <Navigate to="/" replace />;

  if (user.isAdmin) {
    return (
      <ProfileSectionLayout eyebrow="SAC Worko" title="Mesa de atendimento">
        <AdminSupportDesk sessionToken={sessionToken ?? ""} />
      </ProfileSectionLayout>
    );
  }

  return (
    <ProfileSectionLayout
      eyebrow="SAC Worko"
      title="Suporte e atendimento"
    >
        <div className="grid gap-4 lg:grid-cols-[0.92fr_1.08fr]">
        <section className="worqo-section">
          <div className="flex items-start gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-[18px] border border-blue-100 bg-blue-50 text-blue-600">
              <Headset className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <h2 className="text-lg font-bold text-slate-900">Canais oficiais</h2>
            </div>
          </div>

          <div className="mt-5 worqo-divider-list">
            <div className="worqo-list-row">
              <div className="flex items-start gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-[18px] border border-blue-100 bg-blue-50 text-blue-600">
                  <Mail className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-slate-900">E-mail do suporte</p>
                  <p className="mt-1 break-words text-sm text-slate-500">
                    {supportInfo.email || "Configure o e-mail de suporte no ambiente do app."}
                  </p>
                </div>
              </div>
            </div>

            <div className="worqo-list-row">
              <div className="flex items-start gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-[18px] border border-blue-100 bg-blue-50 text-blue-600">
                  <MessageSquare className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-slate-900">Suporte online</p>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <button
              type="button"
              onClick={handleOpenSupport}
              disabled={isOpening || hasOpenTicket}
              className="rounded-[22px] bg-blue-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-blue-200"
            >
              {hasOpenTicket
                ? "Atendimento em andamento"
                : isOpening
                  ? "Abrindo atendimento..."
                  : ticket?.status === "closed"
                    ? "Abrir novo atendimento"
                    : "Abrir suporte online"}
            </button>

            {mailHref ? (
              <a
                href={mailHref}
                className="rounded-[22px] border border-blue-100 bg-white px-4 py-3 text-center text-sm font-semibold text-blue-700 transition hover:border-blue-200 hover:bg-blue-50"
              >
                Enviar e-mail
              </a>
            ) : (
              <div className="rounded-[22px] border border-slate-200 bg-slate-50 px-4 py-3 text-center text-sm font-semibold text-slate-400">
                E-mail ainda não configurado
              </div>
            )}
          </div>

          {ticket ? (
            <div className="mt-5 rounded-[26px] border border-blue-100 bg-blue-50/70 p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <span
                  className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold ${getStatusTone(ticket.status)}`}
                >
                  <ShieldCheck className="h-3.5 w-3.5" />
                  {ticket.status === "active" ? "Em atendimento" : ticket.status === "closed" ? "Encerrado" : "Na fila"}
                </span>
                <span className="text-xs font-medium text-slate-500">
                  Atualizado {formatSupportDate(ticket.updatedAt)}
                </span>
              </div>

              <p className="mt-4 text-sm font-semibold text-slate-900">
                {getQueueLabel(ticket.queueAheadCount, ticket.status)}
              </p>
              {ticket.status === "active" ? (
                <p className="mt-2 text-sm text-slate-600">
                  {ticket.assignedAdminName || "Suporte Worko"}
                </p>
              ) : null}
              {lastMessageLabel ? (
                <p className="mt-3 text-xs font-medium text-slate-500">
                  última mensagem: {lastMessageLabel}
                </p>
              ) : null}
            </div>
          ) : null}

          {error ? (
            <div className="mt-5 rounded-[22px] border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
              {error}
            </div>
          ) : null}
        </section>

        <section className="worqo-section min-h-[560px]">
          <div className="flex flex-wrap items-center justify-between gap-3 pb-4">
            <div>
              <h2 className="text-lg font-bold text-slate-900">Conversa do SAC</h2>
              <p className="mt-1 text-sm text-slate-500">
                {ticket
                  ? "Mensagens"
                  : isLoading
                    ? "Carregando seu suporte..."
                    : "Sem atendimento aberto"}
              </p>
            </div>

            <button
              type="button"
              onClick={() => void loadTicket("refresh")}
              disabled={isRefreshing}
              className="inline-flex items-center gap-2 rounded-full border border-blue-100 bg-white px-3 py-2 text-xs font-semibold text-slate-600 transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700"
            >
              <RefreshCcw className={`h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`} />
              Atualizar
            </button>
          </div>

          {isLoading ? (
            <div className="flex min-h-[420px] items-center justify-center text-sm text-slate-500">
              Carregando atendimento...
            </div>
          ) : ticket ? (
            <>
              <div className="mt-4 flex min-h-[360px] flex-col gap-3 overflow-y-auto pr-1">
                {ticket.messages.length > 0 ? (
                  ticket.messages.map((entry) => {
                    const isAdminMessage = entry.senderRole === "admin";

                    return (
                      <div
                        key={entry.id}
                        className={`flex ${isAdminMessage ? "justify-start" : "justify-end"}`}
                      >
                        <div
                          className={`max-w-[88%] rounded-[24px] px-4 py-3 shadow-sm ${
                            isAdminMessage
                              ? "border border-slate-200 bg-slate-50 text-slate-700"
                              : "bg-blue-600 text-white"
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <div
                              className={`flex h-8 w-8 items-center justify-center overflow-hidden rounded-full text-xs font-bold ${
                                isAdminMessage ? "bg-white text-slate-700" : "bg-white/20 text-white"
                              }`}
                            >
                              {entry.senderAvatar ? (
                                <img
                                  src={entry.senderAvatar}
                                  alt={entry.senderName}
                                  className="h-full w-full object-cover"
                                />
                              ) : (
                                getInitials(entry.senderName)
                              )}
                            </div>
                            <div className="min-w-0">
                              <p className="text-xs font-semibold">
                                {isAdminMessage
                                  ? entry.senderName || "Suporte Worko"
                                  : getFirstNames(user.fullName, 2)}
                              </p>
                              <p className={`text-[11px] ${isAdminMessage ? "text-slate-400" : "text-white/75"}`}>
                                {formatSupportDate(entry.createdAt)}
                              </p>
                            </div>
                            {isAdminMessage ? <VerifiedBadge size="sm" /> : null}
                          </div>

                          <p className="mt-3 whitespace-pre-wrap break-words text-sm leading-relaxed">
                            {entry.body}
                          </p>
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="flex min-h-[280px] items-center justify-center rounded-[24px] border border-dashed border-slate-200 bg-slate-50 px-6 text-center text-sm leading-relaxed text-slate-500">
                    Envie a primeira mensagem.
                  </div>
                )}
                <div ref={endRef} />
              </div>

              <form onSubmit={handleSendMessage} className="mt-4 pt-4">
                <div className="rounded-[26px] border border-slate-200 bg-slate-50 px-4 py-3">
                  <textarea
                    value={message}
                    onChange={(event) => setMessage(event.target.value.slice(0, 1600))}
                    placeholder={
                      ticket.status === "closed"
                        ? "Este atendimento foi encerrado."
                        : "Mensagem"
                    }
                    rows={4}
                    disabled={ticket.status === "closed" || isSending}
                    className="min-h-[110px] w-full resize-none bg-transparent text-sm text-slate-700 outline-none placeholder:text-slate-400 disabled:cursor-not-allowed disabled:text-slate-400"
                  />
                </div>

                <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                  <button
                    type="submit"
                    disabled={ticket.status === "closed" || isSending || !message.trim()}
                    className="inline-flex items-center gap-2 rounded-full bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-blue-200"
                  >
                    <SendHorizontal className="h-4 w-4" />
                    {isSending ? "Enviando..." : "Enviar"}
                  </button>
                </div>
              </form>
            </>
          ) : (
            <div className="flex min-h-[420px] items-center justify-center rounded-[24px] border border-dashed border-slate-200 bg-slate-50 px-6 text-center text-sm leading-relaxed text-slate-500">
              Nenhum atendimento aberto.
            </div>
          )}
        </section>
        </div>
      </ProfileSectionLayout>
  );
}

