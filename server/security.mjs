import crypto from "node:crypto";

export function nowIso() {
  return new Date().toISOString();
}

export function createId() {
  return crypto.randomUUID();
}

export function createNumericCode(size = 6) {
  let code = "";

  while (code.length < size) {
    code += crypto.randomInt(0, 10).toString();
  }

  return code.slice(0, size);
}

export function createPasswordHash(password) {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

export function verifyPassword(password, passwordHash) {
  const [salt, expectedHash] = passwordHash.split(":");

  if (!salt || !expectedHash) {
    return false;
  }

  const actualHash = crypto.scryptSync(password, salt, 64).toString("hex");
  return crypto.timingSafeEqual(
    Buffer.from(actualHash, "hex"),
    Buffer.from(expectedHash, "hex")
  );
}

export function hashCode(code) {
  return crypto.createHash("sha256").update(code).digest("hex");
}

export function createSessionToken() {
  return crypto.randomBytes(32).toString("hex");
}
