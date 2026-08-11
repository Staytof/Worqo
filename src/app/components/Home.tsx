import { Geolocation } from "@capacitor/geolocation";
import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { AnimatePresence, motion } from "motion/react";
import {
  BellRing,
  Briefcase,
  CalendarDays,
  ChevronDown,
  CircleDollarSign,
  ClipboardList,
  Clock3,
  LocateFixed,
  MapPin,
  Megaphone,
  MessageCircleMore,
  Maximize2,
  Minimize2,
  RefreshCw,
  Search,
  SendHorizontal,
  ShieldCheck,
  Sparkles,
  Star,
  HelpCircle,
  TriangleAlert,
  Trash2,
  UserRound,
  Wrench,
  X,
} from "lucide-react";
import { useLocation, useNavigate } from "react-router";
import personagemDivulgandoImage from "../../assets/personagemdivulgando.png";
import personagemPedindoImage from "../../assets/personagempedindo.png";
import { apiRequest } from "../api/client";
import {
  ACCEPTED_SERVICES_NOTICE,
  RESTRICTED_SERVICES_NOTICE,
  acceptedServiceCatalog,
} from "../content/serviceCatalog";
import { useApp } from "../context/AppContext";
import { seedWorkers } from "../data/seed";
import { useErrorToast } from "../hooks/useErrorToast";
import { loadGoogleMapsApi, resolveGoogleMapsMapId } from "../lib/googleMaps";
import { isNativeAppRuntime } from "../lib/nativeRuntime";
import type {
  AppNotification,
  ActiveServiceRequest,
  PinType,
  Post,
  PublicUserProfile,
  ServiceReviewPayload,
  ServicePin,
  UserProfile,
} from "../types";
import {
  formatCurrencyAmount,
  formatCurrencyInput,
  getInitials,
  parseCurrencyValue,
} from "../utils/helpers";
import { ActiveRequestSheet } from "./service/ActiveRequestSheet";
import { PublicProfileModal } from "./profile/PublicProfileModal";
import { VerifiedBadge } from "./ui/verified-badge";

const MAP_ZOOM = 15;
const MAP_ID = resolveGoogleMapsMapId(import.meta.env.VITE_GOOGLE_MAPS_MAP_ID);
const HAS_GOOGLE_MAP_ID = Boolean(MAP_ID);
const SERVICE_AREA_MIN_ZOOM = 12;
const PRECISE_REQUEST_ACCURACY_THRESHOLD_METERS = 120;
const DEFAULT_REQUEST_MASK_RADIUS_METERS = 150;
const MIN_DISPLAY_REQUEST_MASK_RADIUS_METERS = 280;
const REQUEST_DESCRIPTION_MAX_LENGTH = 50;
const PROMOTION_DESCRIPTION_MAX_LENGTH = 160;
const PROVIDER_PROMOTION_RADIUS_KM = 8;
const PROMOTION_DURATION_OPTIONS = [1, 2, 3, 4, 5] as const;
const CLIENT_ACCENT_COLOR = "#fdcd2c";
const PROVIDER_ACCENT_COLOR = "#0046ef";
const SERVICE_AREA_LAUNCH_NOTICE =
  "O Worko está em testes de recepção do público e seu uso é exclusivo para Suzano e Itaquaquecetuba.";
const SERVICE_AREA_PLACEHOLDER = "Buscar endereço em Suzano ou Itaquaquecetuba...";
const SERVICE_AREA_CENTER = {
  lat: -23.5360294421913,
  lng: -46.32262262240631,
};
const SUZANO_BOUNDARY_PATH = [
  { lat: -23.7444, lng: -46.3219 },
  { lat: -23.7283, lng: -46.328 },
  { lat: -23.7088, lng: -46.3307 },
  { lat: -23.6775, lng: -46.3386 },
  { lat: -23.6633, lng: -46.3564 },
  { lat: -23.6424, lng: -46.3535 },
  { lat: -23.6441, lng: -46.3722 },
  { lat: -23.6176, lng: -46.3834 },
  { lat: -23.5828, lng: -46.3616 },
  { lat: -23.5735, lng: -46.3499 },
  { lat: -23.5589, lng: -46.3422 },
  { lat: -23.5384, lng: -46.3312 },
  { lat: -23.5057, lng: -46.3298 },
  { lat: -23.4888, lng: -46.331 },
  { lat: -23.4963, lng: -46.2983 },
  { lat: -23.4896, lng: -46.2881 },
  { lat: -23.4881, lng: -46.2654 },
  { lat: -23.5048, lng: -46.2692 },
  { lat: -23.5353, lng: -46.264 },
  { lat: -23.5487, lng: -46.281 },
  { lat: -23.5658, lng: -46.2849 },
  { lat: -23.6119, lng: -46.2589 },
  { lat: -23.631, lng: -46.2643 },
  { lat: -23.6493, lng: -46.2546 },
  { lat: -23.6857, lng: -46.2667 },
  { lat: -23.7048, lng: -46.2978 },
  { lat: -23.7187, lng: -46.2951 },
  { lat: -23.7444, lng: -46.3219 },
] as const;
const ITAQUAQUECETUBA_BOUNDARY_PATH = [
  { lat: -23.4298, lng: -46.2705 },
  { lat: -23.4501, lng: -46.274 },
  { lat: -23.46, lng: -46.287 },
  { lat: -23.4896, lng: -46.2881 },
  { lat: -23.4963, lng: -46.2983 },
  { lat: -23.4888, lng: -46.331 },
  { lat: -23.5057, lng: -46.3298 },
  { lat: -23.5121, lng: -46.3663 },
  { lat: -23.472, lng: -46.3819 },
  { lat: -23.4746, lng: -46.3866 },
  { lat: -23.4487, lng: -46.3936 },
  { lat: -23.4321, lng: -46.3758 },
  { lat: -23.4372, lng: -46.3584 },
  { lat: -23.4226, lng: -46.3544 },
  { lat: -23.4245, lng: -46.3029 },
  { lat: -23.4352, lng: -46.2846 },
  { lat: -23.4298, lng: -46.2705 },
] as const;
const SERVICE_AREA_PATHS = [SUZANO_BOUNDARY_PATH, ITAQUAQUECETUBA_BOUNDARY_PATH] as const;
const SERVICE_AREA_HOLE_PATHS = SERVICE_AREA_PATHS.map((path) => [...path].reverse());
const categories: Array<{
  id: "Todas" | PinType;
  label: string;
  icon: typeof Briefcase;
}> = [
  { id: "Todas", label: "Todas", icon: Briefcase },
  { id: "Conserto", label: "Conserto", icon: Wrench },
  { id: "Limpeza", label: "Limpeza", icon: Sparkles },
  { id: "Freelas", label: "Freelas", icon: Briefcase },
];
const requestComposerCategories: Array<{
  id: PinType;
  label: string;
  helper: string;
  icon: typeof Briefcase;
  activeClassName: string;
  iconClassName: string;
}> = [
  {
    id: "Conserto",
    label: "Conserto",
    helper: "Leve e técnico",
    icon: Wrench,
    activeClassName: "border-red-200 bg-red-50 text-red-700",
    iconClassName: "text-red-600",
  },
  {
    id: "Limpeza",
    label: "Limpeza",
    helper: "Higiene e cuidado",
    icon: Sparkles,
    activeClassName: "border-amber-200 bg-amber-50 text-amber-700",
    iconClassName: "text-amber-600",
  },
  {
    id: "Freelas",
    label: "Freelas",
    helper: "Apoio e tecnologia",
    icon: Briefcase,
    activeClassName: "border-emerald-200 bg-emerald-50 text-emerald-700",
    iconClassName: "text-emerald-600",
  },
];

declare global {
  interface Window {
    Capacitor?: {
      getPlatform?: () => string;
      isNativePlatform?: () => boolean;
      Plugins?: {
        Geolocation?: CapacitorGeolocationPlugin;
      };
    };
  }
}

type UserCoordinates = {
  lat: number;
  lng: number;
  accuracy: number;
};

type MapBoundsLiteral = {
  north: number;
  south: number;
  east: number;
  west: number;
};

type LatLngLiteral = {
  lat: number;
  lng: number;
};

type LocationSource = "device" | "service-area";

type CapacitorPermissionState = "prompt" | "prompt-with-rationale" | "granted" | "denied";

type CapacitorGeolocationPermissionStatus = {
  location?: CapacitorPermissionState;
  coarseLocation?: CapacitorPermissionState;
};

type CapacitorPosition = {
  coords?: {
    latitude?: number;
    longitude?: number;
    accuracy?: number;
  } | null;
} | null;

type CapacitorPositionOptions = PositionOptions & {
  minimumUpdateInterval?: number;
  interval?: number;
  enableLocationFallback?: boolean;
};

type CapacitorGeolocationPlugin = {
  getCurrentPosition: (options?: CapacitorPositionOptions) => Promise<CapacitorPosition>;
  watchPosition: (
    options: CapacitorPositionOptions,
    callback: (position: CapacitorPosition, err?: unknown) => void
  ) => Promise<string> | string;
  clearWatch: (options: { id: string }) => Promise<void> | void;
  checkPermissions?: () => Promise<CapacitorGeolocationPermissionStatus>;
  requestPermissions?: (
    permissions?: { permissions: Array<"location" | "coarseLocation"> }
  ) => Promise<CapacitorGeolocationPermissionStatus>;
};

type LocationWatchHandle =
  | {
      mode: "browser";
      id: number;
    }
  | {
      mode: "capacitor";
      id: string;
      plugin: CapacitorGeolocationPlugin;
    };

type LocationState =
  | {
      status: "loading";
      coords: null;
      error: null;
      source: null;
    }
  | {
      status: "ready";
      coords: UserCoordinates;
      error: null;
      source: LocationSource;
    }
  | {
      status: "error";
      coords: null;
      error: string;
      source: null;
    };

type ReadyLocationState = Extract<LocationState, { status: "ready" }>;

let cachedReadyLocationState: ReadyLocationState | null = null;

function createReadyLocationState(
  coords: UserCoordinates,
  source: LocationSource
): ReadyLocationState {
  return {
    status: "ready",
    coords,
    error: null,
    source,
  };
}

function createServiceAreaFallbackLocationState() {
  return createReadyLocationState(
    {
      lat: SERVICE_AREA_CENTER.lat,
      lng: SERVICE_AREA_CENTER.lng,
      accuracy: 15_000,
    },
    "service-area"
  );
}

function extractErrorMessage(error: unknown) {
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }

  return "Não conseguimos carregar sua localização.";
}

function formatAccuracy(accuracy: number) {
  if (accuracy >= 1000) {
    return `${(accuracy / 1000).toFixed(1).replace(".", ",")} km`;
  }

  return `${Math.round(accuracy)} m`;
}

function getCategoryColor(type: PinType, isActive = false) {
  const palette: Record<PinType, { default: string; active: string }> = {
    Conserto: { default: "#ef4444", active: "#dc2626" },
    Limpeza: { default: "#facc15", active: "#eab308" },
    Freelas: { default: "#22c55e", active: "#16a34a" },
  };

  return isActive ? palette[type].active : palette[type].default;
}

function getCategorySurfaceColor(type: PinType) {
  if (type === "Conserto") {
    return "#fee2e2";
  }

  if (type === "Limpeza") {
    return "#fef3c7";
  }

  return "#dcfce7";
}

function getRequestCircleStyle(
  type: PinType,
  isActive: boolean,
  viewerTone: "soft" | "strong" = "strong"
) {
  const fillOpacityByViewer =
    viewerTone === "strong"
      ? isActive
        ? 0.8
        : 0.72
      : isActive
        ? 0.14
        : 0.1;

  return {
    strokeColor: getCategoryColor(type, isActive),
    strokeOpacity: 0,
    strokeWeight: 0,
    fillColor: getCategoryColor(type, isActive),
    fillOpacity: fillOpacityByViewer,
  };
}

function getDisplayedRequestMaskRadius(maskedRadiusMeters?: number | null) {
  return Math.max(
    maskedRadiusMeters ?? DEFAULT_REQUEST_MASK_RADIUS_METERS,
    MIN_DISPLAY_REQUEST_MASK_RADIUS_METERS
  );
}

function createCategoryPinMarkerContent(maps: any, type: PinType, isActive: boolean) {
  const background = getCategoryColor(type, isActive);

  return new maps.marker.PinElement({
    background,
    borderColor: "#ffffff",
    glyphColor: "#ffffff",
    scale: isActive ? 1.14 : 1.02,
  }).element;
}

function getAccountPinColor(accountKind?: "client" | "provider" | null) {
  return accountKind === "client" ? CLIENT_ACCENT_COLOR : PROVIDER_ACCENT_COLOR;
}

function createUserMarkerContent(maps: any, accountKind?: "client" | "provider" | null) {
  return new maps.marker.PinElement({
    background: getAccountPinColor(accountKind),
    borderColor: "#ffffff",
    glyphColor: accountKind === "client" ? "#0f172a" : "#ffffff",
    scale: 1.06,
  }).element;
}
function createClientDestinationMarkerContent(maps: any) {
  return new maps.marker.PinElement({
    background: CLIENT_ACCENT_COLOR,
    borderColor: "#ffffff",
    glyphColor: "#0f172a",
    scale: 1.65,
  }).element;
}

function createClassicMarkerIcon(
  maps: any,
  color = "#2563eb",
  scale = 10,
  shape: "circle" | "pin" = "circle"
) {
  if (shape === "pin") {
    return {
      path: "M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z",
      scale: scale / 12,
      fillColor: color,
      fillOpacity: 1,
      strokeColor: "#ffffff",
      strokeWeight: 3,
      anchor: new maps.Point(12, 22),
    };
  }

  return {
    path: maps.SymbolPath.CIRCLE,
    scale,
    fillColor: color,
    fillOpacity: 1,
    strokeColor: "#ffffff",
    strokeWeight: 3,
  };
}

function createGoogleMapsMarker(
  maps: any,
  options: {
    map: any;
    position: { lat: number; lng: number };
    title: string;
    zIndex?: number;
    content?: HTMLElement;
    gmpClickable?: boolean;
    color?: string;
    scale?: number;
    shape?: "circle" | "pin";
  }
) {
  if (HAS_GOOGLE_MAP_ID && maps.marker?.AdvancedMarkerElement) {
    return new maps.marker.AdvancedMarkerElement({
      map: options.map,
      position: options.position,
      title: options.title,
      zIndex: options.zIndex,
      content: options.content,
      gmpClickable: options.gmpClickable,
    });
  }

  return new maps.Marker({
    map: options.map,
    position: options.position,
    title: options.title,
    zIndex: options.zIndex,
    clickable: options.gmpClickable ?? true,
    icon: createClassicMarkerIcon(maps, options.color, options.scale, options.shape),
  });
}

function setGoogleMapsMarkerMap(marker: any, map: any) {
  if (!marker) {
    return;
  }

  if (typeof marker.setMap === "function") {
    marker.setMap(map);
    return;
  }

  marker.map = map;
}

function setGoogleMapsMarkerPosition(marker: any, position: { lat: number; lng: number }) {
  if (!marker) {
    return;
  }

  if (typeof marker.setPosition === "function") {
    marker.setPosition(position);
    return;
  }

  marker.position = position;
}

function setGoogleMapsMarkerContent(marker: any, content: HTMLElement) {
  if (!marker) {
    return;
  }

  if ("content" in marker) {
    marker.content = content;
  }
}

function setGoogleMapsMarkerIcon(
  maps: any,
  marker: any,
  color = "#2563eb",
  scale = 10,
  shape: "circle" | "pin" = "circle"
) {
  if (!marker || typeof marker.setIcon !== "function") {
    return;
  }

  marker.setIcon(createClassicMarkerIcon(maps, color, scale, shape));
}

function setGoogleMapsMarkerTitle(marker: any, title: string) {
  if (!marker) {
    return;
  }

  if (typeof marker.setTitle === "function") {
    marker.setTitle(title);
    return;
  }

  marker.title = title;
}

function removeGoogleMapsListener(listener: any) {
  try {
    listener?.remove?.();
  } catch {
    // Ignore listener teardown races from the Maps SDK during route transitions.
  }
}

function detachGoogleMapsOverlay(overlay: any) {
  if (!overlay) {
    return;
  }

  try {
    overlay.setMap?.(null);
  } catch {
    // Some overlays are already detached by the SDK when the route changes.
  }

  try {
    if ("map" in overlay) {
      overlay.map = null;
    }
  } catch {
    // Advanced markers expose `map` as a property setter instead of `setMap`.
  }
}

function toRadians(value: number) {
  return (value * Math.PI) / 180;
}

function calculateDistanceInKm(
  origin: { lat: number; lng: number },
  destination: { lat: number; lng: number }
) {
  const earthRadiusKm = 6371;
  const deltaLat = toRadians(destination.lat - origin.lat);
  const deltaLng = toRadians(destination.lng - origin.lng);
  const originLat = toRadians(origin.lat);
  const destinationLat = toRadians(destination.lat);
  const a =
    Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2) +
    Math.cos(originLat) *
      Math.cos(destinationLat) *
      Math.sin(deltaLng / 2) *
      Math.sin(deltaLng / 2);

  return earthRadiusKm * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}

function formatDistanceLabel(distanceKm: number) {
  if (distanceKm < 1) {
    return `${Math.max(50, Math.round(distanceKm * 1000))} m`;
  }

  if (distanceKm < 10) {
    return `${distanceKm.toFixed(1).replace(".", ",")} km`;
  }

  return `${Math.round(distanceKm)} km`;
}

function derivePromotionCategory(profession: string): PinType {
  const normalizedProfession = profession
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

  if (/(limpez|diarist|faxin|organiz)/.test(normalizedProfession)) {
    return "Limpeza";
  }

  if (/(frete|freela|carret|motorist|entreg|computador|tecnolog|apoio)/.test(normalizedProfession)) {
    return "Freelas";
  }

  return "Conserto";
}

function isPromotionVisible(post: Post) {
  if (post.type !== "offer") {
    return false;
  }

  const latitude = Number(post.latitude);
  const longitude = Number(post.longitude);

  if (!post.profession || !Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    return false;
  }

  if (!post.expiresAt) {
    return true;
  }

  const expiresAt = new Date(post.expiresAt).getTime();

  return Number.isFinite(expiresAt) && expiresAt > Date.now();
}

function formatNotificationLabel(notification: AppNotification) {
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
      return "Pix confirmado";
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

function formatTimeLabel(dateString: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "America/Sao_Paulo",
  }).format(new Date(dateString));
}

function formatPromotionExpiresLabel(dateString: string | null | undefined) {
  if (!dateString) {
    return "sem data definida";
  }

  const date = new Date(dateString);

  if (Number.isNaN(date.getTime())) {
    return "sem data definida";
  }

  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "America/Sao_Paulo",
  }).format(date);
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

  const leadingName = message.match(
    /^([\p{Lu}][\p{L}'-]*)(?:\s+(?:[\p{Lu}][\p{L}'-]*|da|de|do|das|dos))+(?=\s)/u
  );

  if (!leadingName) {
    return message;
  }

  return `${leadingName[1]}${message.slice(leadingName[0].length)}`;
}

function hashMarkerSeed(value: string) {
  let hash = 0;

  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
  }

  return hash;
}

function offsetMarkerPosition(
  position: LatLngLiteral,
  angleDegrees: number,
  distanceMeters: number
) {
  const angleRadians = toRadians(angleDegrees);
  const latitudeOffset = (distanceMeters / 111_320) * Math.cos(angleRadians);
  const longitudeScale = Math.max(Math.cos(toRadians(position.lat)), 0.2);
  const longitudeOffset =
    (distanceMeters / (111_320 * longitudeScale)) * Math.sin(angleRadians);

  return {
    lat: position.lat + latitudeOffset,
    lng: position.lng + longitudeOffset,
  };
}

function resolveMarkerDisplayPosition(
  position: LatLngLiteral,
  currentUserCoords: UserCoordinates | null,
  markerSeed: string
) {
  if (!currentUserCoords) {
    return position;
  }

  const distanceKm = calculateDistanceInKm(currentUserCoords, position);

  if (distanceKm > 0.025) {
    return position;
  }

  const seedHash = hashMarkerSeed(markerSeed);

  return offsetMarkerPosition(position, seedHash % 360, 18 + (seedHash % 8));
}

function isLocalDevelopmentHostname(hostname: string) {
  return (
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname === "[::1]" ||
    hostname.endsWith(".localhost")
  );
}

function getCapacitorGeolocationPlugin() {
  if (isNativeAppRuntime()) {
    return Geolocation as unknown as CapacitorGeolocationPlugin;
  }

  if (typeof window === "undefined") {
    return null;
  }

  const plugin = window.Capacitor?.Plugins?.Geolocation;

  if (
    !plugin ||
    typeof plugin.getCurrentPosition !== "function" ||
    typeof plugin.watchPosition !== "function" ||
    typeof plugin.clearWatch !== "function"
  ) {
    return null;
  }

  return plugin;
}

function isUsingNativeLocationRuntime() {
  const plugin = getCapacitorGeolocationPlugin();

  return isNativeAppRuntime() && Boolean(plugin);
}

function resolveLocationErrorMessage(error: unknown) {
  const errorCode =
    error && typeof error === "object" && "code" in error ? String(error.code) : "";
  const errorMessage =
    error && typeof error === "object" && "message" in error && typeof error.message === "string"
      ? error.message.trim()
      : "";

  if (
    errorCode === "1" ||
    errorCode === "OS-PLUG-GLOC-0003" ||
    /permission/i.test(errorMessage)
  ) {
    return "Permita o acesso à localização do celular para continuar.";
  }

  if (
    errorCode === "3" ||
    errorCode === "OS-PLUG-GLOC-0010" ||
    /tim(e|ed) out/i.test(errorMessage)
  ) {
    return "A busca pela sua localização expirou. Ative o GPS e tente novamente.";
  }

  if (
    errorCode === "2" ||
    errorCode === "OS-PLUG-GLOC-0002" ||
    errorCode === "OS-PLUG-GLOC-0007" ||
    /unavailable/i.test(errorMessage)
  ) {
    return "Não conseguimos localizar você agora. Ative o GPS do celular.";
  }

  if (
    /secure context/i.test(errorMessage) ||
    /https/i.test(errorMessage) ||
    /somente em https/i.test(errorMessage)
  ) {
    return "A localização do navegador exige HTTPS ou um app nativo. Abra o Worko por HTTPS no celular.";
  }

  return errorMessage || "Não conseguimos carregar sua localização.";
}

function normalizeUserCoordinates(position: CapacitorPosition | GeolocationPosition) {
  const coords = position?.coords;

  if (
    !coords ||
    typeof coords.latitude !== "number" ||
    typeof coords.longitude !== "number"
  ) {
    throw new Error("O dispositivo respondeu sem coordenadas validas.");
  }

  return {
    lat: coords.latitude,
    lng: coords.longitude,
    accuracy: typeof coords.accuracy === "number" ? coords.accuracy : 9999,
  };
}

async function ensureLocationPermissionAccess() {
  const nativePlugin = getCapacitorGeolocationPlugin();

  if (nativePlugin && isUsingNativeLocationRuntime()) {
    const currentPermissions = await nativePlugin.checkPermissions?.().catch(() => null);
    const hasPermission =
      currentPermissions?.location === "granted" ||
      currentPermissions?.coarseLocation === "granted";

    if (hasPermission) {
      return;
    }

    const nextPermissions = await nativePlugin
      .requestPermissions?.({
        permissions: ["location", "coarseLocation"],
      })
      .catch(() => null);

    const grantedAfterRequest =
      nextPermissions?.location === "granted" ||
      nextPermissions?.coarseLocation === "granted";

    if (!grantedAfterRequest) {
      throw new Error("Permita o acesso à localização do celular para continuar.");
    }

    return;
  }

  if (typeof window === "undefined" || !("geolocation" in navigator)) {
    throw new Error("Geolocalização indisponível neste dispositivo.");
  }

  if (!window.isSecureContext && !isLocalDevelopmentHostname(window.location.hostname)) {
    throw new Error(
      "A localização do navegador exige HTTPS ou um app nativo. Abra o Worko por HTTPS no celular."
    );
  }

  try {
    if ("permissions" in navigator && typeof navigator.permissions?.query === "function") {
      const permissionStatus = await navigator.permissions.query({
        name: "geolocation" as PermissionName,
      });

      if (permissionStatus.state === "denied") {
        throw new Error("Permita o acesso à localização do celular para continuar.");
      }
    }
  } catch (error) {
    if (error instanceof Error) {
      throw error;
    }
  }
}

async function getCurrentUserLocation(options?: CapacitorPositionOptions) {
  await ensureLocationPermissionAccess();

  const nativePlugin = getCapacitorGeolocationPlugin();

  if (nativePlugin && isUsingNativeLocationRuntime()) {
    try {
      const position = await nativePlugin.getCurrentPosition({
        enableHighAccuracy: options?.enableHighAccuracy ?? true,
        timeout: options?.timeout ?? 20_000,
        maximumAge: options?.maximumAge ?? 15_000,
        minimumUpdateInterval: options?.minimumUpdateInterval ?? 2_000,
      });

      return normalizeUserCoordinates(position);
    } catch (error) {
      throw new Error(resolveLocationErrorMessage(error));
    }
  }

  return new Promise<UserCoordinates>((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(
      (position) => {
        try {
          resolve(normalizeUserCoordinates(position));
        } catch (error) {
          reject(error);
        }
      },
      (error) => {
        reject(new Error(resolveLocationErrorMessage(error)));
      },
      {
        enableHighAccuracy: options?.enableHighAccuracy ?? true,
        timeout: options?.timeout ?? 20_000,
        maximumAge: options?.maximumAge ?? 15_000,
      }
    );
  });
}

function clearLocationWatch(handle: LocationWatchHandle | null) {
  if (!handle) {
    return;
  }

  if (handle.mode === "browser") {
    navigator.geolocation.clearWatch(handle.id);
    return;
  }

  void Promise.resolve(handle.plugin.clearWatch({ id: handle.id })).catch(() => {
    // A limpeza do monitoramento de localização não deve quebrar o fluxo principal.
  });
}

async function watchUserLocation(
  onSuccess: (coords: UserCoordinates) => void,
  onError: (error: Error) => void,
  options?: CapacitorPositionOptions
) {
  await ensureLocationPermissionAccess();

  const nativePlugin = getCapacitorGeolocationPlugin();

  if (nativePlugin && isUsingNativeLocationRuntime()) {
    try {
      const watchId = await nativePlugin.watchPosition(
        {
          enableHighAccuracy: options?.enableHighAccuracy ?? true,
          timeout: options?.timeout ?? 15_000,
          maximumAge: options?.maximumAge ?? 15_000,
          minimumUpdateInterval: options?.minimumUpdateInterval ?? 2_000,
        },
        (position, error) => {
          if (error) {
            onError(new Error(resolveLocationErrorMessage(error)));
            return;
          }

          if (!position?.coords) {
            return;
          }

          try {
            onSuccess(normalizeUserCoordinates(position));
          } catch (normalizeError) {
            onError(
              normalizeError instanceof Error
                ? normalizeError
                : new Error("Não conseguimos ler a localização do dispositivo.")
            );
          }
        }
      );

      return {
        mode: "capacitor" as const,
        id: String(watchId),
        plugin: nativePlugin,
      };
    } catch (error) {
      throw new Error(resolveLocationErrorMessage(error));
    }
  }

  return {
    mode: "browser" as const,
    id: navigator.geolocation.watchPosition(
      (position) => {
        try {
          onSuccess(normalizeUserCoordinates(position));
        } catch (normalizeError) {
          onError(
            normalizeError instanceof Error
              ? normalizeError
              : new Error("Não conseguimos ler a localização do dispositivo.")
          );
        }
      },
      (error) => {
        onError(new Error(resolveLocationErrorMessage(error)));
      },
      {
        enableHighAccuracy: options?.enableHighAccuracy ?? true,
        timeout: options?.timeout ?? 15_000,
        maximumAge: options?.maximumAge ?? 15_000,
      }
    ),
  };
}

function getDevicePreciseLocation(options?: CapacitorPositionOptions) {
  return getCurrentUserLocation(options).then((coords) => ({
    source: "device" as const,
    coords,
  }));
}

function waitForAcceptedPreciseDeviceLocation(
  targetAccuracy = PRECISE_REQUEST_ACCURACY_THRESHOLD_METERS,
  timeoutMs = 18000
) {
  return new Promise<ReturnType<typeof getDevicePreciseLocation> extends Promise<infer T> ? T : never>(
    (resolve, reject) => {
      let settled = false;
      let bestCoords: UserCoordinates | null = null;
      let watchHandle: LocationWatchHandle | null = null;
      const timeoutId = window.setTimeout(() => {
        if (bestCoords) {
          rejectOnce(
            new Error(
              `A localização do aparelho ainda está imprecisa (${formatAccuracy(
                bestCoords.accuracy
              )}). Ative GPS e Wi-Fi do celular e toque em atualizar localização.`
            )
          );
          return;
        }

        rejectOnce(
          new Error(
            "Não conseguimos obter a localização exata do celular. Ative GPS e Wi-Fi e toque em atualizar localização."
          )
        );
      }, timeoutMs);

      const cleanup = () => {
        window.clearTimeout(timeoutId);
        clearLocationWatch(watchHandle);
        watchHandle = null;
      };

      const resolveOnce = (coords: UserCoordinates) => {
        if (settled) {
          return;
        }

        settled = true;
        cleanup();
        resolve({
          source: "device",
          coords,
        });
      };

      const rejectOnce = (error: Error) => {
        if (settled) {
          return;
        }

        settled = true;
        cleanup();
        reject(error);
      };

      void watchUserLocation(
        (nextCoords) => {
          if (!bestCoords || nextCoords.accuracy < bestCoords.accuracy) {
            bestCoords = nextCoords;
          }

          if (nextCoords.accuracy <= targetAccuracy) {
            resolveOnce(nextCoords);
          }
        },
        (error) => {
          rejectOnce(error);
        },
        {
          enableHighAccuracy: true,
          timeout: 15000,
          maximumAge: 15000,
          minimumUpdateInterval: 2000,
        }
      )
        .then((handle) => {
          if (settled) {
            clearLocationWatch(handle);
            return;
          }

          watchHandle = handle;
        })
        .catch((error) => {
          rejectOnce(error instanceof Error ? error : new Error(resolveLocationErrorMessage(error)));
        });
    }
  );
}

async function resolveBestAvailableLocation(options?: { allowServiceAreaFallback?: boolean }) {
  try {
    return await getDevicePreciseLocation({
      enableHighAccuracy: true,
      timeout: 12_000,
      maximumAge: 15_000,
      minimumUpdateInterval: 2_000,
    });
  } catch {
    if (options?.allowServiceAreaFallback === false) {
      return null;
    }

    return createServiceAreaFallbackLocationState();
  }
}

function getBoundsFromPath(path: readonly LatLngLiteral[]): MapBoundsLiteral {
  return path.reduce(
    (accumulator, point) => ({
      north: Math.max(accumulator.north, point.lat),
      south: Math.min(accumulator.south, point.lat),
      east: Math.max(accumulator.east, point.lng),
      west: Math.min(accumulator.west, point.lng),
    }),
    {
      north: Number.NEGATIVE_INFINITY,
      south: Number.POSITIVE_INFINITY,
      east: Number.NEGATIVE_INFINITY,
      west: Number.POSITIVE_INFINITY,
    }
  );
}

function getBoundsFromPaths(paths: readonly (readonly LatLngLiteral[])[]) {
  return paths
    .map((path) => getBoundsFromPath(path))
    .reduce((accumulator, bounds) => mergeBounds(accumulator, bounds));
}

function isWithinPolygon(path: readonly LatLngLiteral[], point: { lat: number; lng: number }) {
  let isInside = false;

  for (let current = 0, previous = path.length - 1; current < path.length; previous = current++) {
    const currentPoint = path[current];
    const previousPoint = path[previous];
    const intersects =
      currentPoint.lat > point.lat !== previousPoint.lat > point.lat &&
      point.lng <
        ((previousPoint.lng - currentPoint.lng) * (point.lat - currentPoint.lat)) /
          (previousPoint.lat - currentPoint.lat) +
          currentPoint.lng;

    if (intersects) {
      isInside = !isInside;
    }
  }

  return isInside;
}

function isWithinServiceArea(point: { lat: number; lng: number }) {
  return SERVICE_AREA_PATHS.some((path) => isWithinPolygon(path, point));
}

function mergeBounds(primary: MapBoundsLiteral, secondary: MapBoundsLiteral): MapBoundsLiteral {
  return {
    north: Math.max(primary.north, secondary.north),
    south: Math.min(primary.south, secondary.south),
    east: Math.max(primary.east, secondary.east),
    west: Math.min(primary.west, secondary.west),
  };
}

function getCenterFromBounds(bounds: MapBoundsLiteral) {
  return {
    lat: (bounds.north + bounds.south) / 2,
    lng: (bounds.east + bounds.west) / 2,
  };
}

function getCategoryChipClasses(category: "Todas" | PinType, isActive: boolean) {
  if (!isActive) {
    return "border-white/10 bg-slate-950/68 text-white/78 hover:bg-slate-950/82";
  }

  if (category === "Conserto") {
    return "border-red-400 bg-red-500 text-white";
  }

  if (category === "Limpeza") {
    return "border-yellow-400 bg-yellow-400 text-slate-950";
  }

  if (category === "Freelas") {
    return "border-emerald-400 bg-emerald-500 text-white";
  }

  return "border-sky-400 bg-sky-500 text-white";
}

function getCategoryActionClasses(type: PinType) {
  if (type === "Conserto") {
    return "bg-red-500 hover:bg-red-400";
  }

  if (type === "Limpeza") {
    return "bg-yellow-400 text-slate-950 hover:bg-yellow-300";
  }

  return "bg-emerald-500 hover:bg-emerald-400";
}

function getClientCategoryCardClasses(type: PinType, isActive: boolean) {
  if (type === "Conserto") {
    return isActive
      ? "bg-blue-600 text-white shadow-[0_8px_20px_rgba(37,99,235,0.22)]"
      : "bg-blue-50 text-blue-600 active:bg-blue-100";
  }

  if (type === "Limpeza") {
    return isActive
      ? "bg-emerald-500 text-white shadow-[0_8px_20px_rgba(16,185,129,0.22)]"
      : "bg-emerald-50 text-emerald-600 active:bg-emerald-100";
  }

  return isActive
    ? "bg-amber-500 text-white shadow-[0_8px_20px_rgba(245,158,11,0.22)]"
    : "bg-amber-50 text-amber-600 active:bg-amber-100";
}

function buildFallbackWorkerProfile(
  activeServiceRequest: NonNullable<ReturnType<typeof useApp>["state"]["activeServiceRequest"]>
) {
  const genericSkillsByCategory: Record<PinType, string[]> = {
    Conserto: ["Montagem leve", "Diagnostico técnico", "Atendimento local"],
    Limpeza: ["Higienização leve", "Organização", "Agendamento rapido"],
    Freelas: ["Suporte digital", "Apoio local", "Entrega alinhada"],
  };

  return {
    id: activeServiceRequest.workerId ?? `worker-preview-${activeServiceRequest.id}`,
    name: activeServiceRequest.workerName ?? "Profissional",
    accent: "blue" as const,
    isVerified: Boolean(activeServiceRequest.workerVerified),
    category: activeServiceRequest.type,
    rating: 5,
    completedServices: 0,
    bio: `Este(a) profissional demonstrou interesse no seu pedido de ${activeServiceRequest.type.toLowerCase()} e pode alinhar os detalhes pelo chat do Worko.`,
    professions: [activeServiceRequest.type],
    skills: genericSkillsByCategory[activeServiceRequest.type],
    servicePitch: `Disponível para conversar sobre seu atendimento de ${activeServiceRequest.type.toLowerCase()}.`,
    avatar: null,
  };
}

function resolveCreateServiceRequestEligibilityError(user: UserProfile | null | undefined) {
  if (!user) {
    return "Não encontramos sua conta para publicar o pedido.";
  }

  if (!user.isCpfVerified) {
    return "Para publicar um pedido no mapa, confirme seu CPF no perfil.";
  }

  return null;
}

function normalizeProfessionLabel(profession: string) {
  return profession
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function isInternalReviewProfession(profession: string) {
  return /(revisao do app|review|google play|teste|tester|console)/.test(
    normalizeProfessionLabel(profession)
  );
}

function isServiceProfession(profession: string) {
  const normalizedProfession = profession
    ? normalizeProfessionLabel(profession)
    : "";

  if (!normalizedProfession) {
    return false;
  }

  return !isInternalReviewProfession(profession);
}

function getServiceProfessions(user: UserProfile | null | undefined) {
  const professions = user?.professions ?? [];
  const serviceProfessions = professions.filter(isServiceProfession);

  if (serviceProfessions.length === 0 && professions.some(isInternalReviewProfession)) {
    return ["Suporte técnico"];
  }

  return serviceProfessions;
}

function resolveCreatePromotionEligibilityError(user: UserProfile | null | undefined) {
  if (!user) {
    return "Não encontramos sua conta para publicar sua divulgação.";
  }

  if (!user.isCpfVerified) {
    return "Confirme seu CPF no perfil antes de divulgar seu serviço.";
  }

  if (getServiceProfessions(user).length === 0) {
    return "Adicione pelo menos uma profissão em Meus Dados para divulgar seu serviço.";
  }

  return null;
}

function shouldUpgradeCachedLocation(
  currentLocation: ReadyLocationState | null,
  nextLocation: ReadyLocationState
) {
  if (!currentLocation) {
    return true;
  }

  if (currentLocation.source === "device" && nextLocation.source !== "device") {
    return false;
  }

  if (currentLocation.source !== "device" && nextLocation.source === "device") {
    return true;
  }

  return nextLocation.coords.accuracy + 15 < currentLocation.coords.accuracy;
}

function ClientLocationPreview() {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<any>(null);
  const mapsRef = useRef<any>(null);
  const markerRef = useRef<any>(null);
  const accuracyCircleRef = useRef<any>(null);
  const serviceAreaMaskRef = useRef<any>(null);
  const serviceAreaOutlineRefs = useRef<any[]>([]);
  const idleListenerRef = useRef<any>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "fallback" | "error">("loading");

  useEffect(() => {
    let cancelled = false;

    const syncServiceAreaMask = (maps: any, map: any, serviceAreaBounds: MapBoundsLiteral) => {
      const viewportBounds = map.getBounds?.();

      if (!viewportBounds) {
        return;
      }

      const viewportLiteral: MapBoundsLiteral = {
        north: viewportBounds.getNorthEast().lat(),
        east: viewportBounds.getNorthEast().lng(),
        south: viewportBounds.getSouthWest().lat(),
        west: viewportBounds.getSouthWest().lng(),
      };
      const mergedBounds = mergeBounds(viewportLiteral, serviceAreaBounds);
      const padding = 0.02;
      const outerMaskPath = [
        { lat: mergedBounds.north + padding, lng: mergedBounds.west - padding },
        { lat: mergedBounds.north + padding, lng: mergedBounds.east + padding },
        { lat: mergedBounds.south - padding, lng: mergedBounds.east + padding },
        { lat: mergedBounds.south - padding, lng: mergedBounds.west - padding },
      ];

      if (!serviceAreaMaskRef.current) {
        serviceAreaMaskRef.current = new maps.Polygon({
          map,
          paths: [outerMaskPath, ...SERVICE_AREA_HOLE_PATHS],
          fillColor: "#020617",
          fillOpacity: 0.16,
          strokeOpacity: 0,
          clickable: false,
          zIndex: 2,
        });
        return;
      }

      serviceAreaMaskRef.current.setMap(map);
      serviceAreaMaskRef.current.setPaths([outerMaskPath, ...SERVICE_AREA_HOLE_PATHS]);
    };

    const syncServiceAreaOutline = (maps: any, map: any) => {
      if (!serviceAreaOutlineRefs.current.length) {
        serviceAreaOutlineRefs.current = SERVICE_AREA_PATHS.map(
          (path) =>
            new maps.Polygon({
              map,
              paths: path,
              fillOpacity: 0,
              strokeColor: "#2563eb",
              strokeOpacity: 0.98,
              strokeWeight: 4,
              clickable: false,
              zIndex: 3,
            })
        );
        return;
      }

      serviceAreaOutlineRefs.current.forEach((outline, index) => {
        outline.setMap(map);
        outline.setPaths(SERVICE_AREA_PATHS[index]);
      });
    };

    async function initializePreviewMap() {
      setStatus("loading");

      try {
        const maps = await loadGoogleMapsApi();
        const serviceAreaBounds = getBoundsFromPaths(SERVICE_AREA_PATHS);

        if (cancelled || !mapContainerRef.current) {
          return;
        }

        mapsRef.current = maps;

        const map =
          mapRef.current ??
          new maps.Map(mapContainerRef.current, {
            center: SERVICE_AREA_CENTER,
            zoom: SERVICE_AREA_MIN_ZOOM,
            mapId: MAP_ID,
            colorScheme: "LIGHT",
            disableDefaultUI: true,
            clickableIcons: false,
            draggable: false,
            scrollwheel: false,
            disableDoubleClickZoom: true,
            keyboardShortcuts: false,
            gestureHandling: "none",
            mapTypeControl: false,
            streetViewControl: false,
            fullscreenControl: false,
            zoomControl: false,
            minZoom: SERVICE_AREA_MIN_ZOOM,
            restriction: {
              latLngBounds: serviceAreaBounds,
              strictBounds: true,
            },
          });

        mapRef.current = map;
        map.setOptions({
          colorScheme: "LIGHT",
          minZoom: SERVICE_AREA_MIN_ZOOM,
          restriction: {
            latLngBounds: serviceAreaBounds,
            strictBounds: true,
          },
        });
        map.fitBounds(serviceAreaBounds, 18);
        syncServiceAreaMask(maps, map, serviceAreaBounds);
        syncServiceAreaOutline(maps, map);

        removeGoogleMapsListener(idleListenerRef.current);
        idleListenerRef.current = map.addListener("idle", () => {
          syncServiceAreaMask(maps, map, serviceAreaBounds);
        });

        const location = await resolveBestAvailableLocation({
          allowServiceAreaFallback: false,
        });

        if (cancelled || !location) {
          setStatus("fallback");
          return;
        }

        const isInsideServiceArea = isWithinServiceArea(location.coords);

        if (!isInsideServiceArea) {
          setStatus("fallback");
          return;
        }

        map.setCenter(location.coords);
        map.setZoom(MAP_ZOOM);

        markerRef.current = createGoogleMapsMarker(maps, {
          map,
          position: location.coords,
          title: "Sua localiza??o",
          zIndex: 10,
          content: createUserMarkerContent(maps, "client"),
          color: CLIENT_ACCENT_COLOR,
          gmpClickable: false,
        });

        accuracyCircleRef.current = new maps.Circle({
          map,
          center: location.coords,
          radius: location.coords.accuracy,
          strokeColor: "#2563eb",
          strokeOpacity: 0.28,
          strokeWeight: 1,
          fillColor: "#2563eb",
          fillOpacity: 0.1,
          clickable: false,
          zIndex: 1,
        });

        setStatus("ready");
      } catch {
        setStatus("error");
      }
    }

    void initializePreviewMap();

    return () => {
      cancelled = true;
      removeGoogleMapsListener(idleListenerRef.current);
      detachGoogleMapsOverlay(markerRef.current);
      detachGoogleMapsOverlay(accuracyCircleRef.current);
      detachGoogleMapsOverlay(serviceAreaMaskRef.current);
      serviceAreaOutlineRefs.current.forEach((outline) => detachGoogleMapsOverlay(outline));
      serviceAreaOutlineRefs.current = [];
      idleListenerRef.current = null;
      markerRef.current = null;
      accuracyCircleRef.current = null;
      serviceAreaMaskRef.current = null;
      mapRef.current = null;
      mapsRef.current = null;
    };
  }, []);

  const statusLabel =
    status === "ready"
      ? "Sua localiza??o"
      : status === "loading"
        ? "Localizando..."
        : "Região atendida";

  return (
    <section className="home-map-preserve-theme overflow-hidden rounded-[22px] bg-white">
      <div className="relative h-48 overflow-hidden bg-slate-950">
        <div ref={mapContainerRef} className="absolute inset-0" />
        {status !== "error" ? (
          <div className="pointer-events-none absolute inset-0 bg-slate-950/8" />
        ) : null}

        <div className="pointer-events-none absolute left-4 top-4 z-10 rounded-full border border-white/12 bg-slate-950/78 px-3 py-2 text-xs font-bold text-white">
          {statusLabel}
        </div>

        {status === "loading" ? (
          <div className="absolute inset-0 z-20 flex items-center justify-center bg-slate-950/18 px-6 text-center">
            <div className="rounded-[18px] bg-slate-950/80 px-4 py-3 text-xs font-semibold leading-relaxed text-white">
              Carregando mapa...
            </div>
          </div>
        ) : null}

      </div>

      <div className="space-y-3 px-4 py-4">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-blue-50 text-blue-600">
            <MapPin className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <h2 className="text-sm font-black text-slate-950">Localização do atendimento</h2>
            <p className="mt-1 text-xs leading-relaxed text-slate-500">
              A localização é usada para encontrar prestadores(as) próximos(as) dentro da região atendida.
            </p>
          </div>
        </div>

        <div className="flex items-start gap-2 rounded-[22px] bg-blue-50 px-3 py-3 text-xs font-semibold leading-relaxed text-blue-700">
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" />
          <span>
            Prestadores(as) não recebem sua localização exata antes do acordo ser fechado.
          </span>
        </div>
      </div>
    </section>
  );
}

type ClientLocationPreviewCleanProps = {
  activeRequest?: ActiveServiceRequest | null;
  onOpenRequest?: () => void;
};

function ClientLocationPreviewClean({
  activeRequest = null,
  onOpenRequest,
}: ClientLocationPreviewCleanProps) {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<any>(null);
  const markerRef = useRef<any>(null);
  const accuracyCircleRef = useRef<any>(null);
  const searchCoverageCircleRef = useRef<any>(null);
  const searchRadarCircleRef = useRef<any>(null);
  const searchRadarFrameRef = useRef<number | null>(null);
  const searchRadarTimeoutRef = useRef<number | null>(null);
  const serviceAreaOutlineRefs = useRef<any[]>([]);
  const [status, setStatus] = useState<"loading" | "ready" | "fallback" | "error">("loading");
  const [isInfoOpen, setIsInfoOpen] = useState(false);
  const isSearchMode = Boolean(activeRequest);
  const searchCenter =
    activeRequest &&
    Number.isFinite(Number(activeRequest.latitude)) &&
    Number.isFinite(Number(activeRequest.longitude))
      ? {
          lat: Number(activeRequest.latitude),
          lng: Number(activeRequest.longitude),
        }
      : null;

  const clearSearchOverlay = () => {
    if (searchRadarFrameRef.current !== null) {
      window.cancelAnimationFrame(searchRadarFrameRef.current);
      searchRadarFrameRef.current = null;
    }

    if (searchRadarTimeoutRef.current !== null) {
      window.clearTimeout(searchRadarTimeoutRef.current);
      searchRadarTimeoutRef.current = null;
    }

    detachGoogleMapsOverlay(searchCoverageCircleRef.current);
    detachGoogleMapsOverlay(searchRadarCircleRef.current);
    searchCoverageCircleRef.current = null;
    searchRadarCircleRef.current = null;
  };

  useEffect(() => {
    let cancelled = false;

    const syncServiceAreaOutline = (maps: any, map: any) => {
      if (!serviceAreaOutlineRefs.current.length) {
        serviceAreaOutlineRefs.current = SERVICE_AREA_PATHS.map(
          (path) =>
            new maps.Polygon({
              map,
              paths: path,
              fillOpacity: 0,
              strokeColor: "#2563eb",
              strokeOpacity: 0.64,
              strokeWeight: 3,
              clickable: false,
              zIndex: 3,
            })
        );
        return;
      }

      serviceAreaOutlineRefs.current.forEach((outline, index) => {
        outline.setMap(map);
        outline.setPaths(SERVICE_AREA_PATHS[index]);
      });
    };

    async function initializePreviewMap() {
      setStatus("loading");

      try {
        const maps = await loadGoogleMapsApi();
        const serviceAreaBounds = getBoundsFromPaths(SERVICE_AREA_PATHS);

        if (cancelled || !mapContainerRef.current) {
          return;
        }

        const map = new maps.Map(mapContainerRef.current, {
          center: SERVICE_AREA_CENTER,
          zoom: isSearchMode ? 12 : SERVICE_AREA_MIN_ZOOM,
          mapId: MAP_ID,
          colorScheme: "LIGHT",
          disableDefaultUI: true,
          clickableIcons: false,
          draggable: false,
          scrollwheel: false,
          disableDoubleClickZoom: true,
          keyboardShortcuts: false,
          gestureHandling: "none",
          mapTypeControl: false,
          streetViewControl: false,
          fullscreenControl: false,
          zoomControl: false,
          minZoom: SERVICE_AREA_MIN_ZOOM,
          restriction: {
            latLngBounds: serviceAreaBounds,
            strictBounds: true,
          },
        });

        mapRef.current = map;
        map.fitBounds(serviceAreaBounds, 18);
        syncServiceAreaOutline(maps, map);

        if (searchCenter && isWithinServiceArea(searchCenter)) {
          map.setCenter(searchCenter);
          map.setZoom(12);

          markerRef.current = createGoogleMapsMarker(maps, {
            map,
            position: searchCenter,
            title: "Local do pedido",
            zIndex: 10,
            content: createUserMarkerContent(maps, "client"),
            color: CLIENT_ACCENT_COLOR,
            gmpClickable: false,
          });

          setStatus("ready");
          return;
        }

        const location = await resolveBestAvailableLocation({
          allowServiceAreaFallback: false,
        });

        if (cancelled || !location) {
          setStatus("fallback");
          return;
        }

        if (!isWithinServiceArea(location.coords)) {
          setStatus("fallback");
          return;
        }

        map.setCenter(location.coords);
        map.setZoom(MAP_ZOOM);

        markerRef.current = createGoogleMapsMarker(maps, {
          map,
          position: location.coords,
          title: "Sua localiza??o",
          zIndex: 10,
          content: createUserMarkerContent(maps, "client"),
          color: CLIENT_ACCENT_COLOR,
          gmpClickable: false,
        });

        accuracyCircleRef.current = new maps.Circle({
          map,
          center: location.coords,
          radius: location.coords.accuracy,
          strokeColor: "#2563eb",
          strokeOpacity: 0.28,
          strokeWeight: 1,
          fillColor: "#2563eb",
          fillOpacity: 0.1,
          clickable: false,
          zIndex: 1,
        });

        setStatus("ready");
      } catch {
        setStatus("error");
      }
    }

    void initializePreviewMap();

    return () => {
      cancelled = true;
      clearSearchOverlay();
      detachGoogleMapsOverlay(markerRef.current);
      detachGoogleMapsOverlay(accuracyCircleRef.current);
      serviceAreaOutlineRefs.current.forEach((outline) => detachGoogleMapsOverlay(outline));
      serviceAreaOutlineRefs.current = [];
      markerRef.current = null;
      accuracyCircleRef.current = null;
      mapRef.current = null;
    };
  }, [activeRequest?.id, isSearchMode, searchCenter?.lat, searchCenter?.lng]);

  useEffect(() => {
    const map = mapRef.current;

    if (!isSearchMode || status !== "ready" || !map || !searchCenter) {
      clearSearchOverlay();
      return;
    }

    let cancelled = false;

    async function syncSearchOverlay() {
      let maps;

      try {
        maps = await loadGoogleMapsApi();
      } catch {
        setStatus("error");
        return;
      }

      if (cancelled || !mapRef.current || !searchCenter) {
        return;
      }

      const radiusMeters = PROVIDER_PROMOTION_RADIUS_KM * 1000;

      if (!searchCoverageCircleRef.current) {
        searchCoverageCircleRef.current = new maps.Circle({
          map: mapRef.current,
          center: searchCenter,
          radius: radiusMeters,
          clickable: false,
          strokeColor: "#2563eb",
          strokeOpacity: 0.34,
          strokeWeight: 2,
          fillColor: "#2563eb",
          fillOpacity: 0.08,
          zIndex: 90,
        });
      } else {
        searchCoverageCircleRef.current.setMap(mapRef.current);
        searchCoverageCircleRef.current.setCenter(searchCenter);
        searchCoverageCircleRef.current.setRadius(radiusMeters);
      }

      const bounds = searchCoverageCircleRef.current.getBounds?.();

      if (bounds) {
        mapRef.current.fitBounds(bounds, 32);
      }

      if (!searchRadarCircleRef.current) {
        searchRadarCircleRef.current = new maps.Circle({
          map: mapRef.current,
          center: searchCenter,
          radius: 0,
          clickable: false,
          strokeColor: "#2563eb",
          strokeOpacity: 0,
          strokeWeight: 2,
          fillColor: "#2563eb",
          fillOpacity: 0,
          zIndex: 95,
        });
      } else {
        searchRadarCircleRef.current.setMap(mapRef.current);
        searchRadarCircleRef.current.setCenter(searchCenter);
      }

      if (searchRadarFrameRef.current !== null) {
        window.cancelAnimationFrame(searchRadarFrameRef.current);
        searchRadarFrameRef.current = null;
      }

      if (searchRadarTimeoutRef.current !== null) {
        window.clearTimeout(searchRadarTimeoutRef.current);
        searchRadarTimeoutRef.current = null;
      }

      const pulseTravelDurationMs = 2200;
      const pulsePauseDurationMs = 5000;
      let animationStartMs: number | null = null;

      const scheduleNextPulse = () => {
        searchRadarTimeoutRef.current = window.setTimeout(() => {
          searchRadarTimeoutRef.current = null;
          animationStartMs = null;

          if (!searchRadarCircleRef.current) {
            return;
          }

          searchRadarCircleRef.current.setRadius(0);
          searchRadarCircleRef.current.setOptions({
            strokeOpacity: 0,
            fillOpacity: 0,
          });
          searchRadarFrameRef.current = window.requestAnimationFrame(animateSearchPulse);
        }, pulsePauseDurationMs);
      };

      const animateSearchPulse = (timestamp: number) => {
        if (!searchRadarCircleRef.current) {
          return;
        }

        if (animationStartMs === null) {
          animationStartMs = timestamp;
        }

        const elapsed = timestamp - animationStartMs;
        const isAtEdge = elapsed >= pulseTravelDurationMs;
        const progress = isAtEdge ? 1 : elapsed / pulseTravelDurationMs;
        const smoothProgress = progress * progress * (3 - 2 * progress);
        const pulseRadius = radiusMeters * smoothProgress;

        searchRadarCircleRef.current.setCenter(searchCenter);
        searchRadarCircleRef.current.setRadius(pulseRadius);
        searchRadarCircleRef.current.setOptions({
          strokeOpacity: 0.34 - progress * 0.1,
          fillOpacity: 0.13 - progress * 0.06,
        });

        if (isAtEdge) {
          searchRadarFrameRef.current = null;
          searchRadarCircleRef.current.setOptions({
            strokeOpacity: 0,
            fillOpacity: 0,
          });
          scheduleNextPulse();
          return;
        }

        searchRadarFrameRef.current = window.requestAnimationFrame(animateSearchPulse);
      };

      searchRadarFrameRef.current = window.requestAnimationFrame(animateSearchPulse);
    }

    void syncSearchOverlay();

    return () => {
      cancelled = true;
      clearSearchOverlay();
    };
  }, [isSearchMode, searchCenter?.lat, searchCenter?.lng, status]);

  return (
    <section
      className={
        isSearchMode
          ? "relative h-full min-h-0 overflow-hidden bg-white"
          : "client-location-preview overflow-hidden rounded-[22px] bg-white"
      }
    >
      <div
        className={
          isSearchMode
            ? "relative h-full min-h-[calc(100dvh-60px)] overflow-hidden bg-slate-100"
            : "relative h-56 overflow-hidden bg-slate-100"
        }
      >
        <div ref={mapContainerRef} className="absolute inset-0" />

        {isSearchMode ? (
          <motion.button
            type="button"
            onClick={onOpenRequest}
            initial={{ opacity: 0, y: 18, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            whileTap={{ scale: 0.97 }}
            transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
            aria-label="Acompanhar pedido"
            className="absolute left-1/2 top-[52%] z-30 flex -translate-x-1/2 items-center justify-center gap-2 rounded-full bg-blue-600 px-5 py-3 text-sm font-black text-white"
          >
            <Search className="map-search-icon h-5 w-5" />
            Buscando prestadores(as)
          </motion.button>
        ) : (
          <button
            type="button"
            onClick={() => setIsInfoOpen(true)}
            aria-label="Informações sobre localização"
            className="absolute right-3 top-3 z-20 flex h-10 w-10 items-center justify-center rounded-full bg-white text-slate-800"
          >
            <HelpCircle className="h-5 w-5" />
          </button>
        )}

        {!isSearchMode && isInfoOpen ? (
          <div className="absolute right-3 top-14 z-30 max-h-[calc(100%-4.25rem)] w-[calc(100%-1.5rem)] overflow-y-auto rounded-[20px] bg-white p-4 text-slate-800">
            <button
              type="button"
              onClick={() => setIsInfoOpen(false)}
              aria-label="Fechar informações"
              className="absolute right-2 top-2 flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-slate-600"
            >
              <X className="h-4 w-4" />
            </button>
            <h2 className="pr-8 text-sm font-black text-slate-950">Localização</h2>
            <p className="mt-2 text-xs leading-relaxed text-slate-600">
              A localização é usada para encontrar prestadores(as) próximos(as) dentro da região atendida.
            </p>
            <p className="mt-2 text-xs leading-relaxed text-slate-600">
              Prestadores(as) não recebem sua localização exata antes do acordo ser fechado.
            </p>
          </div>
        ) : null}

        {status === "loading" ? (
          <div
            className={`absolute inset-x-3 z-20 rounded-[18px] bg-white px-4 py-3 text-center text-xs font-semibold leading-relaxed text-slate-700 ${
              isSearchMode ? "top-4 bottom-auto" : "bottom-3"
            }`}
          >
            Carregando mapa...
          </div>
        ) : null}

      </div>
    </section>
  );
}

function ClientHome() {
  const navigate = useNavigate();
  const {
    state: { activeServiceRequest, posts, user },
    createServiceRequest,
    listCompletedServiceRequests,
    openChatFromPost,
  } = useApp();
  const [category, setCategory] = useState<PinType>("Conserto");
  const [description, setDescription] = useState("");
  const [providerSearch, setProviderSearch] = useState("");
  const [recentServices, setRecentServices] = useState<ActiveServiceRequest[]>([]);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isOpeningPromotionChat, setIsOpeningPromotionChat] = useState<string | null>(null);
  const [isServicesInfoOpen, setIsServicesInfoOpen] = useState(false);
  const [clientCoords, setClientCoords] = useState<UserCoordinates | null>(null);
  useErrorToast(error);

  const firstName = user?.fullName?.split(/\s+/).filter(Boolean)[0] || "cliente";
  const eligibilityError = resolveCreateServiceRequestEligibilityError(user);
  const hasActiveRequesterService =
    activeServiceRequest?.currentUserRole === "requester" &&
    activeServiceRequest.status !== "completed";
  const selectedCategory = requestComposerCategories.find((item) => item.id === category);
  const hasServiceDescription = description.trim().length > 0;
  const canSubmitServiceRequest =
    hasServiceDescription && !isSubmitting && !hasActiveRequesterService;

  useEffect(() => {
    let cancelled = false;

    getCurrentUserLocation({
      enableHighAccuracy: false,
      timeout: 12_000,
      maximumAge: 60_000,
    })
      .then((coords) => {
        if (!cancelled && isWithinServiceArea(coords)) {
          setClientCoords(coords);
        }
      })
      .catch(() => undefined);

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!success) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setSuccess("");
    }, 4000);

    return () => window.clearTimeout(timeoutId);
  }, [success]);

  const nearbyPromotions = useMemo(() => {
    if (!clientCoords) {
      return [];
    }

    return posts
      .filter(isPromotionVisible)
      .flatMap((post) => {
        const position = {
          lat: Number(post.latitude),
          lng: Number(post.longitude),
        };

        if (!Number.isFinite(position.lat) || !Number.isFinite(position.lng)) {
          return [];
        }

        const distanceKm = calculateDistanceInKm(clientCoords, position);

        if (distanceKm > PROVIDER_PROMOTION_RADIUS_KM) {
          return [];
        }

        return [{ post, distanceKm, distanceLabel: formatDistanceLabel(distanceKm) }];
      })
      .sort((left, right) => left.distanceKm - right.distanceKm)
      .slice(0, 12);
  }, [clientCoords, posts]);

  const visiblePromotions = useMemo(() => {
    const normalizedSearch = providerSearch.trim().toLocaleLowerCase("pt-BR");

    return nearbyPromotions
      .filter(({ post }) => post.category === category)
      .filter(({ post }) => {
        if (!normalizedSearch) {
          return true;
        }

        return [post.user, post.profession, post.experience, post.content]
          .filter(Boolean)
          .some((value) =>
            String(value).toLocaleLowerCase("pt-BR").includes(normalizedSearch)
          );
      })
      .sort((left, right) => {
        const ratingDifference = (right.post.averageRating ?? 0) - (left.post.averageRating ?? 0);

        if (ratingDifference !== 0) {
          return ratingDifference;
        }

        return left.distanceKm - right.distanceKm;
      })
      .slice(0, 8);
  }, [category, nearbyPromotions, providerSearch]);

  useEffect(() => {
    let cancelled = false;

    void listCompletedServiceRequests().then((result) => {
      if (!cancelled && result.ok) {
        setRecentServices((result.requests ?? []).slice(0, 2));
      }
    });

    return () => {
      cancelled = true;
    };
  }, []);

  const handleOpenPromotionChat = async (postId: string) => {
    if (isOpeningPromotionChat) {
      return;
    }

    setError("");
    setIsOpeningPromotionChat(postId);
    const result = await openChatFromPost(postId);
    setIsOpeningPromotionChat(null);

    if (!result.ok) {
      setError(result.error ?? "Não conseguimos abrir conversa com este(a) prestador(a) agora.");
      return;
    }

    if (result.chatId) {
      navigate("/app/chat");
      return;
    }

    setSuccess(result.message ?? "Solicitação enviada ao(à) prestador(a).");
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const normalizedDescription = description.trim();

    if (hasActiveRequesterService) {
      setError("Voc?já tem um pedido em andamento.");
      return;
    }

    if (eligibilityError) {
      setError(eligibilityError);
      return;
    }

    if (!normalizedDescription) {
      setError("Descreva o serviço que você precisa.");
      return;
    }

    if (normalizedDescription.length > REQUEST_DESCRIPTION_MAX_LENGTH) {
      setError("Resuma seu pedido em até 50 caracteres.");
      return;
    }

    setIsSubmitting(true);
    setError("");
    setSuccess("");

    let coords: UserCoordinates;

    try {
      coords = await getCurrentUserLocation({
        enableHighAccuracy: true,
        timeout: 20_000,
        maximumAge: 5_000,
      });
    } catch (locationError) {
      setIsSubmitting(false);
      setError(
        locationError instanceof Error
          ? locationError.message
          : "Ative a localização do celular para solicitar o serviço."
      );
      return;
    }

    if (!isWithinServiceArea(coords)) {
      setIsSubmitting(false);
      setError("O pedido só pode ser aberto em Suzano ou Itaquaquecetuba.");
      return;
    }

    const result = await createServiceRequest({
      type: category,
      description: normalizedDescription,
      latitude: coords.lat,
      longitude: coords.lng,
      accuracy: coords.accuracy,
    });

    setIsSubmitting(false);

    if (!result.ok) {
      setError(result.error ?? "Não conseguimos publicar seu pedido agora.");
      return;
    }

    setDescription("");
    setSuccess("Pedido enviado. Vamos procurar um(a) prestador(a) disponível.");
  };

  return (
    <motion.div
      key="client-home-composer"
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 18 }}
      transition={{ duration: 0.34, ease: [0.22, 1, 0.36, 1] }}
      className="min-h-[calc(100dvh-60px)] bg-neutral-50 px-5 pb-28 pt-4 text-neutral-950"
    >
      <div className="mx-auto flex w-full max-w-md flex-col gap-5">
        <section className="relative px-0 py-1">
          <div className="mb-5 flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[13px] font-semibold text-neutral-400">
                Olá, {firstName}
              </p>
              <h1 className="mt-1 text-[20px] font-extrabold leading-tight text-neutral-900">
                Do que você precisa?
              </h1>
            </div>
            <button
              type="button"
              onClick={() => setIsServicesInfoOpen((current) => !current)}
              aria-expanded={isServicesInfoOpen}
              aria-label="Ver serviços aceitos"
              className="mt-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-blue-50 text-blue-600 transition active:scale-95"
            >
              <Briefcase className="h-5 w-5" />
            </button>
          </div>

          {isServicesInfoOpen ? (
            <>
              <button
                type="button"
                className="fixed inset-0 z-[58] cursor-default bg-transparent"
                aria-label="Fechar serviços aceitos"
                onClick={() => setIsServicesInfoOpen(false)}
              />
              <div className="absolute right-0 top-[3.25rem] z-[59] max-h-[calc(100dvh-13rem)] w-full overflow-y-auto rounded-[24px] border border-neutral-200 bg-white p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[0.68rem] font-black uppercase tracking-[0.16em] text-blue-600">
                    Serviços aceitos
                  </p>
                  <h2 className="mt-1 text-base font-black text-slate-950">O que pode pedir</h2>
                </div>
                <button
                  type="button"
                  onClick={() => setIsServicesInfoOpen(false)}
                  aria-label="Fechar serviços aceitos"
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-neutral-100 text-slate-600 transition active:scale-95"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <p className="mt-3 text-xs font-semibold leading-relaxed text-slate-600">
                {ACCEPTED_SERVICES_NOTICE}
              </p>

              <div className="mt-4 space-y-3">
                {Object.entries(acceptedServiceCatalog).map(([type, service]) => (
                  <div key={type} className="rounded-[18px] bg-neutral-50 px-3 py-3">
                    <p className="text-sm font-black text-slate-950">{type}</p>
                    <p className="mt-1 text-xs font-semibold leading-relaxed text-slate-600">
                      {service.label}
                    </p>
                  </div>
                ))}
              </div>

              <p className="mt-4 text-xs font-semibold leading-relaxed text-slate-500">
                {RESTRICTED_SERVICES_NOTICE}
              </p>
              </div>
            </>
          ) : null}

          <label className="mb-5 flex items-center gap-3 rounded-[16px] border border-neutral-200 bg-neutral-100 px-4 py-3.5">
            <Search className="h-4 w-4 shrink-0 text-neutral-400" />
            <input
              type="search"
              value={providerSearch}
              onChange={(event) => setProviderSearch(event.target.value)}
              placeholder="Buscar serviços ou profissionais..."
              className="min-w-0 flex-1 bg-transparent text-[13px] font-semibold text-neutral-800 outline-none placeholder:text-neutral-400"
            />
          </label>

          <form onSubmit={(event) => void handleSubmit(event)} className="space-y-5">
            <div className="grid grid-cols-3 gap-2">
              {requestComposerCategories.map((item) => {
                const Icon = item.icon;
                const isActive = item.id === category;

                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setCategory(item.id)}
                    className={`flex min-h-20 flex-col items-center justify-center gap-1.5 rounded-2xl px-2 text-center text-xs font-bold transition active:scale-[0.98] ${getClientCategoryCardClasses(
                      item.id,
                      isActive
                    )}`}
                  >
                    <Icon className="h-5 w-5" />
                    {item.label}
                  </button>
                );
              })}
            </div>

            <label className="block overflow-hidden rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm">
              <span className="mb-2 flex items-center justify-between gap-3 text-xs font-bold uppercase tracking-[0.16em] text-slate-500">
                Serviço
                <span>{description.length}/{REQUEST_DESCRIPTION_MAX_LENGTH}</span>
              </span>
              <textarea
                value={description}
                onChange={(event) =>
                  setDescription(event.target.value.slice(0, REQUEST_DESCRIPTION_MAX_LENGTH))
                }
                rows={3}
                placeholder={
                  selectedCategory?.id === "Conserto"
                    ? "Ex.: Meu chuveiro parou de funcionar."
                    : selectedCategory?.id === "Limpeza"
                      ? "Ex.: Preciso de limpeza para hoje."
                      : "Ex.: Preciso de ajuda com computador."
                }
                className="w-full resize-none border-0 bg-transparent px-3 py-3 text-[14px] font-semibold leading-relaxed text-neutral-700 outline-none placeholder:text-neutral-300"
              />
            </label>

            {eligibilityError ? (
              <button
                type="button"
                onClick={() => navigate("/app/profile")}
                className="flex w-full items-center justify-center gap-2 rounded-2xl bg-blue-600 px-4 py-3.5 text-sm font-bold text-white"
              >
                <ShieldCheck className="h-5 w-5" />
                Verificar perfil
              </button>
            ) : (
              <button
                type="submit"
                disabled={!canSubmitServiceRequest}
                className={`flex w-full items-center justify-center gap-2 rounded-2xl px-4 py-3.5 text-sm font-bold transition ${
                  canSubmitServiceRequest
                    ? "bg-blue-600 text-white active:scale-[0.98]"
                    : "cursor-not-allowed bg-neutral-200 text-neutral-400"
                }`}
              >
                {isSubmitting
                  ? "Enviando..."
                  : hasActiveRequesterService
                    ? "Pedido em andamento"
                    : "Solicitar serviço"}
                <SendHorizontal className="h-5 w-5" />
              </button>
            )}
          </form>

          <div className="mt-5 grid grid-cols-3 divide-x divide-neutral-200 rounded-2xl bg-white px-2 py-3 shadow-sm">
            <div className="flex items-center justify-center gap-1.5 text-[11px] font-bold text-neutral-700">
              <ShieldCheck className="h-4 w-4 text-emerald-500" />
              Verificados
            </div>
            <div className="flex items-center justify-center gap-1.5 text-[11px] font-bold text-neutral-700">
              <Star className="h-4 w-4 fill-amber-400 text-amber-400" />
              Avaliados
            </div>
            <div className="flex items-center justify-center gap-1.5 text-[11px] font-bold text-neutral-700">
              <Clock3 className="h-4 w-4 text-blue-600" />
              Rápido
            </div>
          </div>
        </section>

        {hasActiveRequesterService ? (
          <section className="rounded-[22px] bg-slate-100 p-5">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-blue-600">
                  Pedido ativo
                </p>
                <h2 className="mt-2 text-lg font-black text-slate-950">
                  {activeServiceRequest.type}
                </h2>
                <p className="mt-1 text-sm text-slate-500">{activeServiceRequest.description}</p>
              </div>
              <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-bold text-blue-700">
                Em busca
              </span>
            </div>
            <button
              type="button"
              onClick={() => navigate("/app/service/request")}
              className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl bg-slate-100 px-4 py-3 text-sm font-bold text-slate-800"
            >
              Acompanhar pedido
              <LocateFixed className="h-4 w-4" />
            </button>
          </section>
        ) : null}

        {success ? (
          <div className="rounded-[24px] bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700">
            {success}
          </div>
        ) : null}

        <section className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-black text-neutral-950">Profissionais perto de você</h2>
              <p className="mt-1 text-xs font-semibold text-neutral-500">
                Sua localização exata permanece protegida.
              </p>
            </div>
            <MapPin className="h-5 w-5 text-blue-600" />
          </div>
          <ClientLocationPreviewClean />
        </section>

        <section className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <h2 className="text-base font-black text-neutral-950">Destaques perto de você</h2>
              <p className="mt-1 text-xs font-semibold text-neutral-500">
                Profissionais em até {PROVIDER_PROMOTION_RADIUS_KM} km, filtrados por categoria.
              </p>
            </div>
            <Megaphone className="h-5 w-5 shrink-0 text-blue-600" />
          </div>

          {visiblePromotions.length > 0 ? (
            <div className="-mx-5 flex snap-x snap-mandatory gap-3 overflow-x-auto px-5 pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {visiblePromotions.map(({ post, distanceLabel }) => {
                const rating = post.averageRating ?? null;
                const hourlyRate = post.hourlyRateCents
                  ? `${formatCurrencyAmount(post.hourlyRateCents / 100)}/h`
                  : "Valor a combinar";

                return (
                  <article
                    key={post.id}
                    className="w-[168px] shrink-0 snap-start rounded-[20px] border border-neutral-100 bg-white p-4 shadow-sm"
                  >
                    <div className="relative mx-auto flex h-16 w-16 items-center justify-center overflow-hidden rounded-full bg-blue-600 text-base font-black text-white ring-4 ring-blue-50">
                      {post.avatar ? (
                        <img src={post.avatar} alt={post.user} className="h-full w-full object-cover" />
                      ) : (
                        getInitials(post.user)
                      )}
                      {post.isVerified ? (
                        <span className="absolute bottom-0 right-0 flex h-5 w-5 items-center justify-center rounded-full border-2 border-white bg-blue-600">
                          <ShieldCheck className="h-3 w-3 text-white" />
                        </span>
                      ) : null}
                    </div>

                    <h3 className="mt-3 truncate text-center text-sm font-black text-neutral-950">
                      {post.user}
                    </h3>
                    <p className="mt-0.5 truncate text-center text-[11px] font-bold text-neutral-500">
                      {post.profession || post.category}
                    </p>

                    <div className="mt-2 flex items-center justify-center gap-1 text-[11px]">
                      <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                      <span className="font-black text-neutral-800">
                        {rating === null ? "Novo" : rating.toFixed(1).replace(".", ",")}
                      </span>
                      {post.reviewsCount ? (
                        <span className="text-neutral-400">({post.reviewsCount})</span>
                      ) : null}
                    </div>

                    <p className="mt-1 text-center text-[10px] font-semibold text-neutral-400">
                      {post.completedServicesCount ?? 0} serviços · {distanceLabel}
                    </p>
                    <p className="mt-2 text-center text-[13px] font-black text-blue-600">
                      {hourlyRate}
                    </p>
                    <p className="mt-2 line-clamp-2 min-h-8 text-center text-[10px] font-semibold leading-4 text-neutral-500">
                      {post.experience || post.content}
                    </p>

                    <button
                      type="button"
                      onClick={() => void handleOpenPromotionChat(post.id)}
                      disabled={isOpeningPromotionChat === post.id}
                      className="mt-3 flex w-full items-center justify-center rounded-xl bg-blue-50 px-3 py-2 text-[11px] font-black text-blue-700 transition active:scale-[0.98] disabled:opacity-60"
                    >
                      {isOpeningPromotionChat === post.id ? "Abrindo..." : "Conversar"}
                    </button>
                  </article>
                );
              })}
            </div>
          ) : (
            <div className="rounded-[20px] border border-dashed border-neutral-200 bg-white px-5 py-6 text-center">
              <Search className="mx-auto h-5 w-5 text-neutral-300" />
              <p className="mt-2 text-xs font-bold text-neutral-500">
                Nenhum profissional dessa categoria foi encontrado perto de você agora.
              </p>
            </div>
          )}
        </section>

        {recentServices.length > 0 ? (
          <section className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-base font-black text-neutral-950">Serviços recentes</h2>
              <button
                type="button"
                onClick={() => navigate("/app/orders")}
                className="text-xs font-black text-blue-600"
              >
                Ver todos
              </button>
            </div>
            <div className="space-y-2">
              {recentServices.map((service) => (
                <button
                  key={service.id}
                  type="button"
                  onClick={() => navigate("/app/orders")}
                  className="flex w-full items-center gap-3 rounded-[16px] bg-white p-3 text-left shadow-sm"
                >
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
                    <Wrench className="h-4 w-4" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-xs font-black text-neutral-900">
                      {service.details?.title || service.description}
                    </span>
                    <span className="mt-0.5 block text-[11px] font-semibold text-neutral-400">
                      {service.createdAtLabel}
                    </span>
                  </span>
                  <span className="rounded-lg bg-emerald-50 px-2.5 py-1 text-[10px] font-black text-emerald-700">
                    Concluído
                  </span>
                </button>
              ))}
            </div>
          </section>
        ) : null}
      </div>
    </motion.div>
  );
}

function ProviderHome() {
  const routeLocation = useLocation();
  const navigate = useNavigate();
  const {
    state: { activeServiceRequest, pins, posts, sessionToken, user },
    acceptWorkerInterest,
    addPost,
    createServiceRequest,
    cancelActiveServiceRequest,
    declineWorkerInterest,
    markWorkerArrived,
    openChat,
    openServiceDispute,
    reportProviderNoShow,
    respondProviderNoShow,
    refreshSessionState,
    refreshServicePins,
    releaseServicePayment,
    removePost,
    takeServiceRequest,
  } = useApp();
  const rootContainerRef = useRef<HTMLDivElement | null>(null);
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const requestComposerRef = useRef<HTMLFormElement | null>(null);
  const mapRef = useRef<any>(null);
  const mapsRef = useRef<any>(null);
  const mapClickListenerRef = useRef<any>(null);
  const mapIdleListenerRef = useRef<any>(null);
  const deviceWatchIdRef = useRef<LocationWatchHandle | null>(null);
  const userMarkerRef = useRef<any>(null);
  const userMarkerClickListenerRef = useRef<any>(null);
  const accuracyCircleRef = useRef<any>(null);
  const serviceAreaMaskRef = useRef<any>(null);
  const serviceAreaOutlineRefs = useRef<any[]>([]);
  const serviceAreaBoundsRef = useRef<MapBoundsLiteral | null>(null);
  const serviceAreaCenterRef = useRef<{ lat: number; lng: number } | null>(null);
  const lastInterestPromptKeyRef = useRef<string | null>(null);
  const pinMarkersRef = useRef<Map<string, any>>(new Map());
  const pinMarkerClickListenersRef = useRef<Map<string, any>>(new Map());
  const requestMarkerRef = useRef<any>(null);
  const requestPrivacyCircleRef = useRef<any>(null);
  const promotionCoverageCircleRef = useRef<any>(null);
  const promotionRadarCircleRef = useRef<any>(null);
  const promotionRadarFrameRef = useRef<number | null>(null);
  const promotionRadarTimeoutRef = useRef<number | null>(null);
  const hasLoadedPinsRef = useRef(false);
  const [activeCategory, setActiveCategory] = useState<"Todas" | PinType>("Todas");
  const [selectedPinId, setSelectedPinId] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const [isInsideServiceArea, setIsInsideServiceArea] = useState(true);
  const [serviceAreaNotice, setServiceAreaNotice] = useState<string | null>(null);
  const [isFullscreenMode, setIsFullscreenMode] = useState(false);
  const [isRequestComposerOpen, setIsRequestComposerOpen] = useState(false);
  const [isPromotionComposerOpen, setIsPromotionComposerOpen] = useState(false);
  const [isPromotionManagerOpen, setIsPromotionManagerOpen] = useState(false);
  const [requestComposerMode, setRequestComposerMode] = useState<"request" | "offer">("request");
  const [requestCategory, setRequestCategory] = useState<PinType>("Conserto");
  const [requestDescription, setRequestDescription] = useState("");
  const [requestError, setRequestError] = useState("");
  const [promotionCategory, setPromotionCategory] = useState<PinType>("Conserto");
  const [promotionProfession, setPromotionProfession] = useState(
    getServiceProfessions(user)[0] ?? ""
  );
  const [promotionDescription, setPromotionDescription] = useState("");
  const [promotionHourlyRate, setPromotionHourlyRate] = useState("");
  const [promotionDurationDays, setPromotionDurationDays] = useState<(typeof PROMOTION_DURATION_OPTIONS)[number]>(1);
  const [isPromotionProfessionOpen, setIsPromotionProfessionOpen] = useState(false);
  const [isPromotionDurationOpen, setIsPromotionDurationOpen] = useState(false);
  const [promotionError, setPromotionError] = useState("");
  const [isRemovingPromotion, setIsRemovingPromotion] = useState(false);
  const [isConfirmingPromotionRemoval, setIsConfirmingPromotionRemoval] = useState(false);
  const [publishedPromotionOverride, setPublishedPromotionOverride] = useState<Post | null>(null);
  const [shouldOpenPromotionManagerAfterPublish, setShouldOpenPromotionManagerAfterPublish] =
    useState(false);
  const [locationPrecisionError, setLocationPrecisionError] = useState<string | null>(null);
  const [isPublishingRequest, setIsPublishingRequest] = useState(false);
  const [isPublishingPromotion, setIsPublishingPromotion] = useState(false);
  const [isResolvingPreciseLocation, setIsResolvingPreciseLocation] = useState(false);
  const [isTakingRequest, setIsTakingRequest] = useState(false);
  const [isAcceptingWorker, setIsAcceptingWorker] = useState(false);
  const [isDecliningWorker, setIsDecliningWorker] = useState(false);
  const [isCancellingActiveRequest, setIsCancellingActiveRequest] = useState(false);
  const [isMarkingWorkerArrived, setIsMarkingWorkerArrived] = useState(false);
  const [isActiveRequestSheetOpen, setIsActiveRequestSheetOpen] = useState(false);
  const [isRoutePickerOpen, setIsRoutePickerOpen] = useState(false);
  const [isCurrentServiceInfoOpen, setIsCurrentServiceInfoOpen] = useState(false);
  const [activeRequestSheetError, setActiveRequestSheetError] = useState("");
  const [pendingClientReviewRequest, setPendingClientReviewRequest] =
    useState<ActiveServiceRequest | null>(null);
  const [clientReviewRating, setClientReviewRating] = useState(0);
  const [clientReviewComment, setClientReviewComment] = useState("");
  const [isSubmittingClientReview, setIsSubmittingClientReview] = useState(false);
  const [clientReviewError, setClientReviewError] = useState("");
  useErrorToast(requestError);
  useErrorToast(promotionError);
  useErrorToast(locationPrecisionError);
  useErrorToast(activeRequestSheetError);
  useErrorToast(clientReviewError);
  const [, setMapSyncFeedback] = useState<{
    tone: "success" | "error";
    message: string;
  } | null>(null);
  const [isWorkerProfileOpen, setIsWorkerProfileOpen] = useState(false);
  const [workerPublicProfile, setWorkerPublicProfile] = useState<PublicUserProfile | null>(null);
  const [selectedPinProfile, setSelectedPinProfile] = useState<PublicUserProfile | null>(null);
  const [profilePreview, setProfilePreview] = useState<{
    userId: string;
    eyebrow: string;
    mode: "default" | "interest";
    fallbackProfile: Partial<PublicUserProfile> & { fullName: string };
  } | null>(null);
  const [locationState, setLocationState] = useState<LocationState>(
    () =>
      (cachedReadyLocationState?.source === "device" ? cachedReadyLocationState : null) ?? {
        status: "loading",
        coords: null,
        error: null,
        source: null,
      }
  );
  const [mapReady, setMapReady] = useState(false);

  useEffect(() => {
    if (!sessionToken || user?.accountKind !== "provider") {
      setPendingClientReviewRequest(null);
      return;
    }

    let cancelled = false;

    void apiRequest<{ request: Partial<ActiveServiceRequest> | null }>(
      "/api/service-requests/pending-client-review",
      { token: sessionToken }
    )
      .then((response) => {
        if (cancelled) return;

        const request = response.request;
        setPendingClientReviewRequest(
          request
            ?
             ({
                ...request,
                createdAtLabel: request.createdAtLabel ?? "",
                dismissedWorkerIds: request.dismissedWorkerIds ?? [],
                timeline: request.timeline ?? [],
                currentUserRole: "worker",
              } as ActiveServiceRequest)
            : null
        );
      })
      .catch(() => {
        if (!cancelled) setPendingClientReviewRequest(null);
      });

    return () => {
      cancelled = true;
    };
  }, [activeServiceRequest?.status, sessionToken, user?.accountKind, user?.id]);

  const handleSubmitClientReview = async () => {
    if (!sessionToken || !pendingClientReviewRequest || isSubmittingClientReview) return;

    if (clientReviewRating < 1) {
      setClientReviewError("Selecione uma nota para o cliente.");
      return;
    }

    if (clientReviewComment.trim().length < 8) {
      setClientReviewError("Escreva um comentário breve sobre o atendimento.");
      return;
    }

    setIsSubmittingClientReview(true);
    setClientReviewError("");

    try {
      await apiRequest(`/api/service-requests/${pendingClientReviewRequest.id}/review-client`, {
        method: "PATCH",
        token: sessionToken,
        body: {
          rating: clientReviewRating,
          comment: clientReviewComment.trim(),
        },
      });

      setPendingClientReviewRequest(null);
      setClientReviewRating(0);
      setClientReviewComment("");
      void refreshSessionState();
    } catch (error) {
      setClientReviewError(
          error instanceof Error ? error.message : "Não conseguimos enviar esta avaliação agora."
      );
    } finally {
      setIsSubmittingClientReview(false);
    }
  };

  const clearPinMarkers = () => {
    pinMarkerClickListenersRef.current.forEach((listener) => {
      removeGoogleMapsListener(listener);
    });
    pinMarkerClickListenersRef.current.clear();

    pinMarkersRef.current.forEach((marker) => {
      detachGoogleMapsOverlay(marker);
    });
    pinMarkersRef.current.clear();
  };

  const clearPromotionCoverageOverlay = () => {
    if (promotionRadarFrameRef.current !== null) {
      window.cancelAnimationFrame(promotionRadarFrameRef.current);
      promotionRadarFrameRef.current = null;
    }

    if (promotionRadarTimeoutRef.current !== null) {
      window.clearTimeout(promotionRadarTimeoutRef.current);
      promotionRadarTimeoutRef.current = null;
    }

    detachGoogleMapsOverlay(promotionCoverageCircleRef.current);
    detachGoogleMapsOverlay(promotionRadarCircleRef.current);
    promotionCoverageCircleRef.current = null;
    promotionRadarCircleRef.current = null;
  };
  const createRequestEligibilityError = resolveCreateServiceRequestEligibilityError(user);
  const createPromotionEligibilityError = resolveCreatePromotionEligibilityError(user);
  const canCreateServiceRequest = !createRequestEligibilityError;
  const canCreatePromotion = !createPromotionEligibilityError;
  const hasPreciseDeviceLocation =
    locationState.status === "ready" &&
    locationState.source === "device" &&
    locationState.coords.accuracy <= PRECISE_REQUEST_ACCURACY_THRESHOLD_METERS;
  const hasAcceptedRequestLocation =
    locationState.status === "ready" && hasPreciseDeviceLocation;
  const locationPrecisionNotice =
    locationState.status === "ready" && !hasAcceptedRequestLocation
      ? locationState.source === "service-area"
        ? "Ative o GPS do celular para publicar seu pedido."
        : `Sua localiza??o atual ainda está imprecisa (${formatAccuracy(
            locationState.coords.accuracy
          )}). Ative o GPS para continuar.`
      : null;
  const shouldShowGpsRefresh = requestComposerMode === "request" && Boolean(locationPrecisionNotice);
  const shouldPromptForGps =
    requestComposerMode === "request" &&
    (locationState.status === "error" ||
      (locationState.status === "ready" && locationState.source === "service-area"));
  const gpsActivationNotice = shouldPromptForGps
    ? "Ative o GPS do celular para publicar seu pedido."
    : null;
  const selectedComposerCategory =
    requestComposerMode === "request" ? requestCategory : promotionCategory;
  const selectedComposerCatalog = acceptedServiceCatalog[selectedComposerCategory];
  const serviceProfessions = useMemo(() => getServiceProfessions(user), [user]);
  const activeOwnPromotion = useMemo(() => {
    const isOwnVisiblePromotion = (post: Post) => {
      const latitude = Number(post.latitude);
      const longitude = Number(post.longitude);

      return (
        post.authorId === "me" &&
        post.type === "offer" &&
        isPromotionVisible(post) &&
        Number.isFinite(latitude) &&
        Number.isFinite(longitude)
      );
    };

    return (
      posts.find(isOwnVisiblePromotion) ??
      (publishedPromotionOverride && isOwnVisiblePromotion(publishedPromotionOverride)
        ? publishedPromotionOverride
        : null)
    );
  }, [posts, publishedPromotionOverride]);

  useEffect(() => {
    if ((!promotionProfession || !isServiceProfession(promotionProfession)) && serviceProfessions.length > 0) {
      setPromotionProfession(serviceProfessions[0]);
    }
  }, [promotionProfession, serviceProfessions]);

  const filteredPins = useMemo(() => {
    if (!user.isCpfVerified) {
      return [];
    }

    return pins.filter((pin) => {
      return activeCategory === "Todas" || pin.type === activeCategory;
    });
  }, [activeCategory, pins, user.isCpfVerified]);

  const visiblePins = useMemo(() => {
    if (locationState.status !== "ready" || !locationState.coords) {
      return [];
    }

    return filteredPins.flatMap((pin) => {
      const position = {
        lat: pin.maskedLatitude,
        lng: pin.maskedLongitude,
      };

      if (!isWithinServiceArea(position)) {
        return [];
      }

      const distanceKm = calculateDistanceInKm(locationState.coords, position);

      return [
        {
          pin,
          position,
          distanceKm,
          distanceLabel: formatDistanceLabel(distanceKm),
          createdAtLabel: formatTimeLabel(pin.createdAt),
        },
      ];
    });
  }, [filteredPins, locationState]);

  const selectedPinEntry = useMemo(() => {
    if (selectedPinId === null) {
      return null;
    }

    return visiblePins.find((entry) => entry.pin.id === selectedPinId) ?? null;
  }, [selectedPinId, visiblePins]);
  const selectedPin = selectedPinEntry?.pin ?? null;

  const interestedWorker = useMemo(() => {
    return seedWorkers.find((worker) => worker.id === activeServiceRequest?.workerId) ?? null;
  }, [activeServiceRequest?.workerId]);
  const workerProfileCard = useMemo(() => {
    if (interestedWorker) {
      return interestedWorker;
    }

    if (
      activeServiceRequest?.status === "interest-received" &&
      activeServiceRequest.currentUserRole === "requester" &&
      activeServiceRequest.workerName
    ) {
      return buildFallbackWorkerProfile(activeServiceRequest);
    }

    return null;
  }, [activeServiceRequest, interestedWorker]);
  const workerModalProfile = useMemo(() => {
    if (!workerProfileCard) {
      return null;
    }

    return {
      name: workerPublicProfile?.fullName ?? workerProfileCard.name,
      avatar: workerPublicProfile?.avatar ?? workerProfileCard.avatar,
      isVerified: workerPublicProfile?.isCpfVerified ?? workerProfileCard.isVerified,
      headline: workerPublicProfile?.headline.trim() || workerProfileCard.servicePitch,
      bio: workerPublicProfile?.bio.trim() || workerProfileCard.bio,
      professions:
        workerPublicProfile && workerPublicProfile.professions.length > 0
          ? workerPublicProfile.professions
          : workerProfileCard.professions,
      skills:
        workerPublicProfile && workerPublicProfile.skills.length > 0
          ? workerPublicProfile.skills
          : workerProfileCard.skills,
      completedServices:
        workerPublicProfile?.completedServicesCount ?? workerProfileCard.completedServices,
      averageRating: workerPublicProfile?.averageRating ?? null,
      reviewsCount: workerPublicProfile?.reviewsCount ?? 0,
    };
  }, [workerProfileCard, workerPublicProfile]);

  const hasLiveRequest = Boolean(activeServiceRequest && activeServiceRequest.status !== "completed");
  const canOpenExternalRoute =
    activeServiceRequest?.currentUserRole === "worker" &&
    activeServiceRequest.status === "confirmed" &&
    activeServiceRequest.exactLocationVisible &&
    Number.isFinite(Number(activeServiceRequest.latitude)) &&
    Number.isFinite(Number(activeServiceRequest.longitude));
  const canViewCurrentServiceInfo =
    activeServiceRequest?.currentUserRole === "worker" &&
    activeServiceRequest.status === "confirmed";
  const hasOverlayCardOpen = Boolean(
      selectedPin ||
      isRequestComposerOpen ||
      isPromotionComposerOpen ||
      isPromotionManagerOpen ||
      isWorkerProfileOpen ||
      profilePreview ||
      isActiveRequestSheetOpen ||
      isRoutePickerOpen ||
      isCurrentServiceInfoOpen
  );
  const interestPromptKey =
    activeServiceRequest?.status === "interest-received" &&
    activeServiceRequest.currentUserRole === "requester"
      ? `${activeServiceRequest.id}:${activeServiceRequest.workerId ?? "sem-worker"}:${
          activeServiceRequest.acceptedAt ?? activeServiceRequest.createdAt
        }`
      : null;

  useEffect(() => {
    if (!hasLiveRequest) {
      setIsActiveRequestSheetOpen(false);
      setActiveRequestSheetError("");
    }
  }, [hasLiveRequest]);

  useEffect(() => {
    if (!hasLiveRequest) {
      return;
    }

    const searchParams = new URLSearchParams(routeLocation.search);

    if (searchParams.get("focus") !== "request") {
      return;
    }

    setSelectedPinId(null);
    setIsActiveRequestSheetOpen(true);
    navigate("/app", { replace: true });
  }, [hasLiveRequest, navigate, routeLocation.search]);

  const syncServiceAreaMask = (maps: any, map: any, serviceAreaBounds: MapBoundsLiteral) => {
    const viewportBounds = map.getBounds?.();

    if (!viewportBounds) {
      return;
    }

    const viewportLiteral: MapBoundsLiteral = {
      north: viewportBounds.getNorthEast().lat(),
      east: viewportBounds.getNorthEast().lng(),
      south: viewportBounds.getSouthWest().lat(),
      west: viewportBounds.getSouthWest().lng(),
    };
    const mergedBounds = mergeBounds(viewportLiteral, serviceAreaBounds);
    const padding = 0.02;
    const outerMaskPath = [
      { lat: mergedBounds.north + padding, lng: mergedBounds.west - padding },
      { lat: mergedBounds.north + padding, lng: mergedBounds.east + padding },
      { lat: mergedBounds.south - padding, lng: mergedBounds.east + padding },
      { lat: mergedBounds.south - padding, lng: mergedBounds.west - padding },
    ];

    if (!serviceAreaMaskRef.current) {
      serviceAreaMaskRef.current = new maps.Polygon({
        map,
        paths: [outerMaskPath, ...SERVICE_AREA_HOLE_PATHS],
        fillColor: "#020617",
        fillOpacity: 0.16,
        strokeOpacity: 0,
        clickable: false,
        zIndex: 2,
      });
      return;
    }

    serviceAreaMaskRef.current.setMap(map);
    serviceAreaMaskRef.current.setPaths([outerMaskPath, ...SERVICE_AREA_HOLE_PATHS]);
  };

  const syncServiceAreaOutline = (maps: any, map: any) => {
    if (!serviceAreaOutlineRefs.current.length) {
      serviceAreaOutlineRefs.current = SERVICE_AREA_PATHS.map(
        (path) =>
          new maps.Polygon({
            map,
            paths: path,
            fillOpacity: 0,
            strokeColor: "#2563eb",
            strokeOpacity: 0.98,
            strokeWeight: 4,
            clickable: false,
            zIndex: 3,
          })
      );
      return;
    }

    serviceAreaOutlineRefs.current.forEach((outline, index) => {
      outline.setMap(map);
      outline.setPaths(SERVICE_AREA_PATHS[index]);
    });
  };

  const syncUserLocationOverlay = (
    coords: UserCoordinates,
    options?: {
      showAccuracyCircle?: boolean;
    }
  ) => {
    const map = mapRef.current;
    const maps = mapsRef.current;
    const showAccuracyCircle = options?.showAccuracyCircle ?? false;

    if (!map || !maps) {
      return;
    }

    if (!userMarkerRef.current) {
      userMarkerRef.current = createGoogleMapsMarker(maps, {
        map,
        position: coords,
        title: "Voce",
        zIndex: 1000,
        content: createUserMarkerContent(maps, user?.accountKind),
        color: getAccountPinColor(user?.accountKind),
        gmpClickable: true,
      });
      userMarkerClickListenerRef.current = userMarkerRef.current.addListener("click", () => {
        setSelectedPinId(null);
      });
    } else {
      setGoogleMapsMarkerMap(userMarkerRef.current, map);
      setGoogleMapsMarkerPosition(userMarkerRef.current, coords);
      setGoogleMapsMarkerContent(userMarkerRef.current, createUserMarkerContent(maps, user?.accountKind));
    }

    if (!showAccuracyCircle) {
      accuracyCircleRef.current?.setMap(null);
      return;
    }

    if (!accuracyCircleRef.current) {
      accuracyCircleRef.current = new maps.Circle({
        map,
        center: coords,
        radius: coords.accuracy,
        strokeColor: "#0f172a",
        strokeOpacity: 0.25,
        strokeWeight: 1,
        fillColor: "#0f172a",
        fillOpacity: 0.08,
        zIndex: 1,
      });
      return;
    }

    accuracyCircleRef.current.setMap(map);
    accuracyCircleRef.current.setCenter(coords);
    accuracyCircleRef.current.setRadius(coords.accuracy);
  };

  const applyResolvedLocation = (
    coords: UserCoordinates,
    source: LocationSource,
    shouldRecenter = true
  ) => {
    const map = mapRef.current;
    const bounds = serviceAreaBoundsRef.current;
    const serviceAreaCenter = serviceAreaCenterRef.current;

    if (!map) {
      return;
    }

    if (source === "device") {
      syncUserLocationOverlay(coords, { showAccuracyCircle: false });
    } else {
      if (userMarkerRef.current) {
        setGoogleMapsMarkerMap(userMarkerRef.current, null);
      }

      accuracyCircleRef.current?.setMap(null);
    }

    const nextIsInsideServiceArea = isWithinServiceArea(coords);

    setIsInsideServiceArea(nextIsInsideServiceArea);
    setServiceAreaNotice(
      nextIsInsideServiceArea ? null : SERVICE_AREA_LAUNCH_NOTICE
    );

    if (source !== "service-area" && userMarkerRef.current) {
      setGoogleMapsMarkerPosition(userMarkerRef.current, coords);
      setGoogleMapsMarkerMap(userMarkerRef.current, nextIsInsideServiceArea ? map : null);
    }

    if (!nextIsInsideServiceArea) {
      setSelectedPinId(null);
    }

    if (shouldRecenter) {
      if (source !== "service-area" && nextIsInsideServiceArea) {
        map.panTo(coords);
        if ((map.getZoom?.() ?? MAP_ZOOM) < MAP_ZOOM) {
          map.setZoom(MAP_ZOOM);
        }
      } else if (bounds && serviceAreaCenter) {
        map.panTo(serviceAreaCenter);
        map.setZoom(Math.max(map.getZoom?.() ?? SERVICE_AREA_MIN_ZOOM, SERVICE_AREA_MIN_ZOOM));
      }
    }

    const nextReadyLocationState = createReadyLocationState(coords, source);
    cachedReadyLocationState = source === "device" ? nextReadyLocationState : null;
    setLocationState(nextReadyLocationState);
    setMapReady(true);
  };

  useEffect(() => {
    if (selectedPinId === null) {
      return;
    }

    if (visiblePins.some((entry) => entry.pin.id === selectedPinId)) {
      return;
    }

    setSelectedPinId(null);
  }, [selectedPinId, visiblePins]);

  useEffect(() => {
    if (!activeOwnPromotion) {
      setIsPromotionManagerOpen(false);
      setIsConfirmingPromotionRemoval(false);
      setShouldOpenPromotionManagerAfterPublish(false);
      clearPromotionCoverageOverlay();
      accuracyCircleRef.current?.setMap(null);
      return;
    }

    if (shouldOpenPromotionManagerAfterPublish) {
      setShouldOpenPromotionManagerAfterPublish(false);
      setIsPromotionComposerOpen(false);
      setIsConfirmingPromotionRemoval(false);
      setIsPromotionManagerOpen(true);
    }
  }, [activeOwnPromotion, shouldOpenPromotionManagerAfterPublish]);

  useEffect(() => {
    const map = mapRef.current;
    const maps = mapsRef.current;

    if (!mapReady || !map || !maps || !activeOwnPromotion || locationState.status !== "ready") {
      clearPromotionCoverageOverlay();
      return;
    }

    const center = {
      lat: Number(activeOwnPromotion.latitude),
      lng: Number(activeOwnPromotion.longitude),
    };

    if (!Number.isFinite(center.lat) || !Number.isFinite(center.lng)) {
      clearPromotionCoverageOverlay();
      return;
    }

    const radiusMeters = PROVIDER_PROMOTION_RADIUS_KM * 1000;

    if (!promotionCoverageCircleRef.current) {
      promotionCoverageCircleRef.current = new maps.Circle({
        map,
        center,
        radius: radiusMeters,
        clickable: false,
        strokeColor: "#2563eb",
        strokeOpacity: 0.36,
        strokeWeight: 2,
        fillColor: "#2563eb",
        fillOpacity: 0.07,
        zIndex: 90,
      });
    } else {
      promotionCoverageCircleRef.current.setMap(map);
      promotionCoverageCircleRef.current.setCenter(center);
      promotionCoverageCircleRef.current.setRadius(radiusMeters);
    }

    if (!promotionRadarCircleRef.current) {
      promotionRadarCircleRef.current = new maps.Circle({
        map,
        center,
        radius: 0,
        clickable: false,
        strokeColor: "#2563eb",
        strokeOpacity: 0,
        strokeWeight: 2,
        fillColor: "#2563eb",
        fillOpacity: 0,
        zIndex: 95,
      });
    } else {
      promotionRadarCircleRef.current.setMap(map);
      promotionRadarCircleRef.current.setCenter(center);
    }

    if (promotionRadarFrameRef.current !== null) {
      window.cancelAnimationFrame(promotionRadarFrameRef.current);
      promotionRadarFrameRef.current = null;
    }

    if (promotionRadarTimeoutRef.current !== null) {
      window.clearTimeout(promotionRadarTimeoutRef.current);
      promotionRadarTimeoutRef.current = null;
    }

    const pulseTravelDurationMs = 2200;
    const pulsePauseDurationMs = 5000;
    let animationStartMs: number | null = null;

    const scheduleNextPulse = () => {
      promotionRadarTimeoutRef.current = window.setTimeout(() => {
        promotionRadarTimeoutRef.current = null;
        animationStartMs = null;
        if (!promotionRadarCircleRef.current) {
          return;
        }

        promotionRadarCircleRef.current.setRadius(0);
        promotionRadarCircleRef.current.setOptions({
          strokeOpacity: 0,
          fillOpacity: 0,
        });
        promotionRadarFrameRef.current = window.requestAnimationFrame(animatePromotionPulse);
      }, pulsePauseDurationMs);
    };

    const animatePromotionPulse = (timestamp: number) => {
      if (!promotionRadarCircleRef.current) {
        return;
      }

      if (animationStartMs === null) {
        animationStartMs = timestamp;
      }

      const elapsed = timestamp - animationStartMs;
      const isAtEdge = elapsed >= pulseTravelDurationMs;
      const progress = isAtEdge ? 1 : elapsed / pulseTravelDurationMs;
      const smoothProgress = progress * progress * (3 - 2 * progress);
      const pulseRadius = radiusMeters * smoothProgress;

      promotionRadarCircleRef.current.setCenter(center);
      promotionRadarCircleRef.current.setRadius(pulseRadius);
      promotionRadarCircleRef.current.setOptions({
        strokeOpacity: 0.36 - progress * 0.1,
        fillOpacity: 0.12 - progress * 0.05,
      });

      if (isAtEdge) {
        promotionRadarFrameRef.current = null;
        promotionRadarCircleRef.current.setOptions({
          strokeOpacity: 0,
          fillOpacity: 0,
        });
        scheduleNextPulse();
        return;
      }

      promotionRadarFrameRef.current = window.requestAnimationFrame(animatePromotionPulse);
    };

    promotionRadarFrameRef.current = window.requestAnimationFrame(animatePromotionPulse);

    return () => {
      if (promotionRadarFrameRef.current !== null) {
        window.cancelAnimationFrame(promotionRadarFrameRef.current);
        promotionRadarFrameRef.current = null;
      }
      if (promotionRadarTimeoutRef.current !== null) {
        window.clearTimeout(promotionRadarTimeoutRef.current);
        promotionRadarTimeoutRef.current = null;
      }
    };
  }, [activeOwnPromotion, locationState.status, mapReady]);

  useEffect(() => {
    if (!interestPromptKey) {
      return;
    }

    if (lastInterestPromptKeyRef.current === interestPromptKey) {
      return;
    }

    lastInterestPromptKeyRef.current = interestPromptKey;
    setIsWorkerProfileOpen(true);
  }, [interestPromptKey]);

  useEffect(() => {
    if (activeServiceRequest?.status !== "interest-received") {
      setIsWorkerProfileOpen(false);
    }
  }, [activeServiceRequest?.status]);

  useEffect(() => {
    if (
      !isWorkerProfileOpen ||
      activeServiceRequest?.status !== "interest-received" ||
      !activeServiceRequest.workerId ||
      !sessionToken
    ) {
      setWorkerPublicProfile(null);
      return;
    }

    let cancelled = false;

    setWorkerPublicProfile(null);

    void apiRequest<{ profile: PublicUserProfile }>(
      `/api/users/${encodeURIComponent(activeServiceRequest.workerId)}/profile`,
      {
        token: sessionToken,
      }
    )
      .then((response) => {
        if (!cancelled) {
          setWorkerPublicProfile(response.profile);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setWorkerPublicProfile(null);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [
    activeServiceRequest?.status,
    activeServiceRequest?.workerId,
    isWorkerProfileOpen,
    sessionToken,
  ]);

  useEffect(() => {
    if (!selectedPin?.requesterId || !sessionToken) {
      setSelectedPinProfile(null);
      return;
    }

    let cancelled = false;

    setSelectedPinProfile(null);

    void apiRequest<{ profile: PublicUserProfile }>(
      `/api/users/${encodeURIComponent(selectedPin.requesterId)}/profile`,
      {
        token: sessionToken,
      }
    )
      .then((response) => {
        if (!cancelled) {
          setSelectedPinProfile(response.profile);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setSelectedPinProfile(null);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [selectedPin?.requesterId, sessionToken]);

  useEffect(() => {
    if (!isRequestComposerOpen) {
      setLocationPrecisionError(null);
      return;
    }

    const frameId = window.requestAnimationFrame(() => {
      if (requestComposerRef.current) {
        requestComposerRef.current.scrollTop = 0;
      }
    });

    return () => {
      window.cancelAnimationFrame(frameId);
    };
  }, [isRequestComposerOpen]);

  useEffect(() => {
    if (!isRequestComposerOpen || locationState.status !== "ready" || hasAcceptedRequestLocation) {
      if (hasAcceptedRequestLocation) {
        setLocationPrecisionError(null);
      }
      return;
    }

    void resolveComposerPreciseLocation();
  }, [
    hasAcceptedRequestLocation,
    isRequestComposerOpen,
    locationState.status,
    locationState.status === "ready" ? locationState.source : null,
  ]);

  useEffect(() => {
    if (!sessionToken) {
      hasLoadedPinsRef.current = false;
      return;
    }

    if (locationState.status !== "ready" || hasLoadedPinsRef.current) {
      return;
    }

    hasLoadedPinsRef.current = true;
    void refreshServicePins();
  }, [locationState.status, refreshServicePins, sessionToken]);

  useEffect(() => {
    if (!sessionToken || !mapReady || locationState.status !== "ready") {
      return;
    }

    const intervalId = window.setInterval(() => {
      if (document.hidden) {
        return;
      }

      void refreshServicePins();
    }, 5000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [locationState.status, mapReady, refreshServicePins, sessionToken]);

  useEffect(() => {
    let cancelled = false;

    async function initializeMap() {
      let initialLocation =
        cachedReadyLocationState?.source === "device"
          ? cachedReadyLocationState
          : createServiceAreaFallbackLocationState();

      setMapReady(false);
      setServiceAreaNotice(null);

      try {
        const maps = await loadGoogleMapsApi();
        const serviceAreaBounds = getBoundsFromPaths(SERVICE_AREA_PATHS);

        if (cancelled || !mapContainerRef.current) {
          return;
        }

        mapsRef.current = maps;
        serviceAreaBoundsRef.current = serviceAreaBounds;
        serviceAreaCenterRef.current = getCenterFromBounds(serviceAreaBounds);

        const initialLocationInsideServiceArea = initialLocation
          ? isWithinServiceArea(initialLocation.coords)
          : false;
        const shouldFocusInitialLocation =
          Boolean(initialLocation) &&
          initialLocation?.source === "device" &&
          initialLocationInsideServiceArea;

        const map =
          mapRef.current ??
            new maps.Map(mapContainerRef.current, {
              center:
                shouldFocusInitialLocation && initialLocation
                  ? initialLocation.coords
                  : SERVICE_AREA_CENTER,
              zoom:
                shouldFocusInitialLocation && initialLocation
                  ? MAP_ZOOM
                  : SERVICE_AREA_MIN_ZOOM,
              mapId: MAP_ID,
            disableDefaultUI: true,
            clickableIcons: false,
            gestureHandling: "greedy",
            mapTypeControl: false,
            streetViewControl: false,
            fullscreenControl: false,
            zoomControl: false,
            minZoom: SERVICE_AREA_MIN_ZOOM,
            restriction: {
              latLngBounds: serviceAreaBounds,
              strictBounds: true,
            },
          });

        mapRef.current = map;
        map.setOptions({
          minZoom: SERVICE_AREA_MIN_ZOOM,
          restriction: {
            latLngBounds: serviceAreaBounds,
            strictBounds: true,
          },
        });
        if (!shouldFocusInitialLocation) {
          map.fitBounds(serviceAreaBounds, 24);
        }
        syncServiceAreaMask(maps, map, serviceAreaBounds);
        syncServiceAreaOutline(maps, map);

        mapClickListenerRef.current?.remove?.();
        mapClickListenerRef.current = map.addListener("click", () => {
          setSelectedPinId(null);
        });
        mapIdleListenerRef.current?.remove?.();
        mapIdleListenerRef.current = map.addListener("idle", () => {
          syncServiceAreaMask(maps, map, serviceAreaBounds);
        });

        if (initialLocation) {
          applyResolvedLocation(initialLocation.coords, initialLocation.source, false);
        }

        const location = await resolveBestAvailableLocation({
          allowServiceAreaFallback: false,
        });

        if (cancelled || !location) {
          return;
        }

        const nextReadyLocationState = createReadyLocationState(
          location.coords,
          location.source
        );
        const currentCachedLocation = cachedReadyLocationState;

        if (!shouldUpgradeCachedLocation(currentCachedLocation, nextReadyLocationState)) {
          return;
        }

        applyResolvedLocation(
          location.coords,
          location.source,
          location.source === "device" ||
            !currentCachedLocation ||
            currentCachedLocation.source !== location.source ||
            !isWithinServiceArea(currentCachedLocation.coords)
        );
      } catch (error) {
        if (cancelled) {
          return;
        }

        setLocationState({
          status: "error",
          coords: null,
          error: extractErrorMessage(error),
          source: null,
        });
      }
    }

    initializeMap();

    return () => {
      cancelled = true;
    };
  }, [retryCount]);

  useEffect(() => {
    const map = mapRef.current;
    const maps = mapsRef.current;

    if (!map || !maps || locationState.status !== "ready") {
      return;
    }

    clearPinMarkers();

    visiblePins.forEach(({ pin, position }) => {
      const circle = new maps.Circle({
        map,
        center: position,
        radius: getDisplayedRequestMaskRadius(pin.maskedRadiusMeters),
        clickable: true,
        zIndex: pin.id === selectedPin?.id ? 520 : 410,
        ...getRequestCircleStyle(pin.type, pin.id === selectedPin?.id, "strong"),
      });

      const clickListener = circle.addListener("click", () => {
        setSelectedPinId(pin.id);
      });

      pinMarkersRef.current.set(pin.id, circle);
      pinMarkerClickListenersRef.current.set(pin.id, clickListener);
    });

    return () => {
      clearPinMarkers();
    };
  }, [locationState.status, selectedPin, visiblePins]);

  useEffect(() => {
    const map = mapRef.current;
    const maps = mapsRef.current;
    const request = activeServiceRequest;

    if (!map || !maps || locationState.status !== "ready" || !locationState.coords) {
      if (requestMarkerRef.current) {
        setGoogleMapsMarkerMap(requestMarkerRef.current, null);
      }
      requestPrivacyCircleRef.current?.setMap?.(null);
      return;
    }

    if (!request || request.status === "completed") {
      if (requestMarkerRef.current) {
        setGoogleMapsMarkerMap(requestMarkerRef.current, null);
      }
      requestPrivacyCircleRef.current?.setMap?.(null);
      return;
    }

    const shouldShowExactRequestMarker =
      request.exactLocationVisible && ["confirmed", "completed"].includes(request.status);

    if (!shouldShowExactRequestMarker) {
      const privacyCircleCenter =
        request.currentUserRole === "requester"
          ? {
              lat: request.latitude,
              lng: request.longitude,
            }
          : {
              lat: request.maskedLatitude,
              lng: request.maskedLongitude,
            };
      const privacyCircleRadius =
        request.currentUserRole === "requester"
          ? Math.max(request.accuracy ?? 90, 120)
          : getDisplayedRequestMaskRadius(request.maskedRadiusMeters);
      const privacyCircleTone =
        request.currentUserRole === "worker" ? "strong" : "soft";

      if (!requestPrivacyCircleRef.current) {
        requestPrivacyCircleRef.current = new maps.Circle({
          map,
          center: privacyCircleCenter,
          radius: privacyCircleRadius,
          clickable: false,
          zIndex: 430,
          ...getRequestCircleStyle(request.type, true, privacyCircleTone),
        });
      } else {
        requestPrivacyCircleRef.current.setMap(map);
        requestPrivacyCircleRef.current.setCenter(privacyCircleCenter);
        requestPrivacyCircleRef.current.setRadius(privacyCircleRadius);
        requestPrivacyCircleRef.current.setOptions(
          getRequestCircleStyle(request.type, true, privacyCircleTone)
        );
      }

      if (requestMarkerRef.current) {
        setGoogleMapsMarkerMap(requestMarkerRef.current, null);
      }
      return;
    }

    requestPrivacyCircleRef.current?.setMap?.(null);

    const destination = {
      lat: request.latitude,
      lng: request.longitude,
    };
    const shouldUseClientDestinationMarker =
      request.currentUserRole === "worker" && request.status === "confirmed";
    const content = shouldUseClientDestinationMarker
      ? createClientDestinationMarkerContent(maps)
      : createCategoryPinMarkerContent(maps, request.type, true);
    const markerTitle = shouldUseClientDestinationMarker
      ? `Destino de ${request.requesterName}${request.details?.schedule ? ` - ${request.details.schedule}` : ""}`
      : `Solicitação em aberto - ${request.type}`;
    const requestMarkerColor = shouldUseClientDestinationMarker
      ? CLIENT_ACCENT_COLOR
      : getCategoryColor(request.type, true);

    if (!requestMarkerRef.current) {
      requestMarkerRef.current = createGoogleMapsMarker(maps, {
        map,
        position: destination,
        zIndex: 960,
        content,
        title: markerTitle,
        color: requestMarkerColor,
        scale: shouldUseClientDestinationMarker ? 22 : 12,
        shape: shouldUseClientDestinationMarker ? "pin" : "circle",
      });
      return;
    }

    setGoogleMapsMarkerMap(requestMarkerRef.current, map);
    setGoogleMapsMarkerPosition(requestMarkerRef.current, destination);
    setGoogleMapsMarkerContent(requestMarkerRef.current, content);
    setGoogleMapsMarkerIcon(
      maps,
      requestMarkerRef.current,
      requestMarkerColor,
      shouldUseClientDestinationMarker ? 22 : 12,
      shouldUseClientDestinationMarker ? "pin" : "circle"
    );
    setGoogleMapsMarkerTitle(requestMarkerRef.current, markerTitle);
  }, [activeServiceRequest]);

  useEffect(() => {
    if (locationState.status !== "ready") {
      return;
    }

    let cancelled = false;

    void watchUserLocation(
      (nextCoords) => {
        const shouldFollowConfirmedRoute =
          activeServiceRequest?.status === "confirmed" &&
          activeServiceRequest.currentUserRole === "worker" &&
          activeServiceRequest.exactLocationVisible;
        const shouldUpgrade =
          shouldFollowConfirmedRoute ||
          locationState.source !== "device" ||
          nextCoords.accuracy + 15 < locationState.coords.accuracy;

        if (shouldUpgrade) {
          applyResolvedLocation(
            nextCoords,
            "device",
            shouldFollowConfirmedRoute ? false : locationState.source !== "device"
          );
        }
      },
      () => {
        // Se o watch falhar, mantemos a última localização válida.
      },
      {
        enableHighAccuracy: true,
        timeout: 20_000,
        maximumAge: 15_000,
        minimumUpdateInterval: 2_000,
      }
    )
      .then((handle) => {
        if (cancelled) {
          clearLocationWatch(handle);
          return;
        }

        deviceWatchIdRef.current = handle;
      })
      .catch(() => {
        // Mantemos a última localização válida quando o watch não pode iniciar.
      });

    return () => {
      cancelled = true;
      clearLocationWatch(deviceWatchIdRef.current);
      deviceWatchIdRef.current = null;
    };
  }, [activeServiceRequest?.currentUserRole, activeServiceRequest?.exactLocationVisible, activeServiceRequest?.status, locationState]);

  useEffect(() => {
    return () => {
      clearPinMarkers();
      clearPromotionCoverageOverlay();
      removeGoogleMapsListener(userMarkerClickListenerRef.current);
      userMarkerClickListenerRef.current = null;
      detachGoogleMapsOverlay(requestMarkerRef.current);
      detachGoogleMapsOverlay(requestPrivacyCircleRef.current);
      detachGoogleMapsOverlay(serviceAreaMaskRef.current);
      serviceAreaOutlineRefs.current.forEach((outline) => {
        detachGoogleMapsOverlay(outline);
      });
      serviceAreaOutlineRefs.current = [];
      removeGoogleMapsListener(mapClickListenerRef.current);
      mapClickListenerRef.current = null;
      removeGoogleMapsListener(mapIdleListenerRef.current);
      mapIdleListenerRef.current = null;
      clearLocationWatch(deviceWatchIdRef.current);
      deviceWatchIdRef.current = null;
      detachGoogleMapsOverlay(accuracyCircleRef.current);
      detachGoogleMapsOverlay(userMarkerRef.current);
      accuracyCircleRef.current = null;
      userMarkerRef.current = null;
      requestMarkerRef.current = null;
      requestPrivacyCircleRef.current = null;
      promotionCoverageCircleRef.current = null;
      promotionRadarCircleRef.current = null;
      serviceAreaMaskRef.current = null;
      mapRef.current = null;
      mapsRef.current = null;
    };
  }, []);

  const handleTakeRequest = async () => {
    if (!selectedPin || isTakingRequest) {
      return;
    }

    setIsTakingRequest(true);
    const result = await takeServiceRequest(selectedPin.id);
    setIsTakingRequest(false);

    if (!result.ok) {
      setMapSyncFeedback({
        tone: "error",
        message: result.error ?? "Não conseguimos pegar esta solicitação agora.",
      });
      return;
    }

    setSelectedPinId(null);
    setMapSyncFeedback({
      tone: "success",
      message: "Solicitação assumida. Ela saiu do mapa público e agora aparece no seu atendimento ativo.",
    });
  };

  const handleCancelRequest = async () => {
    if (isCancellingActiveRequest) {
      return;
    }

    setIsCancellingActiveRequest(true);
    setActiveRequestSheetError("");
    const result = await cancelActiveServiceRequest();
    setIsCancellingActiveRequest(false);

    if (!result.ok) {
      setActiveRequestSheetError(result.error ?? "Não conseguimos retirar seu pedido do mapa.");
      setMapSyncFeedback({
        tone: "error",
        message: result.error ?? "Não conseguimos retirar seu pedido do mapa.",
      });
      return;
    }

    setMapSyncFeedback({
      tone: "success",
      message:
        activeServiceRequest?.currentUserRole === "worker"
          ? "Voc?liberou a solicitação e ela voltou para o mapa."
          : "Seu pedido foi retirado do mapa.",
      });
    setIsActiveRequestSheetOpen(false);
  };

  const resolveComposerPreciseLocation = async () => {
    if (isResolvingPreciseLocation) {
      return false;
    }

    if (locationState.status === "ready" && hasAcceptedRequestLocation) {
      setLocationPrecisionError(null);
      return true;
    }

    setIsResolvingPreciseLocation(true);
    setLocationPrecisionError(null);

    try {
      const preciseLocation = await waitForAcceptedPreciseDeviceLocation();
      applyResolvedLocation(preciseLocation.coords, preciseLocation.source);
      return true;
    } catch (error) {
      setLocationPrecisionError(extractErrorMessage(error));
      return false;
    } finally {
      setIsResolvingPreciseLocation(false);
    }
  };

  const resolvePreciseRequestCoordinates = async () => {
    if (locationState.status === "ready" && hasPreciseDeviceLocation) {
      return locationState.coords;
    }

    const preciseLocation = await waitForAcceptedPreciseDeviceLocation();

    if (preciseLocation.coords.accuracy > PRECISE_REQUEST_ACCURACY_THRESHOLD_METERS) {
      throw new Error(
        `A localização do aparelho ainda está imprecisa (${formatAccuracy(
          preciseLocation.coords.accuracy
        )}). Ative GPS e Wi-Fi do celular e toque em atualizar localização.`
      );
    }

    return preciseLocation.coords;
  };

  const openRequestComposer = (mode: "request" | "offer") => {
    setRequestComposerMode(mode);
    setRequestError("");
    setPromotionError("");
    setLocationPrecisionError(null);
    setIsRequestComposerOpen(true);
  };

  const closeRequestComposer = () => {
    setRequestError("");
    setPromotionError("");
    setLocationPrecisionError(null);
    setIsRequestComposerOpen(false);
  };

  const handleCreateRequest = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const normalizedDescription = requestDescription.trim();

    if (hasLiveRequest) {
      setRequestError("Cancele o pedido atual antes de abrir outro.");
      return;
    }

    if (createRequestEligibilityError) {
      setRequestError(createRequestEligibilityError);
      return;
    }

    if (!normalizedDescription) {
      setRequestError("Descreva o serviço que você precisa para publicar no mapa.");
      return;
    }

    if (normalizedDescription.length > REQUEST_DESCRIPTION_MAX_LENGTH) {
      setRequestError("Resuma seu pedido em até 50 caracteres.");
      return;
    }

    setIsPublishingRequest(true);
    setRequestError("");
    setLocationPrecisionError(null);

    let preciseCoords: UserCoordinates;

    try {
      preciseCoords = await resolvePreciseRequestCoordinates();
      applyResolvedLocation(preciseCoords, "device");
    } catch (error) {
      setIsPublishingRequest(false);
      setLocationPrecisionError(
        error instanceof Error
          ? error.message
          : "Ative o GPS do celular para publicar o pedido."
      );
      return;
    }

    if (!isWithinServiceArea(preciseCoords)) {
      setIsPublishingRequest(false);
      setRequestError("Seu pedido só pode ser publicado dentro da área atendida pelo app.");
      return;
    }

    const result = await createServiceRequest({
      type: requestCategory,
      description: normalizedDescription,
      latitude: preciseCoords.lat,
      longitude: preciseCoords.lng,
      accuracy: preciseCoords.accuracy,
    });

    setIsPublishingRequest(false);

    if (!result.ok) {
      setRequestError(result.error ?? "Não conseguimos publicar seu pedido agora.");
      return;
    }

    setRequestDescription("");
    setRequestError("");
    setMapSyncFeedback({
      tone: "success",
      message: "Pedido publicado. Agora os profissionais podem encontrar você no mapa.",
    });
    closeRequestComposer();
  };

  const handleOpenPromotionAction = () => {
    setPromotionError("");
    setIsPromotionProfessionOpen(false);
    setIsPromotionDurationOpen(false);
    setIsConfirmingPromotionRemoval(false);

    if (activeOwnPromotion) {
      setIsPromotionManagerOpen(true);
      return;
    }

    if (hasLiveRequest) {
      setMapSyncFeedback({
        tone: "error",
        message: "Conclua o atendimento atual antes de divulgar outro serviço.",
      });
      return;
    }

    setPromotionProfession(serviceProfessions[0] ?? "");
    setPromotionDescription("");
    setPromotionHourlyRate("");
    setPromotionDurationDays(3);
    setIsPromotionComposerOpen(true);
  };

  const handleRemoveActivePromotion = async () => {
    if (!activeOwnPromotion || isRemovingPromotion) {
      return;
    }

    setPromotionError("");
    setIsRemovingPromotion(true);
    const result = await removePost(activeOwnPromotion.id);
    setIsRemovingPromotion(false);

    if (!result.ok) {
      setPromotionError(result.error ?? "Não conseguimos remover sua divulgação agora.");
      return;
    }

    setIsConfirmingPromotionRemoval(false);
    setIsPromotionManagerOpen(false);
    setPublishedPromotionOverride(null);
    setMapSyncFeedback({
      tone: "success",
      message: "Divulgação removida.",
    });
  };

  const publishPromotion = async () => {
    if (isPublishingPromotion) {
      return;
    }

    if (hasLiveRequest) {
      setPromotionError("Conclua o atendimento atual antes de divulgar outro serviço.");
      return;
    }

    const normalizedDescription = promotionDescription.trim();
    const normalizedProfession = promotionProfession.trim();
    const hourlyRateCents = Math.round(parseCurrencyValue(promotionHourlyRate) * 100);

    if (activeOwnPromotion) {
      setPromotionError("Remova a divulgação atual antes de criar outra.");
      setIsPromotionComposerOpen(false);
      setIsPromotionManagerOpen(true);
      return;
    }

    if (createPromotionEligibilityError) {
      setPromotionError(createPromotionEligibilityError);
      return;
    }

    if (!normalizedProfession) {
      setPromotionError("Escolha a profissão que aparecerá na divulgação.");
      return;
    }

    if (!normalizedDescription) {
      setPromotionError("Descreva seu serviço para publicar a divulgação.");
      return;
    }

    if (normalizedDescription.length > PROMOTION_DESCRIPTION_MAX_LENGTH) {
      setPromotionError("Resuma sua divulgação em até 160 caracteres.");
      return;
    }

    if (!Number.isInteger(hourlyRateCents) || hourlyRateCents <= 0) {
      setPromotionError("Informe quanto você cobra por hora.");
      return;
    }

    setIsPublishingPromotion(true);
    setPromotionError("");

    let coords =
      locationState.status === "ready" && locationState.source === "device"
        ? locationState.coords
        : null;

    if (!coords) {
      try {
        coords = await getCurrentUserLocation({
          enableHighAccuracy: true,
          timeout: 20_000,
          maximumAge: 5_000,
        });
      } catch (locationError) {
        setIsPublishingPromotion(false);
        setPromotionError(
          locationError instanceof Error
            ? locationError.message
            : "Ative a localização do celular para publicar sua divulgação."
        );
        return;
      }
    }

    if (!isWithinServiceArea(coords)) {
      setIsPublishingPromotion(false);
      setPromotionError("A divulgação só pode ser publicada em Suzano ou Itaquaquecetuba.");
      return;
    }

    const derivedCategory = derivePromotionCategory(normalizedProfession);

    const result = await addPost({
      type: "offer",
      category: derivedCategory,
      content: normalizedDescription,
      profession: normalizedProfession,
      experience: normalizedDescription,
      hourlyRateCents,
      durationDays: promotionDurationDays,
      latitude: coords.lat,
      longitude: coords.lng,
    });

    setIsPublishingPromotion(false);

    if (!result.ok) {
      setPromotionError(result.error ?? "Não conseguimos publicar sua divulgação agora.");
      return;
    }

    setPromotionDescription("");
    setPromotionHourlyRate("");
    setPromotionCategory(derivedCategory);
    setPromotionError("");
    if (result.post) {
      setPublishedPromotionOverride(result.post);
    }
    setMapSyncFeedback({
      tone: "success",
      message: "Divulgação publicada para clientes próximos.",
    });
    setShouldOpenPromotionManagerAfterPublish(true);
    setIsPromotionProfessionOpen(false);
    setIsPromotionDurationOpen(false);
    setIsPromotionComposerOpen(false);
  };

  const handleCreatePromotion = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void publishPromotion();
  };

  const handleAcceptWorker = async () => {
    if (isAcceptingWorker) {
      return;
    }

    setActiveRequestSheetError("");
    setIsAcceptingWorker(true);
    const result = await acceptWorkerInterest();
    setIsAcceptingWorker(false);

    if (!result.ok || !result.chatId) {
      setMapSyncFeedback({
        tone: "error",
        message: result.error ?? "Não conseguimos abrir esta conversa agora.",
      });
      return;
    }

    setIsWorkerProfileOpen(false);
    setProfilePreview(null);
    navigate("/app/chat");
  };

  const handleDeclineWorker = async (options: { blockWorkerForTenMinutes?: boolean } = {}) => {
    if (isDecliningWorker) {
      return;
    }

    setActiveRequestSheetError("");
    setIsDecliningWorker(true);
    const result = await declineWorkerInterest(options);
    setIsDecliningWorker(false);

    if (!result.ok) {
      setMapSyncFeedback({
        tone: "error",
        message: result.error ?? "Não conseguimos seguir buscando outros profissionais agora.",
      });
      return;
    }

    setIsWorkerProfileOpen(false);
    setProfilePreview(null);
    setMapSyncFeedback({
      tone: "success",
      message: options.blockWorkerForTenMinutes
        ? "Profissional recusado(a) por 10 minutos."
        : "Busca liberada para outros profissionais.",
    });
  };

  const handleOpenProfilePreview = (params: {
    userId?: string | null;
    eyebrow: string;
    mode?: "default" | "interest";
    fallbackProfile: Partial<PublicUserProfile> & { fullName: string };
  }) => {
    if (!params.userId) {
      return;
    }

    setProfilePreview({
      userId: params.userId,
      eyebrow: params.eyebrow,
      mode: params.mode ?? "default",
      fallbackProfile: params.fallbackProfile,
    });
  };

  const handleOpenServiceRoute = () => {
    if (!activeServiceRequest) {
      return;
    }

    if (activeServiceRequest.status === "interest-received") {
      setIsWorkerProfileOpen(true);
      return;
    }

    if (activeServiceRequest.status === "chatting") {
      if (activeServiceRequest.chatId) {
        openChat(activeServiceRequest.chatId);
      }
      navigate("/app/chat");
      return;
    }

    if (activeServiceRequest.status === "details") {
      navigate(
        activeServiceRequest.currentUserRole === "requester"
          ? "/app/service/details"
          : "/app/chat"
      );
      return;
    }

    if (activeServiceRequest.status === "waiting-worker") {
      if (activeServiceRequest.currentUserRole === "worker" && activeServiceRequest.chatId) {
        openChat(activeServiceRequest.chatId);
      }
      navigate(
        activeServiceRequest.currentUserRole === "requester"
          ? "/app/service/waiting"
          : "/app/chat"
      );
      return;
    }

    if (activeServiceRequest.status === "payment") {
      if (activeServiceRequest.currentUserRole === "worker" && activeServiceRequest.chatId) {
        openChat(activeServiceRequest.chatId);
      }
      navigate(
        activeServiceRequest.currentUserRole === "requester"
          ? "/app/service/payment"
          : "/app/chat"
      );
      return;
    }

    if (activeServiceRequest.status === "confirmed") {
      if (activeServiceRequest.chatId) {
        openChat(activeServiceRequest.chatId);
      }
      navigate("/app/chat");
    }
  };

  const handleReleasePaymentFromSheet = async (
    payload: ServiceReviewPayload
  ): Promise<{ ok: boolean; error?: string }> => {
    const result = await releaseServicePayment(payload);

    if (!result.ok) {
      setActiveRequestSheetError(result.error ?? "Não conseguimos liberar o pagamento agora.");
      return result;
    }

    setActiveRequestSheetError("");
    return result;
  };

  const handleMarkWorkerArrivedFromSheet = async (): Promise<{
    ok: boolean;
    error?: string;
  }> => {
    setActiveRequestSheetError("");
    setIsMarkingWorkerArrived(true);
    const result = await markWorkerArrived();
    setIsMarkingWorkerArrived(false);

    if (!result.ok) {
      setActiveRequestSheetError(result.error ?? "Não conseguimos registrar a chegada agora.");
    }

    return result;
  };

  const handleOpenDisputeFromSheet = async (
    reason: string
  ): Promise<{ ok: boolean; error?: string }> => {
    const result = await openServiceDispute(reason);

    if (!result.ok) {
      setActiveRequestSheetError(result.error ?? "Não conseguimos abrir a disputa agora.");
      return result;
    }

    setActiveRequestSheetError("");
    return result;
  };

  const handleReportNoShowFromSheet = async (payload: {
    reason: string;
    evidenceImage?: string | null;
  }): Promise<{ ok: boolean; error?: string }> => {
    const result = await reportProviderNoShow(payload);

    if (!result.ok) {
      setActiveRequestSheetError(
        result.error ?? "Não conseguimos solicitar o ressarcimento agora."
      );
      return result;
    }

    setActiveRequestSheetError("");
    return result;
  };

  const handleRespondNoShowFromSheet = async (payload: {
    response: string;
    acknowledgesNoShow: boolean;
  }): Promise<{ ok: boolean; error?: string }> => {
    const result = await respondProviderNoShow(payload);

    if (!result.ok) {
      setActiveRequestSheetError(result.error ?? "Não conseguimos registrar sua resposta agora.");
      return result;
    }

    setActiveRequestSheetError("");
    return result;
  };

  const handleRecenter = () => {
    if (locationState.status !== "ready" || !mapRef.current) {
      return;
    }

    if (locationState.source !== "service-area" && isInsideServiceArea) {
      mapRef.current.panTo(locationState.coords);
      mapRef.current.setZoom(MAP_ZOOM);
      return;
    }

    if (serviceAreaCenterRef.current) {
      mapRef.current.panTo(serviceAreaCenterRef.current);
      mapRef.current.setZoom(
        Math.max(mapRef.current.getZoom?.() ?? SERVICE_AREA_MIN_ZOOM, SERVICE_AREA_MIN_ZOOM)
      );
    }
  };

  const handleRetry = () => {
    setRetryCount((current) => current + 1);
  };

  const handleToggleFullscreen = async () => {
    if (typeof document === "undefined") {
      return;
    }

    setSelectedPinId(null);
    const container = rootContainerRef.current;

    if (document.fullscreenElement === container) {
      try {
        await document.exitFullscreen();
      } catch {
        setIsFullscreenMode(false);
      }
      return;
    }

    if (container?.requestFullscreen) {
      try {
        await container.requestFullscreen();
        return;
      } catch {
        // Fallback local para ambientes sem fullscreen funcional.
      }
    }

    setIsFullscreenMode((current) => !current);
  };

  const getActiveRequestDestinationLabel = () => {
    if (!activeServiceRequest) {
      return "";
    }

    return (
      activeServiceRequest.details?.address ||
      activeServiceRequest.details?.locationLabel ||
      activeServiceRequest.locationLabel ||
      "Local do cliente"
    );
  };

  const handleOpenExternalRoute = (app: "google" | "waze") => {
    if (!canOpenExternalRoute || !activeServiceRequest || typeof window === "undefined") {
      return;
    }

    const latitude = Number(activeServiceRequest.latitude);
    const longitude = Number(activeServiceRequest.longitude);
    const destination = `${latitude},${longitude}`;
    const url =
      app === "waze"
        ? `https://waze.com/ul?ll=${encodeURIComponent(destination)}&navigate=yes`
        : `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(
            destination
          )}&travelmode=driving`;

    setIsRoutePickerOpen(false);
    window.open(url, "_blank", "noopener,noreferrer");
  };

  useEffect(() => {
    if (typeof document === "undefined") {
      return;
    }

    const syncFullscreenState = () => {
      setIsFullscreenMode(document.fullscreenElement === rootContainerRef.current);
    };

    document.addEventListener("fullscreenchange", syncFullscreenState);

    return () => {
      document.removeEventListener("fullscreenchange", syncFullscreenState);
    };
  }, []);

  return (
    <div
      ref={rootContainerRef}
      className="home-map-preserve-theme relative h-full w-full min-w-0 overflow-hidden bg-slate-950"
    >
      <div
        ref={mapContainerRef}
        className="absolute inset-0"
      />

      {!mapReady && locationState.status !== "error" && (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-slate-950/18">
          <div className="rounded-full border border-white/12 bg-slate-950/75 px-5 py-3 text-sm font-medium text-white shadow-2xl backdrop-blur-xl">
            Carregando mapa...
          </div>
        </div>
      )}

      {locationState.status === "ready" && (
        <div className="pointer-events-none absolute left-4 right-4 top-4 z-30 bottom-[7rem] sm:bottom-32">
          <div className="pointer-events-auto mx-auto flex max-h-full w-full max-w-md flex-col overflow-y-auto hide-scrollbar">
            <div
              className="hide-scrollbar -mx-1 overflow-x-auto px-1 pb-1"
            >
              <div className="flex min-w-max gap-2">
                {categories.map((category) => {
                  const Icon = category.icon;
                  const isActive = activeCategory === category.id;

                  return (
                    <button
                      key={category.id}
                      onClick={() => setActiveCategory(category.id)}
                      aria-label={category.label}
                      className={`rounded-full border font-semibold backdrop-blur-xl transition ${
                        isFullscreenMode
                          ? "flex h-11 w-11 items-center justify-center p-0"
                          : "flex items-center gap-2 px-4 py-2.5 text-sm"
                      } ${getCategoryChipClasses(category.id, isActive)}`}
                    >
                      <Icon className="h-4 w-4" />
                      {!isFullscreenMode && category.label}
                    </button>
                  );
                })}
                {isFullscreenMode && (
                  <button
                    type="button"
                    onClick={handleToggleFullscreen}
                    className="flex h-11 w-11 items-center justify-center rounded-full border border-white/10 bg-slate-950/76 p-0 text-white/72 backdrop-blur-xl transition hover:bg-slate-950/88 hover:text-white"
                    aria-label="Sair do modo de tela cheia"
                  >
                    <Minimize2 className="h-4 w-4" />
                  </button>
                )}
              </div>
            </div>

            {!isFullscreenMode && hasLiveRequest ? (
              <button
                type="button"
                onClick={() => {
                  setActiveRequestSheetError("");
                  setIsActiveRequestSheetOpen(true);
                }}
                className="mt-3 inline-flex w-full items-center justify-center rounded-[22px] border border-blue-300/20 bg-slate-950/88 px-4 py-3 text-sm font-semibold text-white backdrop-blur-xl transition hover:bg-slate-950"
              >
                Solicitação em andamento
              </button>
            ) : null}

            {!isFullscreenMode && serviceAreaNotice && (
              <div className="mt-3 rounded-full border border-amber-300/25 bg-slate-950/88 px-4 py-2 text-xs font-semibold text-amber-100 backdrop-blur-xl">
                {serviceAreaNotice}
              </div>
            )}

          </div>
        </div>
      )}

      <AnimatePresence>
        {locationState.status === "error" && (
          <motion.div
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 18 }}
            className="absolute left-1/2 top-4 z-30 w-[calc(100%-1.5rem)] max-w-sm -translate-x-1/2 rounded-[24px] border border-rose-300/20 bg-slate-950/80 p-4 text-white backdrop-blur-xl"
          >
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-rose-400/15 text-rose-200">
                <TriangleAlert className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold">Falha ao localizar</p>
                <p className="mt-1 text-sm text-white/65">{locationState.error}</p>
              </div>
            </div>

            <button
              onClick={handleRetry}
              className="mt-4 inline-flex items-center gap-2 rounded-2xl bg-white px-4 py-2.5 text-sm font-semibold text-slate-900 transition hover:bg-slate-100"
            >
              <RefreshCw className="h-4 w-4" />
              Tentar novamente
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {!isFullscreenMode && selectedPin && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedPinId(null)}
              className="absolute inset-x-0 top-0 bottom-[5.5rem] z-[60] sm:bottom-[5.25rem]"
            />
            <motion.div
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 18 }}
              className="pointer-events-none absolute left-4 right-4 z-[70] bottom-[7rem] sm:bottom-28"
            >
              <div
                onClick={(event) => event.stopPropagation()}
                className="pointer-events-auto mx-auto max-h-[calc(100dvh-9.5rem)] w-full max-w-sm overflow-y-auto rounded-[28px] border border-white/12 bg-slate-950/82 p-5 text-white shadow-[0_18px_60px_rgba(2,6,23,0.5)] backdrop-blur-xl custom-scrollbar sm:max-h-[70vh]"
              >
              <div className="flex items-start gap-4">
                <div className="relative shrink-0">
                  <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-full bg-blue-600 text-lg font-bold text-white shadow-inner">
                    {selectedPinProfile?.avatar ? (
                      <img
                        src={selectedPinProfile.avatar}
                        alt={selectedPin.requesterName}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      getInitials(selectedPin.requesterName)
                    )}
                  </div>
                  {(selectedPinProfile?.isCpfVerified ?? selectedPin.isVerified) && (
                    <VerifiedBadge
                      size="md"
                      className="absolute bottom-0 right-0 ring-white/80"
                      title={`${selectedPin.requesterName} verificado`}
                    />
                  )}
                </div>

                <div className="min-w-0 flex-1">
                  <p
                    className="text-[11px] font-semibold uppercase tracking-[0.24em]"
                    style={{ color: getCategoryColor(selectedPin.type) }}
                  >
                    {selectedPin.type}
                  </p>
                  <h2 className="mt-1 break-words text-xl font-bold">
                    Pedido de {selectedPin.requesterName}
                  </h2>
                  <p className="mt-1 text-sm text-white/65">
                    {selectedPinEntry
                      ? `Publicado as ${selectedPinEntry.createdAtLabel}`
                      : "Pedido publicado no mapa"}
                  </p>

                </div>
              </div>

              <p className="mt-4 text-sm leading-relaxed text-white/72">
                {selectedPin.description}
              </p>

              <div className="mt-5 grid gap-3">
                <button
                  onClick={() =>
                    handleOpenProfilePreview({
                      userId: selectedPin.requesterId,
                      eyebrow: "Perfil do cliente",
                      fallbackProfile: {
                        fullName: selectedPin.requesterName,
                        accountKind: "client",
                        avatar: selectedPinProfile?.avatar ?? null,
                        isCpfVerified:
                          selectedPinProfile?.isCpfVerified ?? selectedPin.isVerified,
                        headline: selectedPinProfile?.headline || "Cliente Worko",
                        bio: selectedPinProfile?.bio ?? "",
                        professions: selectedPinProfile?.professions ?? [],
                        skills: selectedPinProfile?.skills ?? [],
                        availabilityNote: selectedPinProfile?.availabilityNote ?? "",
                        certificates: selectedPinProfile?.certificates ?? [],
                        completedServicesCount:
                          selectedPinProfile?.completedServicesCount ?? 0,
                        averageRating: selectedPinProfile?.averageRating ?? null,
                        reviewsCount: selectedPinProfile?.reviewsCount ?? 0,
                        recentReviews: selectedPinProfile?.recentReviews ?? [],
                      },
                    })
                  }
                  className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl border border-white/20 bg-white px-4 py-3 text-sm font-bold text-slate-950 transition hover:bg-slate-100"
                >
                  <UserRound className="h-4 w-4" />
                  Ver perfil
                </button>
                <button
                  onClick={handleTakeRequest}
                  disabled={isTakingRequest || hasLiveRequest}
                  className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-blue-600 px-4 py-3 text-sm font-bold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-500"
                >
                  <BellRing className={`h-4 w-4 ${isTakingRequest ? "animate-pulse" : ""}`} />
                  {isTakingRequest
                    ? "Pegando solicitação..."
                    : hasLiveRequest
                      ? "Atendimento em andamento"
                      : "Pegar solicitação"}
                </button>
              </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {!hasOverlayCardOpen && canViewCurrentServiceInfo && (
        <div className="absolute bottom-28 left-4 right-20 z-40 grid max-w-sm grid-cols-2 gap-2 sm:left-1/2 sm:right-auto sm:w-full sm:-translate-x-1/2">
          <button
            type="button"
            onClick={() => navigate("/app/current-service")}
            className="inline-flex h-14 min-w-0 items-center justify-center gap-2 rounded-full border border-slate-200 bg-white px-3 text-sm font-black text-slate-900 shadow-[0_14px_34px_rgba(15,23,42,0.18)] transition active:scale-[0.98]"
            aria-label="Ver informações do atendimento atual"
          >
            <ClipboardList className="h-5 w-5 shrink-0 text-blue-600" />
            <span className="truncate">Atendimento</span>
          </button>
          <button
            type="button"
            onClick={() => setIsRoutePickerOpen(true)}
            disabled={!canOpenExternalRoute}
            className="inline-flex h-14 min-w-0 items-center justify-center gap-2 rounded-full border border-blue-600 bg-blue-600 px-3 text-sm font-black text-white transition active:scale-[0.98] disabled:cursor-not-allowed disabled:border-slate-300 disabled:bg-slate-300"
            aria-label="Ver rota em aplicativo externo"
          >
            <MapPin className="h-5 w-5 shrink-0" />
            <span className="truncate">Ver rota</span>
          </button>
        </div>
      )}

      <AnimatePresence>
        {isRoutePickerOpen && canOpenExternalRoute ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsRoutePickerOpen(false)}
            className="absolute inset-0 z-[82] flex items-end justify-center bg-slate-950/35 px-4 pb-[calc(6.5rem+env(safe-area-inset-bottom,0px))] backdrop-blur-[2px]"
          >
            <motion.div
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 18 }}
              transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
              onClick={(event) => event.stopPropagation()}
              className="w-full max-w-sm rounded-[28px] bg-white p-5 text-neutral-950"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <p className="text-[11px] font-black uppercase tracking-[0.18em] text-blue-600">
                    Rota externa
                  </p>
                  <h2 className="mt-1 text-xl font-black text-slate-950">
                    Abrir localiza??o do cliente?
                  </h2>
                </div>
                <button
                  type="button"
                  onClick={() => setIsRoutePickerOpen(false)}
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-500 transition active:bg-slate-200"
                  aria-label="Fechar"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="mt-4 rounded-2xl bg-blue-50 px-4 py-3">
                <div className="flex items-start gap-3">
                  <MapPin className="mt-0.5 h-5 w-5 shrink-0 text-blue-600" />
                  <p className="text-sm font-bold leading-relaxed text-blue-950">
                    {getActiveRequestDestinationLabel()}
                  </p>
                </div>
              </div>

              <div className="mt-4 grid gap-2">
                <button
                  type="button"
                  onClick={() => handleOpenExternalRoute("google")}
                  className="flex h-12 items-center justify-center gap-2 rounded-2xl bg-blue-600 text-sm font-black text-white transition active:scale-[0.98]"
                >
                  <MapPin className="h-4 w-4" />
                  Abrir no Google Maps
                </button>
                <button
                  type="button"
                  onClick={() => handleOpenExternalRoute("waze")}
                  className="flex h-12 items-center justify-center gap-2 rounded-2xl bg-slate-950 text-sm font-black text-white transition active:scale-[0.98]"
                >
                  <MapPin className="h-4 w-4" />
                  Abrir no Waze
                </button>
              </div>
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>

      <AnimatePresence>
        {isCurrentServiceInfoOpen && canViewCurrentServiceInfo && activeServiceRequest ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsCurrentServiceInfoOpen(false)}
            className="absolute inset-0 z-[83] flex items-end justify-center bg-slate-950/45 px-4 pb-[calc(6.5rem+env(safe-area-inset-bottom,0px))] backdrop-blur-[2px]"
          >
            <motion.div
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 18 }}
              transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
              onClick={(event) => event.stopPropagation()}
              className="max-h-[calc(100dvh-8rem)] w-full max-w-md overflow-y-auto rounded-[28px] bg-white p-5 text-neutral-950 custom-scrollbar"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <p className="text-[11px] font-black uppercase tracking-[0.18em] text-blue-600">
                    Atendimento atual
                  </p>
                  <h2 className="mt-1 break-words text-xl font-black text-slate-950">
                    {activeServiceRequest.details?.title || activeServiceRequest.type}
                  </h2>
                  <p className="mt-1 text-sm font-semibold text-slate-500">
                    Cliente: {activeServiceRequest.requesterName}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setIsCurrentServiceInfoOpen(false)}
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-500 transition active:bg-slate-200"
                  aria-label="Fechar informações do atendimento"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="mt-4 rounded-2xl bg-slate-50 p-4">
                <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">
                  Solicitação do cliente
                </p>
                <p className="mt-2 text-sm font-semibold leading-relaxed text-slate-800">
                  {activeServiceRequest.description}
                </p>
              </div>

              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                <div className="flex items-start gap-3 rounded-2xl border border-slate-200 p-3.5">
                  <CalendarDays className="mt-0.5 h-5 w-5 shrink-0 text-blue-600" />
                  <div className="min-w-0">
                    <p className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-400">Data</p>
                    <p className="mt-1 text-sm font-black text-slate-900">
                      {activeServiceRequest.details?.serviceDate
                        ? new Intl.DateTimeFormat("pt-BR", {
                            day: "2-digit",
                            month: "long",
                            year: "numeric",
                          }).format(
                            new Date(`${activeServiceRequest.details.serviceDate}T12:00:00`)
                          )
                        : "Conforme combinado"}
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3 rounded-2xl border border-slate-200 p-3.5">
                  <Clock3 className="mt-0.5 h-5 w-5 shrink-0 text-blue-600" />
                  <div className="min-w-0">
                    <p className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-400">Horário</p>
                    <p className="mt-1 text-sm font-black text-slate-900">
                      {activeServiceRequest.details?.schedule || "Conforme combinado"}
                    </p>
                    {activeServiceRequest.details ? (
                      <p className="mt-0.5 text-xs text-slate-500">
                        Tolerância: {activeServiceRequest.details.delayToleranceMinutes} min
                      </p>
                    ) : null}
                  </div>
                </div>
                <div className="flex items-start gap-3 rounded-2xl border border-slate-200 p-3.5 sm:col-span-2">
                  <MapPin className="mt-0.5 h-5 w-5 shrink-0 text-blue-600" />
                  <div className="min-w-0">
                    <p className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-400">Local</p>
                    <p className="mt-1 break-words text-sm font-black leading-relaxed text-slate-900">
                      {getActiveRequestDestinationLabel()}
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3 rounded-2xl border border-slate-200 p-3.5 sm:col-span-2">
                  <CircleDollarSign className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />
                  <div className="min-w-0">
                    <p className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-400">Valor do serviço</p>
                    <p className="mt-1 text-sm font-black text-slate-900">
                      {activeServiceRequest.details?.price || "Conforme combinado"}
                    </p>
                    <p className="mt-0.5 text-xs leading-relaxed text-slate-500">
                      Este valor não inclui cobrança de deslocamento ao cliente.
                    </p>
                  </div>
                </div>
              </div>

              <div className="mt-3 rounded-2xl border border-amber-200 bg-amber-50 p-4">
                <div className="flex items-start gap-3">
                  <Wrench className="mt-0.5 h-5 w-5 shrink-0 text-amber-700" />
                  <div>
                    <p className="text-sm font-black text-amber-950">Responsabilidades do prestador</p>
                    <ul className="mt-2 grid gap-1.5 text-xs font-semibold leading-relaxed text-amber-900">
                      <li>• Levar todas as ferramentas necessárias para executar o trabalho.</li>
                      <li>• Organizar e custear o próprio trajeto até o cliente.</li>
                      <li>• Nunca cobrar do cliente combustível, transporte ou qualquer custo de deslocamento.</li>
                      <li>• Respeitar data, horário, tolerância e escopo combinados.</li>
                    </ul>
                  </div>
                </div>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setIsCurrentServiceInfoOpen(false);
                    if (activeServiceRequest.chatId) openChat(activeServiceRequest.chatId);
                    navigate("/app/chat");
                  }}
                  className="flex h-12 items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 text-sm font-black text-slate-800 transition active:bg-slate-50"
                >
                  <MessageCircleMore className="h-4 w-4" />
                  Abrir chat
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsCurrentServiceInfoOpen(false);
                    setIsRoutePickerOpen(true);
                  }}
                  disabled={!canOpenExternalRoute}
                  className="flex h-12 items-center justify-center gap-2 rounded-2xl bg-blue-600 px-3 text-sm font-black text-white transition active:scale-[0.98] disabled:bg-slate-300"
                >
                  <MapPin className="h-4 w-4" />
                  Ver rota
                </button>
              </div>
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>

      {!isFullscreenMode && !hasOverlayCardOpen && (
        <button
          onClick={handleToggleFullscreen}
          disabled={!mapReady || locationState.status !== "ready"}
          className="absolute bottom-60 right-4 z-40 flex h-14 w-14 items-center justify-center rounded-full border border-white/[0.12] bg-slate-950/82 text-white shadow-[0_18px_60px_rgba(2,6,23,0.5)] backdrop-blur-xl transition hover:bg-slate-900 disabled:cursor-not-allowed disabled:opacity-60"
          aria-label="Abrir mapa em tela cheia"
        >
          <Maximize2 className="h-5 w-5" />
        </button>
      )}

      {!isFullscreenMode && !hasOverlayCardOpen && (
        <button
          onClick={handleRecenter}
          disabled={!mapReady || locationState.status !== "ready"}
          className="absolute bottom-44 right-4 z-40 flex h-14 w-14 items-center justify-center rounded-full border border-white/[0.12] bg-slate-950/82 text-white shadow-[0_18px_60px_rgba(2,6,23,0.5)] backdrop-blur-xl transition hover:bg-slate-900 disabled:cursor-not-allowed disabled:opacity-60"
          aria-label="Centralizar mapa na minha localização"
        >
          <LocateFixed className="h-6 w-6" />
        </button>
      )}

      {!isFullscreenMode && !hasOverlayCardOpen && user.isCpfVerified && (
        <button
          type="button"
          onClick={handleOpenPromotionAction}
          disabled={hasLiveRequest && !activeOwnPromotion}
          title={hasLiveRequest && !activeOwnPromotion ? "Conclua o atendimento atual para divulgar" : undefined}
          className="absolute bottom-28 right-4 z-40 flex h-14 w-14 items-center justify-center rounded-full border border-blue-500 bg-blue-600 text-white shadow-[0_18px_60px_rgba(37,99,235,0.35)] backdrop-blur-xl transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:border-slate-300 disabled:bg-slate-300 disabled:shadow-none"
          aria-label={activeOwnPromotion ? "Ver divulgação ativa" : "Criar divulgação"}
        >
          {activeOwnPromotion ? (
            <Search className="map-search-icon h-6 w-6" />
          ) : (
            <Megaphone className="map-megaphone-icon h-6 w-6" />
          )}
        </button>
      )}

      <AnimatePresence>
        {isPromotionManagerOpen && activeOwnPromotion && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => {
              setIsPromotionManagerOpen(false);
              setIsConfirmingPromotionRemoval(false);
            }}
            className="worqo-fullscreen-sheet z-[80]"
          >
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={(event) => event.stopPropagation()}
              className="min-h-[100dvh] w-full overflow-y-auto bg-white text-neutral-950 custom-scrollbar"
            >
              <div className="px-6 pb-7 pt-6">
                <div className="mb-1 flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <span className="text-[11px] font-black uppercase tracking-[0.18em] text-blue-600">
                      Divulgação ativa
                    </span>
                    <h2 className="mt-2 text-[26px] font-black leading-tight text-neutral-900">
                      Procurando clientes próximos
                    </h2>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setIsPromotionManagerOpen(false);
                      setIsConfirmingPromotionRemoval(false);
                    }}
                    className="-mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-neutral-100 text-neutral-500 transition active:bg-neutral-200"
                    aria-label="Fechar"
                  >
                    <X className="h-4 w-4" strokeWidth={2.5} />
                  </button>
                </div>
              </div>

              <div className="h-px bg-neutral-100" />

              <div className="px-6 py-5">
                <div className="rounded-[24px] bg-blue-50 p-5">
                  <div className="flex items-center gap-3">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-blue-600 text-white">
                      <Search className="map-search-icon h-5 w-5" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-[10px] font-black uppercase tracking-[0.18em] text-blue-500">
                        Raio no mapa
                      </p>
                      <p className="mt-1 text-lg font-black text-neutral-950">
                        {PROVIDER_PROMOTION_RADIUS_KM} km
                      </p>
                    </div>
                  </div>
                  <p className="mt-4 text-sm font-semibold leading-relaxed text-blue-900/75">
                    A área azul mostra onde sua divulgação pode aparecer para clientes próximos.
                  </p>
                </div>
              </div>

              <div className="h-px bg-neutral-100" />

              <div className="space-y-4 px-6 py-5">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.18em] text-neutral-400">
                    Profissão
                  </p>
                  <p className="mt-2 text-base font-black text-neutral-900">
                    {activeOwnPromotion.profession || activeOwnPromotion.category}
                  </p>
                </div>

                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.18em] text-neutral-400">
                    Divulgação
                  </p>
                  <p className="mt-2 text-sm font-semibold leading-relaxed text-neutral-700">
                    {activeOwnPromotion.experience || activeOwnPromotion.content}
                  </p>
                </div>

                <div className="rounded-2xl bg-blue-50 p-4">
                  <p className="text-[10px] font-black uppercase tracking-[0.16em] text-blue-500">
                    Valor por hora
                  </p>
                  <p className="mt-2 text-base font-black text-blue-700">
                    {activeOwnPromotion.hourlyRateCents
                      ? `${formatCurrencyAmount(activeOwnPromotion.hourlyRateCents / 100)}/hora`
                      : "Não informado"}
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-2xl bg-neutral-100 p-4">
                    <p className="text-[10px] font-black uppercase tracking-[0.16em] text-neutral-400">
                      Tempo
                    </p>
                    <p className="mt-2 text-sm font-black text-neutral-900">
                      {activeOwnPromotion.durationDays
                        ? `${activeOwnPromotion.durationDays} ${
                            activeOwnPromotion.durationDays === 1 ? "dia" : "dias"
                          }`
                        : "Ativo"}
                    </p>
                  </div>

                  <div className="rounded-2xl bg-neutral-100 p-4">
                    <p className="text-[10px] font-black uppercase tracking-[0.16em] text-neutral-400">
                      Até
                    </p>
                    <p className="mt-2 text-sm font-black text-neutral-900">
                      {formatPromotionExpiresLabel(activeOwnPromotion.expiresAt)}
                    </p>
                  </div>
                </div>

                <p className="text-xs font-semibold leading-relaxed text-neutral-500">
                  Para criar outra divulgação, remova esta primeiro.
                </p>
              </div>

              {promotionError ? (
                <div className="mx-6 mb-4 rounded-2xl bg-rose-50 px-4 py-3 text-sm font-bold text-rose-700">
                  {promotionError}
                </div>
              ) : null}

              <div className="px-6 pb-7 pt-1">
                {isConfirmingPromotionRemoval ? (
                  <div className="rounded-[24px] bg-neutral-100 p-4">
                    <p className="text-sm font-black text-neutral-900">
                      Remover esta divulgação?
                    </p>
                    <div className="mt-4 grid grid-cols-2 gap-3">
                      <button
                        type="button"
                        onClick={() => setIsConfirmingPromotionRemoval(false)}
                        disabled={isRemovingPromotion}
                        className="rounded-2xl bg-white px-4 py-3 text-sm font-black text-neutral-700 disabled:opacity-60"
                      >
                        Não
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleRemoveActivePromotion()}
                        disabled={isRemovingPromotion}
                        className="inline-flex items-center justify-center gap-2 rounded-2xl bg-red-500 px-4 py-3 text-sm font-black text-white disabled:opacity-60"
                      >
                        <Trash2 className="h-4 w-4" />
                        {isRemovingPromotion ? "Removendo..." : "Sim"}
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setIsConfirmingPromotionRemoval(true)}
                    className="flex w-full items-center justify-center gap-2.5 rounded-2xl bg-red-500 py-4 text-[15px] font-black tracking-wide text-white transition active:scale-[0.98]"
                  >
                    <Trash2 className="h-[17px] w-[17px]" strokeWidth={2.5} />
                    Remover divulgação
                  </button>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isPromotionComposerOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsPromotionComposerOpen(false)}
            className="worqo-fullscreen-sheet z-[80]"
          >
            <motion.form
              ref={requestComposerRef}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={(event) => event.stopPropagation()}
              onSubmit={handleCreatePromotion}
              className="min-h-[100dvh] w-full overflow-y-auto bg-white text-neutral-950 custom-scrollbar"
            >
              <div className="px-6 pb-7 pt-6">
                <div className="mb-1 flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <span className="text-[11px] font-black uppercase tracking-[0.18em] text-blue-600">
                      Divulgação
                    </span>
                    <h2 className="mt-2 text-[26px] font-black leading-tight text-neutral-900">
                      Aparecer para clientes próximos
                    </h2>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsPromotionComposerOpen(false)}
                    className="-mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-neutral-100 text-neutral-500 transition active:bg-neutral-200"
                    aria-label="Fechar"
                  >
                    <X className="h-4 w-4" strokeWidth={2.5} />
                  </button>
                </div>
              </div>

              <div className="h-px bg-neutral-100" />

              <div className="px-6 py-5">
                <label className="mb-3 block text-[10px] font-black uppercase tracking-[0.18em] text-neutral-400">
                  Quanto você cobra por hora
                </label>
                <div className="flex items-center rounded-[18px] bg-neutral-100 px-4 py-1">
                  <CircleDollarSign className="h-5 w-5 shrink-0 text-blue-600" />
                  <input
                    type="text"
                    inputMode="numeric"
                    value={promotionHourlyRate}
                    onChange={(event) => {
                      setPromotionHourlyRate(formatCurrencyInput(event.target.value));
                      setPromotionError("");
                    }}
                    placeholder="R$ 0,00"
                    className="min-w-0 flex-1 bg-transparent px-3 py-4 text-[15px] font-black text-neutral-800 outline-none placeholder:text-neutral-300"
                  />
                  <span className="text-xs font-bold text-neutral-400">por hora</span>
                </div>
                <p className="mt-2 text-xs font-semibold leading-relaxed text-neutral-500">
                  Esse valor aparecerá para clientes próximos na sua divulgação.
                </p>
              </div>

              <div className="h-px bg-neutral-100" />

              <div className="relative px-6 py-5">
                <label className="mb-3 block text-[10px] font-black uppercase tracking-[0.18em] text-neutral-400">
                  Profissão
                </label>

                {serviceProfessions.length > 0 ? (
                  <>
                    <button
                      type="button"
                      onClick={() => {
                        setIsPromotionDurationOpen(false);
                        setIsPromotionProfessionOpen((current) => !current);
                      }}
                      className="flex w-full items-center justify-between rounded-xl border border-neutral-200 bg-white px-4 py-3 text-left transition active:bg-neutral-50"
                      aria-expanded={isPromotionProfessionOpen}
                    >
                      <span className="truncate text-[15px] font-bold text-neutral-800">
                        {promotionProfession}
                      </span>
                      <ChevronDown
                        className={`h-[18px] w-[18px] shrink-0 text-neutral-400 transition-transform duration-200 ${
                          isPromotionProfessionOpen ? "rotate-180" : ""
                        }`}
                        strokeWidth={2.5}
                      />
                    </button>

                    {isPromotionProfessionOpen ? (
                      <div className="absolute left-6 right-6 top-full z-[90] -mt-2 max-h-44 overflow-y-auto rounded-xl border border-neutral-200 bg-white custom-scrollbar">
                        {serviceProfessions.map((profession) => (
                          <button
                            key={profession}
                            type="button"
                            onClick={() => {
                              setPromotionProfession(profession);
                              setPromotionError("");
                              setIsPromotionProfessionOpen(false);
                            }}
                            className={`w-full border-b border-neutral-50 px-4 py-3 text-left text-[14px] font-bold transition last:border-0 ${
                              profession === promotionProfession
                                ? "bg-blue-50 text-blue-600"
                                : "text-neutral-700 active:bg-neutral-50"
                            }`}
                          >
                            {profession}
                          </button>
                        ))}
                      </div>
                    ) : null}
                  </>
                ) : (
                  <div className="rounded-xl bg-amber-50 px-4 py-3 text-sm font-bold text-amber-800">
                    Cadastre uma profissão no perfil para se divulgar.
                  </div>
                )}
              </div>

              <div className="h-px bg-neutral-100" />

              <div className="px-6 py-5">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <label className="text-[10px] font-black uppercase tracking-[0.18em] text-neutral-400">
                    O que você faz
                  </label>
                  <span className="text-[11px] font-bold text-neutral-300">
                    {promotionDescription.trim().length}/{PROMOTION_DESCRIPTION_MAX_LENGTH}
                  </span>
                </div>
                <textarea
                  value={promotionDescription}
                  onChange={(event) => {
                    setPromotionDescription(
                      event.target.value.slice(0, PROMOTION_DESCRIPTION_MAX_LENGTH)
                    );
                    setPromotionError("");
                  }}
                  rows={4}
                  maxLength={PROMOTION_DESCRIPTION_MAX_LENGTH}
                  placeholder="Ex.: Eletricista residencial, instalação de chuveiro, tomadas e pequenos reparos."
                  className="min-h-[112px] w-full resize-none rounded-[18px] bg-neutral-100 px-4 py-4 text-[14px] font-semibold leading-relaxed text-neutral-700 outline-none placeholder:text-neutral-300"
                />
              </div>

              <div className="h-px bg-neutral-100" />

              <div className="relative px-6 py-5">
                <label className="mb-3 block text-[10px] font-black uppercase tracking-[0.18em] text-neutral-400">
                  Tempo no mapa
                </label>
                <button
                  type="button"
                  onClick={() => {
                    setIsPromotionProfessionOpen(false);
                    setIsPromotionDurationOpen((current) => !current);
                  }}
                  className="flex w-full items-center justify-between rounded-xl border border-neutral-200 bg-white px-4 py-3 text-left transition active:bg-neutral-50"
                  aria-expanded={isPromotionDurationOpen}
                >
                  <span className="truncate text-[15px] font-bold text-neutral-800">
                    {promotionDurationDays} {promotionDurationDays === 1 ? "dia" : "dias"}
                  </span>
                  <ChevronDown
                    className={`h-[18px] w-[18px] shrink-0 text-neutral-400 transition-transform duration-200 ${
                      isPromotionDurationOpen ? "rotate-180" : ""
                    }`}
                    strokeWidth={2.5}
                  />
                </button>

                {isPromotionDurationOpen ? (
                  <div className="absolute left-6 right-6 top-full z-[90] -mt-2 max-h-44 overflow-y-auto rounded-xl border border-neutral-200 bg-white custom-scrollbar">
                    {PROMOTION_DURATION_OPTIONS.map((days) => (
                      <button
                        key={days}
                        type="button"
                        onClick={() => {
                          setPromotionDurationDays(days);
                          setIsPromotionDurationOpen(false);
                        }}
                        className={`w-full border-b border-neutral-50 px-4 py-3 text-left text-[14px] font-bold transition last:border-0 ${
                          days === promotionDurationDays
                            ? "bg-blue-50 text-blue-600"
                            : "text-neutral-700 active:bg-neutral-50"
                        }`}
                      >
                        {days} {days === 1 ? "dia" : "dias"}
                      </button>
                    ))}
                  </div>
                ) : null}

                <p className="text-[12px] font-bold leading-relaxed text-blue-500">
                  Clientes dentro de {PROVIDER_PROMOTION_RADIUS_KM} km podem ver sua divulgação enquanto ela estiver ativa.
                </p>
              </div>

              {promotionError ? (
                <div className="mx-6 mb-4 rounded-2xl bg-rose-50 px-4 py-3 text-sm font-bold text-rose-700">
                  {promotionError}
                </div>
              ) : null}

              <div className="px-6 pb-7 pt-1">
                <button
                  type="button"
                  onClick={() => void publishPromotion()}
                  disabled={
                    isPublishingPromotion ||
                    !canCreatePromotion ||
                    !promotionProfession.trim() ||
                    parseCurrencyValue(promotionHourlyRate) <= 0
                  }
                  className="flex w-full items-center justify-center gap-2.5 rounded-2xl bg-blue-600 py-4 text-[15px] font-black tracking-wide text-white transition active:scale-[0.98] disabled:cursor-not-allowed disabled:bg-neutral-200 disabled:text-neutral-400"
                >
                  {isPublishingPromotion ? "Publicando..." : "Publicar divulgação"}
                  <SendHorizontal className="h-[17px] w-[17px] text-blue-200" strokeWidth={2.5} />
                </button>
              </div>
            </motion.form>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isRequestComposerOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={closeRequestComposer}
            className="worqo-fullscreen-sheet z-[80]"
          >
            <motion.form
              ref={requestComposerRef}
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 24 }}
              onClick={(event) => event.stopPropagation()}
              onSubmit={requestComposerMode === "request" ? handleCreateRequest : handleCreatePromotion}
              className="request-composer-sheet worqo-fullscreen-panel custom-scrollbar"
            >
              <div className="worqo-fullscreen-content">
                <div className="request-composer-header worqo-fullscreen-header">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                    <h2 className="text-2xl font-bold text-slate-900">
                      {requestComposerMode === "request" ? "Publicar pedido no mapa" : "Divulgar meu serviço"}
                    </h2>
                  </div>

                  <button
                    type="button"
                    onClick={closeRequestComposer}
                    className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-blue-100 bg-white text-slate-500 transition hover:bg-blue-50 hover:text-blue-700"
                    aria-label="Fechar"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>
                </div>

                <div className="pt-6">
                  <div className="mt-5 grid grid-cols-2 items-end gap-4 pt-3">
                  <button
                    type="button"
                    onClick={() => setRequestComposerMode("request")}
                    className={`origin-bottom overflow-hidden rounded-[28px] border text-left transition-all duration-200 ${
                      requestComposerMode === "request"
                        ? "-translate-y-2 z-[1] scale-[1.08] border-blue-200 bg-blue-50 text-blue-700 shadow-[0_24px_56px_rgba(37,99,235,0.22)]"
                        : "translate-y-2 scale-[0.92] border-slate-200 bg-slate-50 text-slate-600 opacity-85"
                    }`}
                  >
                    <div
                      className={`relative -mx-px -mt-px mb-0.5 flex h-[8.75rem] items-end justify-center overflow-hidden rounded-t-[27px] border-b bg-transparent px-2 pt-3 ${
                        requestComposerMode === "request"
                          ? "border-blue-100"
                          : "border-slate-200"
                      }`}
                    >
                      <img
                        src={personagemPedindoImage}
                        alt="Personagem pedindo serviço"
                        className="max-h-full w-auto max-w-full object-contain object-bottom"
                      />
                    </div>
                    <div className="px-4 py-3">
                    <p className="text-sm font-semibold">Pedir serviço</p>
                    </div>
                  </button>
                  <button
                    type="button"
                    onClick={() => setRequestComposerMode("offer")}
                    className={`origin-bottom overflow-hidden rounded-[28px] border text-left transition-all duration-200 ${
                      requestComposerMode === "offer"
                        ? "-translate-y-2 z-[1] scale-[1.08] border-blue-200 bg-blue-50 text-blue-700 shadow-[0_24px_56px_rgba(37,99,235,0.22)]"
                        : "translate-y-2 scale-[0.92] border-slate-200 bg-slate-50 text-slate-600 opacity-85"
                    }`}
                  >
                    <div
                      className={`relative -mx-px -mt-px mb-0.5 flex h-[8.75rem] items-end justify-center overflow-hidden rounded-t-[27px] border-b bg-transparent px-2 pt-3 ${
                        requestComposerMode === "offer"
                          ? "border-blue-100"
                          : "border-slate-200"
                      }`}
                    >
                      <img
                        src={personagemDivulgandoImage}
                        alt="Personagem divulgando serviço"
                        className="max-h-full w-auto max-w-full object-contain object-bottom"
                      />
                    </div>
                    <div className="px-4 py-3">
                    <p className="text-sm font-semibold">Divulgar meu serviço</p>
                    </div>
                  </button>
                </div>

                <div className="mt-6">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                      Categoria
                    </p>
                  </div>

                  <div className="mt-3 grid grid-cols-3 gap-2">
                    {requestComposerCategories.map((category) => {
                      const Icon = category.icon;
                      const isActive =
                        (requestComposerMode === "request"
                          ? requestCategory
                          : promotionCategory) === category.id;

                      return (
                        <button
                          key={category.id}
                          type="button"
                          onClick={() => {
                            if (requestComposerMode === "request") {
                              setRequestCategory(category.id);
                              return;
                            }

                            setPromotionCategory(category.id);
                          }}
                          className={`rounded-[24px] border px-3 py-4 text-center transition ${
                            isActive
                              ? category.activeClassName
                              : "border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100"
                          }`}
                        >
                          <div
                            className={`mx-auto flex h-11 w-11 items-center justify-center rounded-2xl ${
                              isActive ? "bg-white/80" : "bg-white"
                            }`}
                          >
                            <Icon
                              className={`h-5 w-5 ${
                                isActive ? category.iconClassName : "text-slate-400"
                              }`}
                            />
                          </div>
                          <p className="mt-3 text-sm font-semibold">{category.label}</p>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="mt-5 rounded-[28px] border border-slate-200 bg-slate-50 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-blue-600">
                        Serviços aceitos
                      </p>
                      <p className="mt-2 text-base font-semibold text-slate-900">
                        {selectedComposerCatalog.label}
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => navigate("/legal#termos-serviços-aceitos")}
                      className="shrink-0 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-[11px] font-semibold text-slate-600 transition hover:bg-slate-100"
                    >
                      Ver termos
                    </button>
                  </div>

                </div>

                <div className="mt-5 grid gap-3 sm:grid-cols-2">
                  {requestComposerMode === "request" &&
                    !canCreateServiceRequest &&
                    createRequestEligibilityError && (
                    <div className="rounded-[26px] border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800 sm:col-span-2">
                      <div className="flex items-start gap-3">
                        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white text-amber-600 shadow-sm">
                          <TriangleAlert className="h-5 w-5" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="font-semibold text-amber-900">
                            Complete seu perfil para publicar
                          </p>
                          <p className="mt-1 leading-relaxed">{createRequestEligibilityError}</p>
                          <button
                            type="button"
                            onClick={() => navigate("/app/profile/data")}
                            className="mt-3 inline-flex items-center justify-center rounded-2xl bg-amber-500 px-4 py-2 font-semibold text-slate-950 transition hover:bg-amber-400"
                          >
                            Ir para dados
                          </button>
                        </div>
                      </div>
                    </div>
                  )}

                  {requestComposerMode === "offer" &&
                    !canCreatePromotion &&
                    createPromotionEligibilityError && (
                    <div className="rounded-[26px] border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800 sm:col-span-2">
                      <p className="font-semibold text-amber-900">Complete seu perfil para se divulgar</p>
                      <p className="mt-1 leading-relaxed">{createPromotionEligibilityError}</p>
                    </div>
                  )}

                  {requestComposerMode === "request" && shouldPromptForGps ? (
                    <div className="rounded-[26px] border border-sky-200 bg-sky-50 p-4 text-sm text-sky-900 sm:col-span-2">
                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <p className="font-semibold text-sky-950">Ative o GPS para publicar</p>
                          <p className="mt-1 text-sky-900/80">{gpsActivationNotice}</p>
                          {locationPrecisionError ? (
                            <p className="mt-2 text-sm text-rose-700">{locationPrecisionError}</p>
                          ) : null}
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            void resolveComposerPreciseLocation();
                          }}
                          disabled={isResolvingPreciseLocation}
                          className="inline-flex shrink-0 items-center gap-2 rounded-2xl border border-sky-200 bg-white px-4 py-2 text-xs font-semibold text-sky-700 transition hover:bg-sky-50 disabled:cursor-not-allowed disabled:opacity-70"
                        >
                          <RefreshCw
                            className={`h-3.5 w-3.5 ${isResolvingPreciseLocation ? "animate-spin" : ""}`}
                          />
                          {isResolvingPreciseLocation ? "Atualizando..." : "Atualizar localização"}
                        </button>
                      </div>
                    </div>
                  ) : null}
                </div>

                {requestComposerMode === "offer" && user.professions.length > 0 ? (
                  <div className="mt-5 rounded-[28px] border border-slate-200 bg-slate-50 p-4">
                    <p className="text-sm font-semibold text-slate-900">Profissões do perfil</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {user.professions.map((profession) => (
                        <span
                          key={profession}
                          className="rounded-full border border-blue-100 bg-white px-3 py-1.5 text-xs font-semibold text-blue-700"
                        >
                          {profession}
                        </span>
                      ))}
                    </div>
                  </div>
                ) : null}

                <label className="mt-5 block">
                  <div className="rounded-[28px] border border-slate-200 bg-slate-50 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-slate-900">
                          {requestComposerMode === "request" ? "O que você precisa" : "Como você quer se divulgar"}
                        </p>
                      </div>
                      <span className="rounded-full bg-white px-3 py-1 text-[11px] font-semibold text-slate-400">
                        {(requestComposerMode === "request"
                          ? requestDescription.trim().length
                          : promotionDescription.trim().length)}/{REQUEST_DESCRIPTION_MAX_LENGTH}
                      </span>
                    </div>

                    <textarea
                      value={
                        requestComposerMode === "request" ? requestDescription : promotionDescription
                      }
                      onChange={(event) => {
                        const nextValue = event.target.value.slice(0, REQUEST_DESCRIPTION_MAX_LENGTH);

                        if (requestComposerMode === "request") {
                          setRequestDescription(nextValue);
                          if (requestError) {
                            setRequestError("");
                          }
                          return;
                        }

                        setPromotionDescription(nextValue);
                        if (promotionError) {
                          setPromotionError("");
                        }
                      }}
                      maxLength={REQUEST_DESCRIPTION_MAX_LENGTH}
                      rows={4}
                      spellCheck={false}
                      placeholder={
                        requestComposerMode === "request"
                          ? "Ex.: Preciso de ajuda para consertar uma torneira ainda hoje."
                          : "Ex.: Eletricista residencial com atendimento rápido em Suzano."
                      }
                      className="request-composer-textarea mt-4 w-full resize-none rounded-[24px] border border-white bg-white px-4 py-3 text-sm text-slate-700 outline-none transition focus:border-blue-500"
                    />
                  </div>
                </label>

                {requestComposerMode === "request" && requestError && (
                  <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                    {requestError}
                  </div>
                )}

                {requestComposerMode === "offer" && promotionError && (
                  <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                    {promotionError}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={
                    requestComposerMode === "request"
                      ? isPublishingRequest ||
                        !canCreateServiceRequest ||
                        isResolvingPreciseLocation ||
                        hasLiveRequest
                      : isPublishingPromotion || !canCreatePromotion
                  }
                  className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-[26px] bg-blue-600 px-5 py-4 text-sm font-semibold text-white shadow-[0_18px_40px_rgba(37,99,235,0.18)] transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-70"
                >
                  {requestComposerMode === "request"
                    ? isPublishingRequest
                      ? "Publicando pedido..."
                      : isResolvingPreciseLocation
                        ? "Atualizando localização..."
                        : hasLiveRequest
                          ? "Cancele o pedido atual para abrir outro"
                          : canCreateServiceRequest
                            ? "Publicar pedido no mapa"
                            : "Complete seu perfil para publicar"
                    : isPublishingPromotion
                      ? "Publicando divulgação..."
                      : canCreatePromotion
                        ? "Publicar divulgação"
                        : "Complete seu perfil para se divulgar"}
                </button>
                </div>
              </div>
            </motion.form>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isWorkerProfileOpen &&
          workerModalProfile &&
          activeServiceRequest?.status === "interest-received" && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsWorkerProfileOpen(false)}
              className="worqo-fullscreen-sheet z-[80]"
            >
              <motion.div
                initial={{ opacity: 0, y: 24 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 24 }}
                onClick={(event) => event.stopPropagation()}
                className="worqo-fullscreen-panel custom-scrollbar"
              >
                <div className="worqo-fullscreen-content">
                <div className="worqo-fullscreen-header">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.24em] text-blue-600">
                      Perfil do(a) profissional
                    </p>
                    <h2 className="mt-2 text-2xl font-bold text-slate-900">
                      {workerModalProfile.name}
                    </h2>
                    <p className="mt-1 max-w-xs text-sm leading-relaxed text-slate-500">
                      {workerModalProfile.headline ||
                        "Profissional disponível para este atendimento"}
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => setIsWorkerProfileOpen(false)}
                    className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-blue-100 bg-white text-slate-500 transition hover:bg-blue-50 hover:text-blue-700"
                    aria-label="Fechar perfil"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>
                  </div>

                  <div className="pt-6">
                    <div className="mt-5 worqo-flat-panel px-4 py-4">
                  <div className="flex items-center gap-4">
                    <div className="relative shrink-0">
                      <div className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-full bg-blue-600 text-2xl font-bold text-white shadow-lg">
                        {workerModalProfile.avatar ? (
                          <img
                            src={workerModalProfile.avatar}
                            alt={workerModalProfile.name}
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          getInitials(workerModalProfile.name)
                        )}
                      </div>
                      {workerModalProfile.isVerified ? (
                        <VerifiedBadge size="md" className="absolute bottom-1 right-1" />
                      ) : null}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap gap-2">
                        {workerModalProfile.professions.slice(0, 2).map((profession) => (
                          <span
                            key={profession}
                            className="inline-flex items-center rounded-full bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-700"
                          >
                            {profession}
                          </span>
                        ))}
                      </div>
                      <div className="mt-3 flex items-center gap-1 text-amber-400">
                        {Array.from({ length: 5 }).map((_, index) => (
                          <Star
                            key={index}
                            className={`h-4 w-4 ${
                              workerModalProfile.averageRating !== null &&
                              index < Math.round(workerModalProfile.averageRating)
                                ? "fill-amber-400"
                                : ""
                            }`}
                          />
                        ))}
                      </div>
                      <p className="mt-1 text-xs font-medium text-slate-500">
                        {workerModalProfile.averageRating !== null
                          ? `${workerModalProfile.averageRating.toFixed(1).replace(".", ",")} de 5 com ${workerModalProfile.reviewsCount} avaliação${workerModalProfile.reviewsCount === 1 ? "" : "oes"}`
                          : "Sem avaliações ainda"}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="mt-6">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                    Profissões
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {workerModalProfile.professions.map((profession) => (
                      <span
                        key={profession}
                        className="inline-flex items-center rounded-full bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-700"
                      >
                        {profession}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="mt-6 grid gap-3">
                  <button
                    type="button"
                    onClick={() =>
                      handleOpenProfilePreview({
                        userId: activeServiceRequest?.workerId,
                        eyebrow: "Perfil do(a) profissional",
                        mode: "interest",
                        fallbackProfile: {
                          fullName: workerModalProfile.name,
                          accountKind: "provider",
                          avatar: workerModalProfile.avatar,
                          isCpfVerified: workerModalProfile.isVerified,
                          headline: workerModalProfile.headline,
                          bio: workerModalProfile.bio,
                          professions: workerModalProfile.professions,
                          skills: workerModalProfile.skills,
                          completedServicesCount: workerModalProfile.completedServices,
                          averageRating: workerModalProfile.averageRating,
                          reviewsCount: workerModalProfile.reviewsCount,
                        },
                      })
                    }
                    className="rounded-[24px] border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
                  >
                    Ver perfil completo
                  </button>

                  <div className="grid gap-3">
                    <button
                      type="button"
                      onClick={handleAcceptWorker}
                      disabled={isAcceptingWorker || isDecliningWorker}
                      className="rounded-[24px] bg-blue-600 px-4 py-3 text-sm font-semibold text-white shadow-[0_18px_40px_rgba(37,99,235,0.18)] transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-70"
                    >
                      {isAcceptingWorker ? "Abrindo..." : "Abrir conversa"}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeclineWorker()}
                      disabled={isAcceptingWorker || isDecliningWorker}
                      className="rounded-[24px] border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-600 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-70"
                    >
                      {isDecliningWorker ? "Buscando..." : "Continuar buscando"}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeclineWorker({ blockWorkerForTenMinutes: true })}
                      disabled={isAcceptingWorker || isDecliningWorker}
                      className="rounded-[24px] border border-rose-100 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700 transition hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-70"
                    >
                      {isDecliningWorker ? "Recusando..." : "Recusar por 10 minutos"}
                    </button>
                  </div>
                </div>
                  </div>
                </div>
              </motion.div>
            </motion.div>
          )}
      </AnimatePresence>

      {pendingClientReviewRequest ? (
        <div className="fixed inset-0 z-[95] flex items-end justify-center bg-slate-950/40 px-4 py-5 backdrop-blur-[2px] sm:items-center">
          <div className="w-full max-w-sm rounded-[28px] bg-white p-5 text-neutral-950 shadow-[0_18px_55px_rgba(15,23,42,0.20)]">
            <p className="text-[11px] font-black uppercase tracking-[0.18em] text-blue-600">
              Avaliação obrigatória
            </p>
            <h2 className="mt-1 text-xl font-black leading-tight text-slate-950">
              Avalie o cliente
            </h2>

            <div className="mt-4 rounded-3xl bg-slate-50 p-4">
              <p className="text-sm font-black text-slate-950">
                {pendingClientReviewRequest.details?.title || pendingClientReviewRequest.description}
              </p>
              <p className="mt-1 text-xs font-bold text-slate-500">
                Cliente: {pendingClientReviewRequest.requesterName || "Cliente"}
              </p>
              <p className="mt-1 text-xs font-bold text-slate-500">
                Endereço: {pendingClientReviewRequest.details?.address || pendingClientReviewRequest.locationLabel || "Local protegido"}
              </p>
              {pendingClientReviewRequest.details?.schedule ? (
                <p className="mt-1 text-xs font-bold text-slate-500">
                  Horário: {pendingClientReviewRequest.details.schedule}
                </p>
              ) : null}
            </div>

            <div className="mt-5 flex justify-center gap-2">
              {Array.from({ length: 5 }).map((_, index) => {
                const value = index + 1;

                return (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setClientReviewRating(value)}
                      className={`flex h-11 w-11 items-center justify-center rounded-full ${
                        clientReviewRating >= value
                          ? "bg-amber-50 text-amber-500"
                          : "bg-slate-100 text-slate-300"
                      }`}
                  >
                    <Star className="h-5 w-5" fill="currentColor" />
                  </button>
                );
              })}
            </div>

            <textarea
              value={clientReviewComment}
              onChange={(event) => setClientReviewComment(event.target.value.slice(0, 220))}
              rows={4}
              placeholder="Conte como foi atender este cliente."
              className="mt-4 w-full resize-none rounded-2xl bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-700 outline-none focus:ring-2 focus:ring-blue-200"
            />

            <button
              type="button"
              onClick={() => void handleSubmitClientReview()}
              disabled={isSubmittingClientReview}
              className="mt-4 flex h-12 w-full items-center justify-center rounded-2xl bg-blue-600 text-sm font-black text-white disabled:opacity-60"
            >
              {isSubmittingClientReview ? "Enviando..." : "Enviar avaliação"}
            </button>
          </div>
        </div>
      ) : null}

      <ActiveRequestSheet
        request={activeServiceRequest}
        isOpen={isActiveRequestSheetOpen}
        isAcceptingWorker={isAcceptingWorker}
        isDecliningWorker={isDecliningWorker}
        isCancellingRequest={isCancellingActiveRequest}
        errorMessage={activeRequestSheetError}
        onClose={() => setIsActiveRequestSheetOpen(false)}
        onOpenFlow={handleOpenServiceRoute}
        onCancelRequest={() => void handleCancelRequest()}
        onAcceptWorker={() => void handleAcceptWorker()}
        onDeclineWorker={(options) => void handleDeclineWorker(options)}
        isMarkingWorkerArrived={isMarkingWorkerArrived}
        onMarkWorkerArrived={handleMarkWorkerArrivedFromSheet}
        onReleasePayment={handleReleasePaymentFromSheet}
        onOpenDispute={handleOpenDisputeFromSheet}
        onReportNoShow={handleReportNoShowFromSheet}
        onRespondNoShow={handleRespondNoShowFromSheet}
      />

      <PublicProfileModal
        isOpen={Boolean(profilePreview)}
        userId={profilePreview?.userId ?? null}
        eyebrow={profilePreview?.eyebrow}
        fallbackProfile={profilePreview?.fallbackProfile}
        footer={
          profilePreview?.mode === "interest" ? (
            <div className="grid gap-3">
              <button
                type="button"
                onClick={handleAcceptWorker}
                disabled={isAcceptingWorker || isDecliningWorker}
                className="rounded-[24px] bg-blue-600 px-4 py-3 text-sm font-semibold text-white shadow-[0_18px_40px_rgba(37,99,235,0.18)] transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-70"
              >
                {isAcceptingWorker ? "Abrindo..." : "Abrir conversa"}
              </button>
              <button
                type="button"
                onClick={() => handleDeclineWorker()}
                disabled={isAcceptingWorker || isDecliningWorker}
                className="rounded-[24px] border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-600 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-70"
              >
                {isDecliningWorker ? "Buscando..." : "Continuar buscando"}
              </button>
              <button
                type="button"
                onClick={() => handleDeclineWorker({ blockWorkerForTenMinutes: true })}
                disabled={isAcceptingWorker || isDecliningWorker}
                className="rounded-[24px] border border-rose-100 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700 transition hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-70"
              >
                {isDecliningWorker ? "Recusando..." : "Recusar por 10 minutos"}
              </button>
            </div>
          ) : null
        }
        onClose={() => setProfilePreview(null)}
      />
    </div>
  );
}

export function Home() {
  const {
    state: { user },
  } = useApp();

  if (user?.accountKind === "client") {
    return <ClientHome />;
  }

  return <ProviderHome />;
}

