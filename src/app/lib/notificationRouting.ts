import type { AppNotification } from "../types";

type NotificationRouteTarget = {
  path: string;
  chatId: string | null;
};

type NotificationRouteInput = {
  chatId?: string | null;
  kind?: AppNotification["kind"] | string | null;
  path?: string | null;
  data?: Record<string, unknown> | null;
};

function normalizeValue(value: unknown) {
  return String(value ?? "").trim();
}

export function resolveNotificationRouteTarget(
  notification: NotificationRouteInput
): NotificationRouteTarget {
  const kind = normalizeValue(notification.kind || notification.data?.kind);
  const chatId = normalizeValue(notification.chatId || notification.data?.chatId) || null;
  const path = normalizeValue(notification.path || notification.data?.path);

  if ((kind === "chat-message" || kind === "chat-request") && chatId) {
    return {
      path: "/app/chat",
      chatId,
    };
  }

  if (kind === "support-message") {
    return {
      path: path || "/app/profile/support",
      chatId: null,
    };
  }

  if (
    kind === "wallet-available" ||
    kind === "wallet-free-ready" ||
    kind === "withdrawal-done" ||
    kind === "withdrawal-failed"
  ) {
    return {
      path: "/app/wallet",
      chatId: null,
    };
  }

  if (kind === "payment-ready") {
    return {
      path: "/app/service/payment",
      chatId: null,
    };
  }

  if (
    kind === "service-accepted" ||
    kind === "service-details-sent" ||
    kind === "payment-confirmed" ||
    kind === "dispute-opened" ||
    kind === "dispute-resolved" ||
    kind === "requester-continued-search" ||
    kind === "service-cancelled"
  ) {
    return {
      path: "/app?focus=request",
      chatId: null,
    };
  }

  if (kind === "notifications-reminder") {
    return {
      path: "/app/notifications",
      chatId: null,
    };
  }

  return {
    path: "/app",
    chatId: null,
  };
}

export function shouldSuppressNotificationWhileChatIsOpen(
  notification: Pick<AppNotification, "chatId" | "kind">,
  activeChatId: string | null
) {
  if (notification.kind !== "chat-message") {
    return false;
  }

  const normalizedActiveChatId = normalizeValue(activeChatId);
  const normalizedChatId = normalizeValue(notification.chatId);

  return Boolean(normalizedActiveChatId && normalizedChatId && normalizedActiveChatId === normalizedChatId);
}
