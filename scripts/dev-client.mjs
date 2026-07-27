import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { build, preview } from "vite";

const root = fs.realpathSync(process.cwd());
const viteCacheDir = path.join(os.tmpdir(), "worko-vite-cache");
const projectViteCacheDir = path.join(root, ".vite-cache");
const legacyViteCacheDir = path.join(root, "node_modules", ".vite");

function removeBrokenViteCache(cacheDir) {
  if (!fs.existsSync(cacheDir)) {
    return;
  }

  const entries = fs.readdirSync(cacheDir, { withFileTypes: true });
  const hasOnlyTempDeps =
    entries.length > 0 &&
    entries.every((entry) => entry.isDirectory() && entry.name.startsWith("deps_temp_"));

  if (hasOnlyTempDeps) {
    fs.rmSync(cacheDir, { recursive: true, force: true });
    return;
  }

  for (const entry of entries) {
    if (entry.isDirectory() && entry.name.startsWith("deps_temp_")) {
      fs.rmSync(path.join(cacheDir, entry.name), { recursive: true, force: true });
    }
  }
}

removeBrokenViteCache(viteCacheDir);
removeBrokenViteCache(projectViteCacheDir);
removeBrokenViteCache(legacyViteCacheDir);

console.log("Subindo frontend em modo estavel. Aguarde o build inicial...");

await build({
  root,
  configFile: path.join(root, "vite.config.ts"),
  configLoader: "runner",
});

const server = await preview({
  root,
  configFile: path.join(root, "vite.config.ts"),
  configLoader: "runner",
  preview: {
    host: "0.0.0.0",
    port: 5173,
    strictPort: true,
    proxy: {
      "/api": "http://localhost:3001",
    },
  },
});

server.printUrls();

async function shutdown() {
  await server.close();
  process.exit(0);
}

process.on("SIGINT", () => {
  void shutdown();
});
process.on("SIGTERM", () => {
  void shutdown();
});
