import { LocalNotifications } from "@capacitor/local-notifications";
import type { AppNotification } from "../types";
import { isNativeAppRuntime } from "./nativeRuntime";

const CHANNEL_ID = "worqo-general-v3-sound";
const DELIVERED_IDS_STORAGE_KEY = "worqo-native-delivered-notification-ids-v1";
const MAX_STORED_DELIVERED_IDS = 200;
const MAX_NATIVE_BODY_LENGTH = 140;

function truncateNotificationText(value: string, maxLength = MAX_NATIVE_BODY_LENGTH) {
  const normalized = String(value ?? "").trim();

  if (normalized.length <= maxLength) {
    return normalized;
  }

  return `${normalized.slice(0, maxLength - 1).trimEnd()}...`;
}

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
      return "Saque falhou";
    case "dispute-opened":
      return "Disputa aberta";
    case "dispute-resolved":
      return "Disputa resolvida";
    case "service-accepted":
      return "Cliente aceitou";
    case "requester-continued-search":
      return "Busca continuou";
    case "service-cancelled":
      return "Solicitação cancelada";
    default:
      return "Notificação";
  }
}

function formatNotificationTime(createdAt: string) {
  return new Intl.DateTimeFormat("pt-BR", {
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
      const sender = message.slice(0, separatorIndex).trim();
      const preview = message.slice(separatorIndex + 1).trimStart();
      return `${sender.split(/\s+/)[0] || sender}: ${preview}`;
    }
  }

  return message;
}

function parseChatMessage(notification: AppNotification) {
  const message = String(notification.message ?? "").trim();
  const separatorIndex = message.indexOf(":");

  if (notification.kind !== "chat-message") {
    return null;
  }

  if (separatorIndex <= 0) {
    return {
      sender: notification.title?.trim() || "Nova mensagem",
      preview: message,
    };
  }

  const sender = notification.title?.trim() || message.slice(0, separatorIndex).trim();
  const preview = message.slice(separatorIndex + 1).trimStart();

  return {
    sender,
    preview,
  };
}

function getStoredDeliveredIds() {
  if (typeof window === "undefined") {
    return [];
  }

  try {
    const raw = window.localStorage.getItem(DELIVERED_IDS_STORAGE_KEY);

    if (!raw) {
      return [];
    }

    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((item) => typeof item === "string") : [];
  } catch {
    return [];
  }
}

function setStoredDeliveredIds(ids: string[]) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(
    DELIVERED_IDS_STORAGE_KEY,
    JSON.stringify(ids.slice(-MAX_STORED_DELIVERED_IDS))
  );
}

function buildNotificationNumericId(notificationId: string) {
  let hash = 0;

  for (let index = 0; index < notificationId.length; index += 1) {
    hash = (hash * 31 + notificationId.charCodeAt(index)) | 0;
  }

  return Math.abs(hash) + 1000;
}

function shouldShowOutsideAppNotification() {
  if (typeof document === "undefined") {
    return false;
  }

  return document.hidden || !document.hasFocus();
}

export async function requestNativeNotificationPermission() {
  if (!isNativeAppRuntime()) {
    return false;
  }

  const currentPermissions = await LocalNotifications.checkPermissions().catch(() => null);

  if (currentPermissions?.display === "granted") {
    await LocalNotifications.createChannel({
      id: CHANNEL_ID,
      name: "Worko",
      description: "Mensagens e atualizações do Worko",
      importance: 5,
      visibility: 1,
      vibration: true,
      sound: "default",
    }).catch(() => undefined);
    return true;
  }

  const nextPermissions = await LocalNotifications.requestPermissions().catch(() => null);

  if (nextPermissions?.display !== "granted") {
    return false;
  }

  await LocalNotifications.createChannel({
    id: CHANNEL_ID,
    name: "Worko",
    description: "Mensagens e atualizações do Worko",
    importance: 5,
    visibility: 1,
    vibration: true,
    sound: "default",
  }).catch(() => undefined);

  return true;
}

export async function deliverNativeNotifications(notifications: AppNotification[]) {
  if (!isNativeAppRuntime() || notifications.length === 0 || !shouldShowOutsideAppNotification()) {
    return;
  }

  const hasPermission = await requestNativeNotificationPermission();

  if (!hasPermission) {
    return;
  }

  const deliveredIds = new Set(getStoredDeliveredIds());
  const nextNotifications = notifications.filter((notification) => !deliveredIds.has(notification.id));

  if (nextNotifications.length === 0) {
    return;
  }

  await LocalNotifications.schedule({
    notifications: nextNotifications.map((notification, index) => {
      const parsedChatMessage = parseChatMessage(notification);
      const timeLabel = formatNotificationTime(notification.createdAt);

      return {
        id: buildNotificationNumericId(notification.id),
        title: truncateNotificationText(
          parsedChatMessage ? parsedChatMessage.sender : formatNotificationLabel(notification),
          40
        ),
        body: parsedChatMessage
          ? truncateNotificationText(`${parsedChatMessage.preview} - ${timeLabel}`)
          : truncateNotificationText(`${compactNotificationMessage(notification)} - ${timeLabel}`),
        schedule: {
          at: new Date(Date.now() + 20 + index * 10),
          allowWhileIdle: true,
        },
        channelId: CHANNEL_ID,
        sound: "default",
        smallIcon: "ic_launcher",
        largeIcon:
          notification.kind === "chat-message" || notification.kind === "chat-request"
            ? notification.avatar ?? undefined
            : undefined,
        group:
          notification.kind === "chat-message" || notification.kind === "chat-request"
            ? "worqo-chat"
            : "worqo-updates",
        threadIdentifier:
          notification.kind === "chat-message" || notification.kind === "chat-request"
            ? notification.chatId ?? "worqo-chat"
            : "worqo-updates",
        summaryText:
          notification.kind === "chat-message" || notification.kind === "chat-request"
            ? "Mensagens do Worko"
            : "Atualizações do Worko",
        extra: {
          id: notification.id,
          kind: notification.kind,
          chatId: notification.chatId ?? "",
        },
      };
    }),
  }).catch(() => undefined);

  setStoredDeliveredIds([
    ...deliveredIds,
    ...nextNotifications.map((notification) => notification.id),
  ]);
}

