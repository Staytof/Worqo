import fs from "node:fs/promises";
import path from "node:path";
import { applySecurityHeaders } from "./utils.mjs";

const distDir = path.join(process.cwd(), "dist");

const contentTypes = {
  ".css": "text/css; charset=utf-8",
  ".gif": "image/gif",
  ".html": "text/html; charset=utf-8",
  ".ico": "image/x-icon",
  ".jpeg": "image/jpeg",
  ".jpg": "image/jpeg",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".map": "application/json; charset=utf-8",
  ".mjs": "application/javascript; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".txt": "text/plain; charset=utf-8",
  ".webmanifest": "application/manifest+json; charset=utf-8",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
};

async function isFile(filePath) {
  try {
    const stats = await fs.stat(filePath);
    return stats.isFile();
  } catch {
    return false;
  }
}

function getContentType(filePath) {
  return contentTypes[path.extname(filePath).toLowerCase()] ?? "application/octet-stream";
}

function buildSafeAssetPath(pathname) {
  const decodedPath = decodeURIComponent(pathname);
  const normalizedRelativePath = path.normalize(decodedPath).replace(/^(\.\.(\/|\\|$))+/, "");
  const trimmedRelativePath = normalizedRelativePath.replace(/^[/\\]+/, "");
  const candidatePath = path.resolve(distDir, trimmedRelativePath || "index.html");

  if (!candidatePath.startsWith(distDir)) {
    return null;
  }

  return candidatePath;
}

async function serveFile(response, filePath, { isHtml = false } = {}) {
  const fileBuffer = await fs.readFile(filePath);

  applySecurityHeaders(response);
  response.writeHead(200, {
    ...response.getHeaders(),
    "Cache-Control": isHtml ? "no-cache" : "public, max-age=31536000, immutable",
    "Content-Type": getContentType(filePath),
  });

  response.end(fileBuffer);
}

export async function tryServeBuiltApp(response, pathname) {
  const candidateFilePath = buildSafeAssetPath(pathname);

  if (!candidateFilePath) {
    return false;
  }

  if (await isFile(candidateFilePath)) {
    await serveFile(response, candidateFilePath, {
      isHtml: candidateFilePath.endsWith(".html"),
    });
    return true;
  }

  if (path.extname(candidateFilePath)) {
    return false;
  }

  const appShellPath = path.join(distDir, "index.html");

  if (!(await isFile(appShellPath))) {
    return false;
  }

  await serveFile(response, appShellPath, { isHtml: true });
  return true;
}
