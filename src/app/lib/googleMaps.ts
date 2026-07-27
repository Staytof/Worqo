type GoogleMapsApi = any;

declare global {
  interface Window {
    google?: {
      maps: GoogleMapsApi;
    };
    __worqoInitGoogleMaps?: () => void;
  }
}

const GOOGLE_MAPS_SCRIPT_ID = "worqo-google-maps-script";
let googleMapsPromise: Promise<GoogleMapsApi> | null = null;

export function resolveGoogleMapsMapId(value: string | undefined | null) {
  const normalized = value?.trim();

  if (!normalized || normalized === "DEMO_MAP_ID") {
    return undefined;
  }

  return normalized;
}

export function loadGoogleMapsApi() {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("Google Maps so pode ser carregado no navegador."));
  }

  if (window.google?.maps) {
    return Promise.resolve(window.google.maps);
  }

  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY?.trim();
  const mapId = resolveGoogleMapsMapId(import.meta.env.VITE_GOOGLE_MAPS_MAP_ID);

  if (!apiKey) {
    return Promise.reject(
      new Error("Defina VITE_GOOGLE_MAPS_API_KEY para carregar o Google Maps.")
    );
  }

  if (googleMapsPromise) {
    return googleMapsPromise;
  }

  googleMapsPromise = new Promise<GoogleMapsApi>((resolve, reject) => {
    const existingScript = document.getElementById(
      GOOGLE_MAPS_SCRIPT_ID
    ) as HTMLScriptElement | null;
    const reusableScript = existingScript && !window.google?.maps ? null : existingScript;

    if (existingScript && !reusableScript) {
      existingScript.remove();
    }

    window.__worqoInitGoogleMaps = () => {
      if (window.google?.maps) {
        resolve(window.google.maps);
        return;
      }

      reject(new Error("O Google Maps carregou sem expor a API esperada."));
    };

    const script =
      reusableScript ??
      Object.assign(document.createElement("script"), {
        id: GOOGLE_MAPS_SCRIPT_ID,
        async: true,
        defer: true,
      });

    script.onerror = () => {
      googleMapsPromise = null;
      reject(new Error("Nao foi possivel carregar o script do Google Maps."));
    };

    const url = new URL("https://maps.googleapis.com/maps/api/js");
    url.searchParams.set("key", apiKey);
    url.searchParams.set("loading", "async");
    url.searchParams.set("callback", "__worqoInitGoogleMaps");
    url.searchParams.set("libraries", "marker,places");
    url.searchParams.set("language", "pt-BR");
    url.searchParams.set("region", "BR");
    url.searchParams.set("v", "weekly");

    if (mapId) {
      url.searchParams.set("map_ids", mapId);
    }

    script.src = url.toString();

    if (!reusableScript) {
      document.head.appendChild(script);
    }
  }).finally(() => {
    delete window.__worqoInitGoogleMaps;
  });

  return googleMapsPromise;
}
