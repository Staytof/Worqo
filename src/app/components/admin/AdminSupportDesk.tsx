import { Headset, RefreshCcw, SendHorizontal, ShieldCheck, UserCheck } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { apiRequest } from "../../api/client";
import { useErrorToast } from "../../hooks/useErrorToast";
import type { SupportTicket } from "../../types";
import { getFirstNames, getInitials } from "../../utils/helpers";

function formatAdminSupportDate(value: string | null) {
  if (!value) {
    return "";
  }

  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function getQueueLabel(queueAheadCount: number, status: SupportTicket["status"]) {
  if (status === "active") {
    return "Em atendimento";
  }

  if (status === "closed") {
    return "Encerrado";
  }

  if (queueAheadCount <= 0) {
    return "1º da fila";
  }

  if (queueAheadCount === 1) {
    return "2º da fila";
  }

  return `${queueAheadCount + 1}º da fila`;
}

type AdminSupportDeskProps = {
  sessionToken: string;
};

export function AdminSupportDesk({ sessionToken }: AdminSupportDeskProps) {
  const endRef = useRef<HTMLDivElement | null>(null);
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);
  const [replyByTicket, setReplyByTicket] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isSendingForTicket, setIsSendingForTicket] = useState<string | null>(null);
  const [isClosingForTicket, setIsClosingForTicket] = useState<string | null>(null);
  const [error, setError] = useState("");
  useErrorToast(error);

  const loadTickets = async (mode: "initial" | "refresh" = "initial") => {
    if (mode === "refresh") {
      setIsRefreshing(true);
    } else {
      setIsLoading(true);
    }

    try {
      const data = await apiRequest<{ tickets: SupportTicket[] }>("/api/admin/support/tickets", {
        token: sessionToken,
      });
      setTickets(data.tickets);
      setSelectedTicketId((current) => {
        if (current && data.tickets.some((ticket) => ticket.id === current)) {
          return current;
        }

        return data.tickets[0]?.id ?? null;
      });
      setError("");
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Não conseguimos carregar a fila do SAC agora."
      );
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    void loadTickets();
  }, [sessionToken]);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      void loadTickets("refresh");
    }, 3000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [sessionToken]);

  const selectedTicket =
    tickets.find((ticket) => ticket.id === selectedTicketId) ?? tickets[0] ?? null;

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [selectedTicket?.messages.length, selectedTicket?.updatedAt]);

  const handleSendReply = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!selectedTicket || isSendingForTicket) {
      return;
    }

    const message = String(replyByTicket[selectedTicket.id] ?? "");

    setIsSendingForTicket(selectedTicket.id);
    setError("");

    try {
      const data = await apiRequest<{ ticket: SupportTicket }>(
        `/api/admin/support/tickets/${selectedTicket.id}/messages`,
        {
          method: "POST",
          token: sessionToken,
          body: { body: message },
        }
      );

      setTickets((currentTickets) =>
        currentTickets.map((ticket) => (ticket.id === data.ticket.id ? data.ticket : ticket))
      );
      setReplyByTicket((current) => ({
        ...current,
        [selectedTicket.id]: "",
      }));
    } catch (sendError) {
      setError(
        sendError instanceof Error
          ? sendError.message
          : "Não conseguimos responder o SAC agora."
      );
    } finally {
      setIsSendingForTicket(null);
    }
  };

  const handleCloseTicket = async () => {
    if (!selectedTicket || isClosingForTicket) {
      return;
    }

    setIsClosingForTicket(selectedTicket.id);
    setError("");

    try {
      await apiRequest<{ ticket: SupportTicket }>(
        `/api/admin/support/tickets/${selectedTicket.id}/close`,
        {
          method: "PATCH",
          token: sessionToken,
        }
      );

      await loadTickets("refresh");
    } catch (closeError) {
      setError(
        closeError instanceof Error
          ? closeError.message
          : "Não conseguimos encerrar este atendimento agora."
      );
    } finally {
      setIsClosingForTicket(null);
    }
  };

  const pendingCount = useMemo(
    () => tickets.filter((ticket) => ticket.status === "waiting").length,
    [tickets]
  );

  return (
    <div className="rounded-[30px] border border-slate-800 bg-slate-950/85 p-5 shadow-[0_20px_60px_rgba(2,6,23,0.4)] backdrop-blur">
      <div className="flex flex-wrap items-start justify-between gap-4 pb-4">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-blue-300">
            SAC em tempo real
          </p>
          <h2 className="mt-2 text-xl font-bold text-slate-50">Fila de atendimento</h2>
        </div>

        <div className="flex items-center gap-3">
          <div className="rounded-[22px] border border-blue-500/35 bg-blue-500/12 px-4 py-3 text-right">
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-blue-100">
              Aguardando
            </p>
            <p className="mt-1 text-2xl font-bold text-slate-50">{pendingCount}</p>
          </div>
          <button
            type="button"
            onClick={() => void loadTickets("refresh")}
            disabled={isRefreshing}
            className="inline-flex items-center gap-2 rounded-2xl border border-slate-700 bg-slate-900 px-4 py-3 text-sm font-semibold text-slate-100 transition hover:bg-slate-800 disabled:opacity-70"
          >
            <RefreshCcw className={`h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`} />
            Atualizar
          </button>
        </div>
      </div>

      {error ? (
        <div className="mt-4 rounded-[22px] border border-rose-500/35 bg-rose-500/12 px-4 py-3 text-sm text-rose-100">
          {error}
        </div>
      ) : null}

      <div className="mt-5 grid gap-4 xl:grid-cols-[320px_1fr]">
        <div className="rounded-[26px] border border-slate-800 bg-slate-900/80 p-3">
          {isLoading ? (
            <div className="flex min-h-[280px] items-center justify-center text-sm text-slate-400">
              Carregando fila...
            </div>
          ) : tickets.length > 0 ? (
            <div className="space-y-2">
              {tickets.map((ticket) => {
                const isSelected = ticket.id === selectedTicket?.id;
                const lastMessage = ticket.messages[ticket.messages.length - 1] ?? null;

                return (
                  <button
                    key={ticket.id}
                    type="button"
                    onClick={() => setSelectedTicketId(ticket.id)}
                    className={`w-full rounded-[22px] border px-4 py-4 text-left transition ${
                      isSelected
                        ? "border-blue-500/35 bg-slate-950 shadow-sm"
                        : "border-transparent bg-transparent hover:border-slate-700 hover:bg-slate-950"
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div className="flex h-11 w-11 items-center justify-center overflow-hidden rounded-full bg-slate-800 text-sm font-bold text-slate-200">
                        {ticket.requesterAvatar ? (
                          <img
                            src={ticket.requesterAvatar}
                            alt={ticket.requesterName}
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          getInitials(ticket.requesterName)
                        )}
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <p className="truncate text-sm font-semibold text-slate-50">
                            {getFirstNames(ticket.requesterName, 2)}
                          </p>
                          <span className="rounded-full border border-blue-500/35 bg-blue-500/12 px-2 py-0.5 text-[10px] font-semibold text-blue-100">
                            {getQueueLabel(ticket.queueAheadCount, ticket.status)}
                          </span>
                        </div>
                        <p className="mt-1 truncate text-xs text-slate-400">
                          {ticket.requesterEmail || "Cliente Worko"}
                        </p>
                        <p className="mt-3 line-clamp-2 text-sm text-slate-300">
                          {lastMessage?.body || "Chamado aberto, aguardando primeira mensagem."}
                        </p>
                        <p className="mt-2 text-xs font-medium text-slate-500">
                          {formatAdminSupportDate(ticket.updatedAt)}
                        </p>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="flex min-h-[280px] items-center justify-center rounded-[22px] border border-dashed border-slate-700 bg-slate-950 px-6 text-center text-sm leading-relaxed text-slate-400">
              Nenhum chamado aberto no SAC agora.
            </div>
          )}
        </div>

        <div className="rounded-[26px] border border-slate-800 bg-slate-950 p-4">
          {selectedTicket ? (
            <>
              <div className="flex flex-wrap items-start justify-between gap-4 pb-4">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <Headset className="h-5 w-5 text-blue-300" />
                    <h3 className="text-lg font-bold text-slate-50">
                      {getFirstNames(selectedTicket.requesterName, 2)}
                    </h3>
                    <span className="rounded-full border border-emerald-500/35 bg-emerald-500/12 px-2.5 py-1 text-[11px] font-semibold text-emerald-100">
                      {selectedTicket.status === "active"
                        ? "Em atendimento"
                        : selectedTicket.queueAheadCount <= 0
                          ? "Na vez"
                          : "Na fila"}
                    </span>
                  </div>

                  <p className="mt-2 break-words text-sm text-slate-300">
                    {selectedTicket.requesterEmail}
                  </p>
                  <p className="mt-2 text-sm text-slate-300">
                    Aberto em {formatAdminSupportDate(selectedTicket.createdAt)}
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  <div className="rounded-[20px] border border-slate-700 bg-slate-900 px-4 py-3">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                      Posicao
                    </p>
                    <p className="mt-1 text-sm font-semibold text-slate-50">
                      {getQueueLabel(selectedTicket.queueAheadCount, selectedTicket.status)}
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={handleCloseTicket}
                    disabled={isClosingForTicket === selectedTicket.id}
                    className="rounded-[20px] bg-slate-900 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:opacity-70"
                  >
                    {isClosingForTicket === selectedTicket.id
                      ? "Encerrando..."
                      : "Encerrar suporte"}
                  </button>
                </div>
              </div>

              <div className="mt-4 flex min-h-[320px] flex-col gap-3 overflow-y-auto pr-1">
                {selectedTicket.messages.length > 0 ? (
                  selectedTicket.messages.map((entry) => {
                    const isAdminMessage = entry.senderRole === "admin";

                    return (
                      <div
                        key={entry.id}
                        className={`flex ${isAdminMessage ? "justify-end" : "justify-start"}`}
                      >
                        <div
                          className={`max-w-[88%] rounded-[24px] px-4 py-3 shadow-sm ${
                            isAdminMessage
                              ? "bg-blue-600 text-white"
                              : "border border-slate-700 bg-slate-900 text-slate-100"
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <div
                              className={`flex h-8 w-8 items-center justify-center overflow-hidden rounded-full text-xs font-bold ${
                                isAdminMessage
                                  ? "bg-white/20 text-white"
                                  : "bg-slate-800 text-slate-100"
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
                                {isAdminMessage ? "Você" : entry.senderName}
                              </p>
                              <p
                                className={`text-[11px] ${
                                  isAdminMessage ? "text-white/75" : "text-slate-500"
                                }`}
                              >
                                {formatAdminSupportDate(entry.createdAt)}
                              </p>
                            </div>

                            {isAdminMessage ? (
                              <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-white/15">
                                <ShieldCheck className="h-3.5 w-3.5" />
                              </span>
                            ) : (
                              <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-blue-500/15">
                                <UserCheck className="h-3.5 w-3.5 text-blue-200" />
                              </span>
                            )}
                          </div>

                          <p className="mt-3 whitespace-pre-wrap break-words text-sm leading-relaxed">
                            {entry.body}
                          </p>
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="flex min-h-[220px] items-center justify-center rounded-[24px] border border-dashed border-slate-700 bg-slate-900 px-6 text-center text-sm leading-relaxed text-slate-400">
                    Este chamado ainda não tem mensagens. Você já pode iniciar o atendimento por aqui.
                  </div>
                )}
                <div ref={endRef} />
              </div>

              <form onSubmit={handleSendReply} className="mt-4 border-t border-slate-800 pt-4">
                <div className="flex items-center gap-2 rounded-2xl border border-slate-700 bg-slate-900 px-3 py-2">
                  <input
                    value={replyByTicket[selectedTicket.id] ?? ""}
                    onChange={(event) =>
                      setReplyByTicket((current) => ({
                        ...current,
                        [selectedTicket.id]: event.target.value.slice(0, 1600),
                      }))
                    }
                    placeholder="Mensagem"
                    className="min-w-0 flex-1 bg-transparent text-sm text-slate-100 outline-none placeholder:text-slate-500"
                  />
                  <button
                    type="submit"
                    disabled={
                      isSendingForTicket === selectedTicket.id ||
                      !String(replyByTicket[selectedTicket.id] ?? "").trim()
                    }
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-blue-600 text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-700"
                    aria-label="Enviar resposta"
                  >
                    <SendHorizontal className="h-4 w-4" />
                  </button>
                </div>
              </form>
            </>
          ) : (
            <div className="flex min-h-[420px] items-center justify-center rounded-[24px] border border-dashed border-slate-700 bg-slate-900 px-6 text-center text-sm leading-relaxed text-slate-400">
              Selecione um chamado para responder ou aguarde a próxima pessoa entrar na fila do SAC.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}


