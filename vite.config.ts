import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";
import { fileURLToPath } from "url";
import { defineConfig } from "vite";

const projectRoot = path.dirname(fileURLToPath(import.meta.url));
const viteCacheDir = path.resolve(projectRoot, ".vite-cache");

function resolveManualChunk(id: string) {
  if (!id.includes("node_modules")) {
    return undefined;
  }

  if (id.includes("react") || id.includes("react-dom") || id.includes("react-router")) {
    return "vendor-react";
  }

  if (id.includes("motion") || id.includes("date-fns") || id.includes("lucide-react")) {
    return "vendor-ui";
  }

  if (id.includes("@radix-ui") || id.includes("@mui")) {
    return "vendor-components";
  }

  if (id.includes("@capacitor")) {
    return "vendor-capacitor";
  }

  return "vendor";
}

export default defineConfig({
  root: projectRoot,
  cacheDir: viteCacheDir,
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(projectRoot, "./src"),
    },
  },
  server: {
    host: "0.0.0.0",
    port: 5173,
    strictPort: true,
    proxy: {
      "/api": "http://localhost:3001",
    },
  },
  preview: {
    host: "0.0.0.0",
    port: 5173,
    strictPort: true,
    proxy: {
      "/api": "http://localhost:3001",
    },
  },
  optimizeDeps: {
    noDiscovery: true,
    include: [],
  },
  build: {
    sourcemap: false,
    cssCodeSplit: true,
    rollupOptions: {
      output: {
        manualChunks: resolveManualChunk,
      },
    },
  },
  assetsInclude: ["**/*.svg", "**/*.csv"],
});
