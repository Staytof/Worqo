import { Capacitor } from "@capacitor/core";
import {
  PushNotifications,
  type ActionPerformed,
  type PushNotificationSchema,
  type RegistrationError,
  type Token,
} from "@capacitor/push-notifications";
import { apiRequest } from "../api/client";
import { isNativeAppRuntime } from "./nativeRuntime";

const PUSH_CHANNEL_ID = "worqo-general";
const PUSH_TOKEN_STORAGE_KEY = "worqo-native-fcm-token-v1";

type InitializePushNotificationsOptions = {
  sessionToken: string;
  appVersion?: string;
  onNotificationReceived?: (notification: PushNotificationSchema) => void | Promise<void>;
  onNotificationAction?: (notification: ActionPerformed) => void | Promise<void>;
  onRegistrationError?: (error: RegistrationError) => void;
};

function readStoredPushToken() {
  if (typeof window === "undefined") {
    return "";
  }

  return window.localStorage.getItem(PUSH_TOKEN_STORAGE_KEY) ?? "";
}

function writeStoredPushToken(token: string) {
  if (typeof window === "undefined") {
    return;
  }

  if (!token) {
    window.localStorage.removeItem(PUSH_TOKEN_STORAGE_KEY);
    return;
  }

  window.localStorage.setItem(PUSH_TOKEN_STORAGE_KEY, token);
}

async function sendPushTokenToServer(
  sessionToken: string,
  token: string,
  appVersion: string | undefined
) {
  if (!token) {
    return;
  }

  await apiRequest("/api/me/push/register", {
    method: "POST",
    token: sessionToken,
    suppressSystemStatus: true,
    body: {
      token,
      platform: Capacitor.getPlatform(),
      appVersion: String(appVersion ?? "").trim(),
      deviceLabel: typeof navigator === "undefined" ? "" : navigator.userAgent,
    },
  });
}

export async function unregisterNativePushDevice(sessionToken?: string | null) {
  if (!isNativeAppRuntime()) {
    return;
  }

  const storedToken = readStoredPushToken();

  if (sessionToken && storedToken) {
    await apiRequest("/api/me/push/unregister", {
      method: "POST",
      token: sessionToken,
      suppressSystemStatus: true,
      body: {
        token: storedToken,
      },
    }).catch(() => undefined);
  }

  writeStoredPushToken("");
  await PushNotifications.unregister().catch(() => undefined);
}

export async function initializeNativePushNotifications({
  sessionToken,
  appVersion,
  onNotificationReceived,
  onNotificationAction,
  onRegistrationError,
}: InitializePushNotificationsOptions) {
  if (!isNativeAppRuntime() || !sessionToken) {
    return () => undefined;
  }

  await PushNotifications.createChannel({
    id: PUSH_CHANNEL_ID,
    name: "Worko",
    description: "Mensagens e atualizações do Worko",
    importance: 5,
    visibility: 1,
    vibration: true,
  }).catch(() => undefined);

  const permissions = await PushNotifications.requestPermissions().catch(() => null);

  if (permissions?.receive !== "granted") {
    return () => undefined;
  }

  const listenerHandles = await Promise.all([
    PushNotifications.addListener("registration", async (token: Token) => {
      writeStoredPushToken(token.value);
      await sendPushTokenToServer(sessionToken, token.value, appVersion).catch((error) => {
        console.warn("Não foi possível registrar o token FCM no servidor.", error);
      });
    }),
    PushNotifications.addListener("registrationError", (error: RegistrationError) => {
      onRegistrationError?.(error);
    }),
    PushNotifications.addListener(
      "pushNotificationReceived",
      async (notification: PushNotificationSchema) => {
        await onNotificationReceived?.(notification);
      }
    ),
    PushNotifications.addListener(
      "pushNotificationActionPerformed",
      async (notification: ActionPerformed) => {
        await onNotificationAction?.(notification);
      }
    ),
  ]);

  await PushNotifications.register().catch((error) => {
    console.warn("Não foi possível registrar o dispositivo no FCM.", error);
  });

  return () => {
    for (const handle of listenerHandles) {
      void handle.remove().catch(() => undefined);
    }
  };
}
