import type { CapacitorConfig } from "@capacitor/cli";

const remoteServerUrl = process.env.CAPACITOR_SERVER_URL?.trim();
const localApiHosts = ["192.168.15.6", "34.39.198.120", "localhost"];
const allowCleartextTraffic = (process.env.ALLOW_CLEARTEXT_TRAFFIC ?? "false").trim() === "true";

function resolveServerConfig() {
  if (!remoteServerUrl) {
    return {
      androidScheme: allowCleartextTraffic ? "http" : "https",
      cleartext: allowCleartextTraffic,
      allowNavigation: localApiHosts,
    } satisfies CapacitorConfig["server"];
  }

  try {
    const remoteServer = new URL(remoteServerUrl);
    const usesCleartext = remoteServer.protocol === "http:";

    return {
      url: remoteServerUrl,
      cleartext: usesCleartext,
      androidScheme: usesCleartext ? "http" : "https",
      allowNavigation: [remoteServer.host, ...localApiHosts.filter((host) => host !== remoteServer.host)],
    } satisfies CapacitorConfig["server"];
  } catch {
    throw new Error(`CAPACITOR_SERVER_URL invalida: "${remoteServerUrl}"`);
  }
}

const serverConfig = resolveServerConfig();

const config: CapacitorConfig = {
  appId: "com.worqo.app",
  appName: "Worko",
  webDir: "dist",
  server: serverConfig,
  android: {
    allowMixedContent: allowCleartextTraffic,
  },
  plugins: {
    CapacitorHttp: {
      enabled: true,
    },
    PushNotifications: {
      presentationOptions: ["badge", "sound", "alert"],
    },
  },
};

export default config;
