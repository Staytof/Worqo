import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const HEALTH_CHECK_TIMEOUT_MS = 1_500;

function readDotEnvValue(name) {
  const envPath = path.join(process.cwd(), ".env");

  if (!fs.existsSync(envPath)) {
    return "";
  }

  const line = fs
    .readFileSync(envPath, "utf8")
    .split(/\r?\n/)
    .find((entry) => entry.trim().startsWith(`${name}=`));

  if (!line) {
    return "";
  }

  return line
    .slice(line.indexOf("=") + 1)
    .trim()
    .replace(/^['"]|['"]$/g, "");
}

function resolveApiPort() {
  return Number(
    process.env.PORT ||
      process.env.API_PORT ||
      readDotEnvValue("PORT") ||
      readDotEnvValue("API_PORT") ||
      3001
  );
}

async function isExistingApiHealthy(port) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), HEALTH_CHECK_TIMEOUT_MS);

  try {
    const response = await fetch(`http://127.0.0.1:${port}/api/health`, {
      cache: "no-store",
      signal: controller.signal,
    });
    const data = await response.json().catch(() => null);

    return response.ok && data?.ok === true && data?.service === "worqo-auth";
  } catch {
    return false;
  } finally {
    clearTimeout(timeoutId);
  }
}

function resolveScriptName(scriptName) {
  if (process.platform === "win32" && scriptName === "dev:server") {
    return "start:server";
  }

  return scriptName;
}

function createCommand(scriptName) {
  const resolvedScriptName = resolveScriptName(scriptName);

  if (process.platform === "win32") {
    const command = process.env.ComSpec || "cmd.exe";
    return {
      command,
      args: ["/d", "/s", "/c", `npm run ${resolvedScriptName}`],
    };
  }

  return {
    command: "npm",
    args: ["run", resolvedScriptName],
  };
}

function startProcess(scriptName) {
  const { command, args } = createCommand(scriptName);

  const child = spawn(command, args, {
    cwd: process.cwd(),
    stdio: ["ignore", "inherit", "inherit"],
    shell: false,
  });

  child.on("error", (error) => {
    console.error(`Falha ao iniciar ${scriptName}:`, error);
    shutdown(1);
  });

  return child;
}

const processes = [];

function shutdown(code = 0) {
  for (const child of processes) {
    if (!child.killed) {
      child.kill();
    }
  }

  process.exit(code);
}

process.on("SIGINT", () => shutdown(0));
process.on("SIGTERM", () => shutdown(0));

const apiPort = resolveApiPort();

if (await isExistingApiHealthy(apiPort)) {
  console.log(`Worko auth API já está disponível em http://localhost:${apiPort}. Reaproveitando esta instância.`);
} else {
  processes.push(startProcess("dev:server"));
}

processes.push(startProcess("dev:client"));

for (const child of processes) {
  child.on("exit", (code) => {
    if (code && code !== 0) {
      shutdown(code);
    }
  });
}
