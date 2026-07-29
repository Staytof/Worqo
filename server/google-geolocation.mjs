import { config } from "./config.mjs";
import { HttpError } from "./utils.mjs";

function resolveGoogleErrorMessage(payload) {
  const message = payload?.error?.message;

  if (typeof message === "string" && message.trim()) {
    return message;
  }

  return "O Google Geolocation API não conseguiu localizar este dispositivo.";
}

export async function geolocateWithGoogle() {
  if (!config.googleMapsApiKey) {
    throw new HttpError(
      500,
      "A chave do Google Maps não foi configurada para geolocalização."
    );
  }

  const url = new URL("https://www.googleapis.com/geolocation/v1/geolocate");
  url.searchParams.set("key", config.googleMapsApiKey);

  let response;

  try {
    response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        considerIp: true,
      }),
    });
  } catch {
    throw new HttpError(
      502,
      "Não foi possível consultar a geolocalização do Google agora."
    );
  }

  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    throw new HttpError(response.status, resolveGoogleErrorMessage(payload));
  }

  if (
    !payload ||
    typeof payload !== "object" ||
    !payload.location ||
    typeof payload.location.lat !== "number" ||
    typeof payload.location.lng !== "number"
  ) {
    throw new HttpError(
      502,
      "O Google Geolocation API respondeu sem coordenadas validas."
    );
  }

  return {
    source: "google-ip",
    accuracy: typeof payload.accuracy === "number" ? payload.accuracy : null,
    location: {
      lat: payload.location.lat,
      lng: payload.location.lng,
    },
  };
}

