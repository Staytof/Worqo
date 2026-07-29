import { HttpError } from "./utils.mjs";

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const isoBirthDateRegex = /^\d{4}-\d{2}-\d{2}$/;

function parseBirthDate(value) {
  const birthDate = String(value ?? "").trim();

  if (!isoBirthDateRegex.test(birthDate)) {
    throw new HttpError(400, "Informe uma data de nascimento valida.");
  }

  const [yearRaw, monthRaw, dayRaw] = birthDate.split("-");
  const year = Number(yearRaw);
  const month = Number(monthRaw);
  const day = Number(dayRaw);
  const date = new Date(Date.UTC(year, month - 1, day));

  if (
    Number.isNaN(date.getTime()) ||
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    throw new HttpError(400, "Informe uma data de nascimento valida.");
  }

  return { year, month, day };
}

function ensureAdultBirthDate(value) {
  const { year, month, day } = parseBirthDate(value);
  const today = new Date();
  let age = today.getFullYear() - year;
  const currentMonth = today.getMonth() + 1;
  const currentDay = today.getDate();

  if (currentMonth < month || (currentMonth === month && currentDay < day)) {
    age -= 1;
  }

  if (age < 18) {
    throw new HttpError(400, "O cadastro exige idade mínima de 18 anos.");
  }
}

export function validateIdentityBirthDate(value) {
  ensureAdultBirthDate(value);
  return String(value ?? "").trim();
}

export function normalizeEmail(value) {
  return String(value ?? "").trim().toLowerCase();
}

export function normalizePhone(value) {
  const digits = String(value ?? "").replace(/\D/g, "");

  if (digits.length === 10 || digits.length === 11) {
    return `+55${digits}`;
  }

  if (digits.length === 12 || digits.length === 13) {
    return `+${digits}`;
  }

  throw new HttpError(400, "Telefone inválido. Informe um número real com DDD.");
}

export function validateRegistrationInput(payload, options = {}) {
  const requireIdentity = options.requireIdentity !== false;

  if (requireIdentity && !payload.fullName?.trim()) {
    throw new HttpError(400, "Informe o nome completo.");
  }

  const email = normalizeEmail(payload.email ?? "");
  const confirmEmail = normalizeEmail(payload.confirmEmail ?? "");

  if (!emailRegex.test(email)) {
    throw new HttpError(400, "Informe um e-mail válido.");
  }

  if (!confirmEmail) {
    throw new HttpError(400, "Confirme o e-mail.");
  }

  if (email !== confirmEmail) {
    throw new HttpError(400, "Os e-mails informados não coincidem.");
  }

  if (requireIdentity) {
    normalizePhone(payload.phone ?? "");
  }

  if (requireIdentity && !payload.birthDate) {
    throw new HttpError(400, "Informe a data de nascimento.");
  }

  if (requireIdentity) {
    ensureAdultBirthDate(payload.birthDate);
  }

  if (!payload.password || payload.password.length < 6) {
    throw new HttpError(400, "A senha deve ter pelo menos 6 caracteres.");
  }
}

export function validateVerificationCode(code) {
  if (!/^\d{6}$/.test(code ?? "")) {
    throw new HttpError(400, "Informe o código de 6 dígitos.");
  }
}

