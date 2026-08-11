import { App } from "@capacitor/app";
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

const PUSH_CHANNEL_ID = "worko-general-v5-external";
const PUSH_TOKEN_STORAGE_KEY = "worqo-native-fcm-token-v1";
const PUSH_REGISTRATION_RETRY_DELAYS_MS = [0, 2_000, 8_000, 30_000];

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

  let disposed = false;
  let latestToken = readStoredPushToken();
  let retryTimer: ReturnType<typeof setTimeout> | null = null;

  const clearRetryTimer = () => {
    if (retryTimer) {
      clearTimeout(retryTimer);
      retryTimer = null;
    }
  };

  const registerTokenWithRetry = async (token: string, attempt = 0): Promise<void> => {
    const normalizedToken = String(token ?? "").trim();

    if (disposed || !normalizedToken) {
      return;
    }

    latestToken = normalizedToken;
    writeStoredPushToken(normalizedToken);
    clearRetryTimer();

    try {
      await sendPushTokenToServer(sessionToken, normalizedToken, appVersion);
    } catch (error) {
      const nextAttempt = attempt + 1;

      if (nextAttempt >= PUSH_REGISTRATION_RETRY_DELAYS_MS.length || disposed) {
        console.warn("Não foi possível vincular este aparelho às notificações do Worko.", error);
        return;
      }

      retryTimer = setTimeout(() => {
        void registerTokenWithRetry(normalizedToken, nextAttempt);
      }, PUSH_REGISTRATION_RETRY_DELAYS_MS[nextAttempt]);
    }
  };

  const refreshStoredToken = () => {
    const storedToken = readStoredPushToken() || latestToken;

    if (storedToken) {
      void registerTokenWithRetry(storedToken);
    }

    // Sempre solicita o token atual ao Firebase. O token salvo localmente pode
    // ter sido rotacionado ou invalidado depois de uma atualização/reinstalação.
    void PushNotifications.register().catch((error) => {
      console.warn("Não foi possível registrar este aparelho para notificações.", error);
    });
  };

  const listenerHandles = await Promise.all([
    PushNotifications.addListener("registration", async (token: Token) => {
      await registerTokenWithRetry(token.value);
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
    App.addListener("appStateChange", ({ isActive }) => {
      if (isActive) {
        refreshStoredToken();
      }
    }),
  ]);

  const handleOnline = () => refreshStoredToken();
  window.addEventListener("online", handleOnline);

  if (latestToken) {
    void registerTokenWithRetry(latestToken);
  }

  await PushNotifications.register().catch((error) => {
    console.warn("Não foi possível registrar este aparelho para notificações.", error);
  });

  return () => {
    disposed = true;
    clearRetryTimer();
    window.removeEventListener("online", handleOnline);

    for (const handle of listenerHandles) {
      void handle.remove().catch(() => undefined);
    }
  };
}
