import { ArrowLeft, CheckCheck, Headset, LoaderCircle, SendHorizontal, ShieldCheck } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Navigate, useNavigate, useParams } from "react-router";
import { apiRequest } from "../api/client";
import { useApp } from "../context/AppContext";
import { useErrorToast } from "../hooks/useErrorToast";
import type { SupportTicket } from "../types";
import { getInitials } from "../utils/helpers";

function formatTime(value: string) {
  return new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit" }).format(new Date(value));
}

export function SupportChat() {
  const navigate = useNavigate();
  const { ticketId = "" } = useParams();
  const endRef = useRef<HTMLDivElement | null>(null);
  const {
    state: { sessionToken, user },
  } = useApp();
  const [ticket, setTicket] = useState<SupportTicket | null>(null);
  const [message, setMessage] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState("");
  useErrorToast(error);

  const loadTicket = async () => {
    if (!sessionToken) return;
    try {
      const data = await apiRequest<{ ticket: SupportTicket | null }>("/api/support/ticket", { token: sessionToken });
      if (!data.ticket || data.ticket.id !== ticketId) {
        navigate("/app/profile/support", { replace: true });
        return;
      }
      setTicket(data.ticket);
      setError("");
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Não foi possível atualizar o SAC.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadTicket();
    const intervalId = window.setInterval(() => void loadTicket(), 3000);
    return () => window.clearInterval(intervalId);
  }, [sessionToken, ticketId]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [ticket?.messages.length]);

  if (!user) return <Navigate to="/" replace />;

  async function sendMessage(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!sessionToken || !ticket || ticket.status === "closed" || !message.trim() || isSending) return;
    setIsSending(true);
    setError("");
    try {
      const data = await apiRequest<{ ticket: SupportTicket }>(`/api/support/tickets/${ticket.id}/messages`, {
        method: "POST",
        token: sessionToken,
        body: { body: message },
      });
      setTicket(data.ticket);
      setMessage("");
    } catch (sendError) {
      setError(sendError instanceof Error ? sendError.message : "Não foi possível enviar a mensagem.");
    } finally {
      setIsSending(false);
    }
  }

  return (
    <main className="flex h-full min-h-0 flex-col bg-slate-50 pb-[calc(82px+env(safe-area-inset-bottom,0px))]">
      <header className="flex shrink-0 items-center gap-3 border-b border-slate-100 bg-white px-4 py-3 shadow-sm">
        <button type="button" onClick={() => navigate("/app/profile/support")} className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-slate-700" aria-label="Voltar ao SAC">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div className="flex h-11 w-11 items-center justify-center rounded-full bg-blue-600 text-white"><Headset className="h-5 w-5" /></div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5"><h1 className="font-black text-slate-900">SAC Worko</h1><ShieldCheck className="h-4 w-4 text-blue-600" /></div>
          <p className="text-xs text-slate-500">{ticket?.status === "active" ? "Em atendimento" : ticket?.status === "closed" ? "Atendimento encerrado" : "Na fila de atendimento"}</p>
        </div>
      </header>

      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-5 custom-scrollbar">
        {isLoading ? (
          <div className="flex h-full items-center justify-center"><LoaderCircle className="h-6 w-6 animate-spin text-blue-600" /></div>
        ) : ticket?.messages.length ? ticket.messages.map((entry) => {
          const fromAdmin = entry.senderRole === "admin";
          return (
            <div key={entry.id} className={`flex ${fromAdmin ? "justify-start" : "justify-end"}`}>
              <div className={`max-w-[84%] rounded-2xl px-3.5 py-2.5 shadow-sm ${fromAdmin ? "rounded-tl-md border border-slate-200 bg-white text-slate-700" : "rounded-tr-md bg-blue-600 text-white"}`}>
                {fromAdmin ? (
                  <div className="mb-1.5 flex items-center gap-2 text-xs font-bold text-blue-600">
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-50">{entry.senderAvatar ? <img src={entry.senderAvatar} alt="" className="h-full w-full rounded-full object-cover" /> : getInitials(entry.senderName)}</span>
                    {entry.senderName || "Administração"}
                  </div>
                ) : null}
                <p className="whitespace-pre-wrap break-words text-sm leading-5">{entry.body}</p>
                <div className={`mt-1 flex items-center justify-end gap-1 text-[10px] ${fromAdmin ? "text-slate-400" : "text-blue-100"}`}><span>{formatTime(entry.createdAt)}</span>{!fromAdmin ? <CheckCheck className="h-3 w-3" /> : null}</div>
              </div>
            </div>
          );
        }) : (
          <p className="py-12 text-center text-sm text-slate-400">Envie a primeira mensagem para explicar como podemos ajudar.</p>
        )}
        <div ref={endRef} />
      </div>

      {error ? <p className="mx-4 mb-2 rounded-xl bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700">{error}</p> : null}

      {ticket?.status === "closed" ? (
        <div className="shrink-0 border-t border-slate-100 bg-white p-4 text-center text-sm font-semibold text-slate-500">Este atendimento foi encerrado.</div>
      ) : (
        <form onSubmit={sendMessage} className="shrink-0 border-t border-slate-100 bg-white p-3">
          <div className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2">
            <input value={message} onChange={(event) => setMessage(event.target.value.slice(0, 1600))} placeholder="Mensagem" className="min-w-0 flex-1 bg-transparent text-sm text-slate-700 outline-none placeholder:text-slate-400" />
            <button type="submit" disabled={!message.trim() || isSending} className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-600 text-white disabled:opacity-40">
              {isSending ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <SendHorizontal className="h-4 w-4" />}
            </button>
          </div>
        </form>
      )}
    </main>
  );
}
