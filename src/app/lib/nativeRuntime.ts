export function isNativeAppRuntime() {
  if (typeof window === "undefined") {
    return false;
  }

  const capacitor = (window as Window & {
    Capacitor?: {
      isNativePlatform?: () => boolean;
      getPlatform?: () => string;
    };
  }).Capacitor;

  if (!capacitor) {
    return false;
  }

  if (typeof capacitor.isNativePlatform === "function") {
    return capacitor.isNativePlatform();
  }

  const platform = capacitor.getPlatform?.();
  return Boolean(platform && platform !== "web");
}
