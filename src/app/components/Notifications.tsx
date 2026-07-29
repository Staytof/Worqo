import { BellRing, CheckCheck, Trash2, X } from "lucide-react";
import { motion } from "motion/react";
import { useMemo } from "react";
import { useLocation, useNavigate } from "react-router";
import { useApp } from "../context/AppContext";
import { resolveNotificationRouteTarget } from "../lib/notificationRouting";
import type { AppNotification } from "../types";

function formatNotificationLabel(notification: AppNotification) {
  if (notification.title?.trim()) {
    return notification.title.trim();
  }

  switch (notification.kind) {
    case "chat-message":
      return "Nova mensagem";
    case "chat-request":
      return "Solicitação de conversa";
    case "chat-request-declined":
      return "Conversa recusada";
    case "support-message":
      return "Mensagem do SAC";
    case "service-details-sent":
      return "Detalhes enviados";
    case "payment-ready":
      return "Pagamento liberado";
    case "payment-confirmed":
      return "Valor protegido";
    case "wallet-available":
      return "Saque disponível";
    case "wallet-free-ready":
      return "Saque grátis liberado";
    case "notifications-reminder":
      return "Notificações pendentes";
    case "withdrawal-done":
      return "Saque concluído";
    case "withdrawal-failed":
      return "Falha no saque";
    case "dispute-opened":
      return "Disputa aberta";
    case "dispute-resolved":
      return "Disputa resolvida";
    case "service-accepted":
      return "Você foi aceito";
    case "requester-continued-search":
      return "Busca reaberta";
    case "service-cancelled":
      return "Solicitação cancelada";
    default:
      return "Notificação";
  }
}

function formatNotificationTimestamp(createdAt: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "America/Sao_Paulo",
  }).format(new Date(createdAt));
}

function compactNotificationMessage(notification: AppNotification) {
  const message = String(notification.message ?? "").trim();

  if (!message) {
    return message;
  }

  if (notification.kind === "chat-message") {
    const separatorIndex = message.indexOf(":");

    if (separatorIndex > 0) {
      return message.slice(separatorIndex + 1).trimStart();
    }
  }

  return message;
}

export function Notifications() {
  const navigate = useNavigate();
  const location = useLocation();
  const {
    state: { notifications },
    clearReadNotifications,
    markAllNotificationsRead,
    markNotificationRead,
    openChat,
    removeNotification,
  } = useApp();

  const relevantNotifications = useMemo(
    () => notifications.filter((notification) => notification.kind !== "chat-message"),
    [notifications]
  );
  const notificationHistory = useMemo(
    () =>
      [...relevantNotifications].sort(
        (left, right) =>
          new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime()
      ),
    [relevantNotifications]
  );
  const unreadNotificationCount = useMemo(
    () => relevantNotifications.filter((notification) => !notification.readAt).length,
    [relevantNotifications]
  );
  const hasReadNotifications = notificationHistory.some((notification) => notification.readAt);
  const returnTo =
    typeof location.state?.returnTo === "string" &&
    location.state.returnTo.startsWith("/app") &&
    location.state.returnTo !== "/app/notifications"
      ? location.state.returnTo
      : "/app";

  const handleOpenNotification = (notification: AppNotification) => {
    markNotificationRead(notification.id);
    const target = resolveNotificationRouteTarget(notification);

    if (target.chatId) {
      openChat(target.chatId);
    }

    navigate(target.path);
  };

  return (
    <div className="min-h-full bg-slate-50 pb-28">
      <div className="mx-auto flex w-full max-w-md flex-col px-4 pb-10 pt-5">
        <div className="rounded-[30px] border border-slate-200 bg-white px-5 py-5 shadow-sm">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-blue-600">
                Central de notificações
              </p>
              <h1 className="mt-2 text-3xl font-bold text-slate-900">Notificações</h1>
            </div>
            <button
              type="button"
              onClick={() => navigate(returnTo, { replace: true })}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-500 transition hover:bg-slate-200 hover:text-slate-700"
              aria-label="Fechar central de notificações"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="mt-5 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={markAllNotificationsRead}
              disabled={unreadNotificationCount === 0}
              className="inline-flex items-center gap-2 rounded-2xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-45"
            >
              <CheckCheck className="h-4 w-4" />
              Marcar todas como lidas
            </button>
            <button
              type="button"
              onClick={clearReadNotifications}
              disabled={!hasReadNotifications}
              className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-600 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-45"
            >
              <Trash2 className="h-4 w-4" />
              Limpar lidas
            </button>
          </div>
        </div>

        <div className="mt-5">
          <p className="text-sm font-semibold text-slate-900">
            {unreadNotificationCount > 0
              ? `${unreadNotificationCount} notificação${unreadNotificationCount === 1 ? "" : "ões"} nova${unreadNotificationCount === 1 ? "" : "s"}`
              : "Tudo em dia por aqui"}
          </p>
        </div>

        <div className="mt-4 grid gap-3">
          {notificationHistory.length === 0 ? (
            <motion.div
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              className="rounded-[30px] border border-dashed border-slate-200 bg-white px-6 py-10 text-center shadow-[0_24px_60px_rgba(15,23,42,0.05)]"
            >
              <BellRing className="mx-auto h-6 w-6 text-slate-300" />
              <p className="mt-4 text-base font-semibold text-slate-900">
                Nenhuma notificação por enquanto
              </p>
            </motion.div>
          ) : (
            notificationHistory.map((notification, index) => {
              const isUnread = !notification.readAt;
              const showChatAvatar =
                (notification.kind === "chat-message" || notification.kind === "chat-request") &&
                Boolean(notification.avatar);

              return (
                <motion.div
                  key={notification.id}
                  initial={{ opacity: 0, y: 18 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: Math.min(index * 0.03, 0.18) }}
                  onClick={() => handleOpenNotification(notification)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      handleOpenNotification(notification);
                    }
                  }}
                  className={`cursor-pointer rounded-[28px] border p-5 shadow-[0_18px_50px_rgba(15,23,42,0.06)] transition hover:-translate-y-0.5 hover:shadow-[0_22px_56px_rgba(15,23,42,0.08)] ${
                    isUnread
                      ? "border-blue-200 bg-blue-50/70"
                      : "border-slate-200 bg-white"
                  }`}
                >
                  <div className="flex items-start gap-3">
                    {showChatAvatar ? (
                      <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-full bg-blue-100 text-blue-700">
                        <img
                          src={notification.avatar ?? ""}
                          alt={formatNotificationLabel(notification)}
                          className="h-full w-full object-cover"
                        />
                      </div>
                    ) : null}

                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-400">
                            {formatNotificationLabel(notification)}
                          </p>
                          <p className="mt-2 break-words text-sm leading-relaxed text-slate-700 [overflow-wrap:anywhere]">
                            {compactNotificationMessage(notification)}
                          </p>
                        </div>

                        <div className="flex items-start gap-2">
                          <span className="shrink-0 text-[11px] text-slate-400">
                            {formatNotificationTimestamp(notification.createdAt)}
                          </span>
                          <button
                            type="button"
                            onClick={(event) => {
                              event.stopPropagation();
                              removeNotification(notification.id);
                            }}
                            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-500 transition hover:bg-slate-200 hover:text-slate-700"
                            aria-label="Fechar notificação"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        </div>
                      </div>

                      <div className="mt-4 flex items-center justify-between gap-3">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                          {isUnread ? "Não lida" : "Lida"}
                        </p>

                        {isUnread ? (
                          <button
                            type="button"
                            onClick={(event) => {
                              event.stopPropagation();
                              markNotificationRead(notification.id);
                            }}
                            className="text-sm font-semibold text-blue-600 transition hover:text-blue-700"
                          >
                            Marcar como lida
                          </button>
                        ) : null}
                      </div>
                    </div>
                  </div>
                </motion.div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}

