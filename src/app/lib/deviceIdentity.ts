import { Capacitor } from "@capacitor/core";

const DEVICE_ID_STORAGE_KEY = "worqo-device-id-v1";

export type DeviceIdentity = {
  deviceId: string;
  deviceLabel: string;
  devicePlatform: string;
  timezone: string;
  loginLocation: string;
};

function createDeviceId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  return `device-${Date.now()}-${Math.random().toString(36).slice(2, 14)}`;
}

function readDeviceId() {
  if (typeof window === "undefined") {
    return createDeviceId();
  }

  try {
    const storedId = window.localStorage.getItem(DEVICE_ID_STORAGE_KEY)?.trim();

    if (storedId) {
      return storedId;
    }

    const deviceId = createDeviceId();
    window.localStorage.setItem(DEVICE_ID_STORAGE_KEY, deviceId);
    return deviceId;
  } catch {
    return createDeviceId();
  }
}

function resolveDeviceLabel(platform: string) {
  const userAgent = typeof navigator === "undefined" ? "" : navigator.userAgent;

  if (/iphone/i.test(userAgent)) {
    return "iPhone";
  }

  if (/ipad/i.test(userAgent)) {
    return "iPad";
  }

  if (platform === "android" || /android/i.test(userAgent)) {
    const model = userAgent.match(/Android[^;]*;\s*([^;)]+?)(?:\s+Build\/|;|\))/i)?.[1]?.trim();
    return model && !/^wv$/i.test(model) ? model : "Celular Android";
  }

  if (/windows/i.test(userAgent)) {
    return "Computador Windows";
  }

  if (/macintosh|mac os/i.test(userAgent)) {
    return "Computador Mac";
  }

  return platform === "web" ? "Navegador" : "Dispositivo móvel";
}

function resolveTimezone() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "";
  } catch {
    return "";
  }
}

function resolveApproximateLocation(timezone: string) {
  const knownLocations: Record<string, string> = {
    "America/Sao_Paulo": "São Paulo, Brasil",
    "America/Fortaleza": "Fortaleza, Brasil",
    "America/Manaus": "Manaus, Brasil",
    "America/Recife": "Recife, Brasil",
    "America/Bahia": "Salvador, Brasil",
    "America/Belem": "Belém, Brasil",
    "America/Cuiaba": "Cuiabá, Brasil",
    "America/Porto_Velho": "Porto Velho, Brasil",
    "America/Rio_Branco": "Rio Branco, Brasil",
  };

  return knownLocations[timezone] ?? "Localização aproximada indisponível";
}

export function getDeviceIdentity(): DeviceIdentity {
  const nativePlatform = Capacitor.getPlatform();
  const devicePlatform = nativePlatform === "ios" || nativePlatform === "android"
    ? nativePlatform
    : "web";
  const timezone = resolveTimezone();

  return {
    deviceId: readDeviceId(),
    deviceLabel: resolveDeviceLabel(devicePlatform),
    devicePlatform,
    timezone,
    loginLocation: resolveApproximateLocation(timezone),
  };
}
