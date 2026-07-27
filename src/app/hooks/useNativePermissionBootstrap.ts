import { useEffect } from "react";
import { requestNativeNotificationPermission } from "../lib/nativeNotifications";
import { isNativeAppRuntime } from "../lib/nativeRuntime";

const SESSION_STORAGE_KEY = "worqo-native-permissions-requested";

export function useNativePermissionBootstrap(enabled: boolean) {
  useEffect(() => {
    if (!enabled || typeof window === "undefined" || !isNativeAppRuntime()) {
      return;
    }

    if (window.sessionStorage.getItem(SESSION_STORAGE_KEY) === "true") {
      return;
    }

    window.sessionStorage.setItem(SESSION_STORAGE_KEY, "true");

    const timeoutId = window.setTimeout(() => {
      void (async () => {
        try {
          await requestNativeNotificationPermission().catch(() => false);
        } catch {
          // Native prompt failure should not block app boot.
        }
      })();
    }, 350);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [enabled]);
}
