import { config, isCpfVerificationConfigured } from "../config.mjs";
import { arePersonNamesEquivalent, normalizeCpf } from "../cpf-utils.mjs";
import { HttpError } from "../utils.mjs";

function readNestedValue(source, paths) {
  for (const path of paths) {
    let current = source;
    let found = true;

    for (const segment of path) {
      if (!current || typeof current !== "object" || !(segment in current)) {
        found = false;
        break;
      }

      current = current[segment];
    }

    if (found && typeof current === "string" && current.trim()) {
      return current.trim();
    }

    if (found && typeof current === "number") {
      return String(current);
    }
  }

  return "";
}

function normalizeStatus(value) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase();
}

function ensureStatusIsRegular(status) {
  const normalized = normalizeStatus(status);
  const blockedStatusTokens = [
    "NAO REGULAR",
    "PENDENTE",
    "SUSPENSA",
    "SUSPENSO",
    "CANCELADA",
    "CANCELADO",
    "NULA",
    "FALECIDO",
    "OBITO",
  ];

  if (blockedStatusTokens.some((token) => normalized.includes(token))) {
    throw new HttpError(400, "O CPF informado não está regular na Receita Federal.");
  }
}

function ensureNameMatches(fullName, record) {
  const matches =
    arePersonNamesEquivalent(fullName, record.officialName) ||
    arePersonNamesEquivalent(fullName, record.socialName);

  if (!matches) {
    throw new HttpError(
      400,
      "O CPF informado não corresponde ao nome cadastrado nesta conta."
    );
  }

  const verifiedName = record.officialName || record.socialName;

  if (!verifiedName) {
    throw new HttpError(502, "A base oficial não retornou o nome do titular do CPF.");
  }

  return verifiedName;
}

function extractOfficialRecord(payload) {
  const officialName = readNestedValue(payload, [
    ["nome"],
    ["nomeCompleto"],
    ["nome_completo"],
    ["nome_da_pf"],
    ["name"],
    ["titular", "nome"],
    ["dados", "nome"],
    ["data", "nome"],
    ["result", "nome"],
    ["result", "nome_da_pf"],
    ["resposta", "nome"],
  ]);

  const socialName = readNestedValue(payload, [
    ["nomeSocial"],
    ["nome_social"],
    ["dados", "nomeSocial"],
    ["dados", "nome_social"],
    ["data", "nomeSocial"],
    ["data", "nome_social"],
  ]);

  const cpf = readNestedValue(payload, [
    ["cpf"],
    ["numeroCpf"],
    ["numero_cpf"],
    ["numero_de_cpf"],
    ["documento"],
    ["dados", "cpf"],
    ["data", "cpf"],
    ["result", "cpf"],
    ["result", "numero_de_cpf"],
  ]);

  const status = readNestedValue(payload, [
    ["situação"],
    ["situaçãoCadastral"],
    ["situação_cadastral"],
    ["status"],
    ["dados", "situação"],
    ["dados", "situaçãoCadastral"],
    ["data", "situação"],
    ["data", "situaçãoCadastral"],
    ["result", "situação"],
    ["result", "situação_cadastral"],
  ]);

  return {
    cpfDigits: normalizeCpf(cpf),
    officialName,
    socialName,
    status,
  };
}

function buildSerproQueryUrl(cpfDigits) {
  const templaté = config.cpfVerification.serpro.queryUrlTemplaté.trim();

  if (!templaté) {
    throw new HttpError(503, "O provedor oficial de CPF ainda não foi configurado.");
  }

  if (templaté.includes("{cpf}")) {
    return templaté.replaceAll("{cpf}", cpfDigits);
  }

  return `${templaté.replace(/\/$/, "")}/${cpfDigits}`;
}

async function getSerproAccessToken() {
  const { consumerKey, consumerSecret, tokenUrl, scope } = config.cpfVerification.serpro;

  const form = new URLSearchParams({
    grant_type: "client_credentials",
  });

  if (scope) {
    form.set("scope", scope);
  }

  let response;

  try {
    response = await fetch(tokenUrl, {
      method: "POST",
      headers: {
        Accept: "application/json",
        Authorization: `Basic ${Buffer.from(`${consumerKey}:${consumerSecret}`).toString("base64")}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: form,
    });
  } catch {
    throw new HttpError(502, "Não foi possível autenticar no provedor oficial de CPF.");
  }

  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    throw new HttpError(502, "A autenticação no provedor oficial de CPF falhou.");
  }

  const accessToken =
    payload && typeof payload === "object" && "access_token" in payload
      ? payload.access_token
      : null;

  if (typeof accessToken !== "string" || !accessToken) {
    throw new HttpError(502, "O provedor oficial de CPF não retornou um token válido.");
  }

  return accessToken;
}

async function fetchSerproCpfRecord(accessToken, cpfDigits) {
  let response;

  try {
    response = await fetch(buildSerproQueryUrl(cpfDigits), {
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
    });
  } catch {
    throw new HttpError(502, "Não foi possível consultar o CPF no provedor oficial.");
  }

  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    if (response.status === 404) {
      throw new HttpError(400, "O CPF informado não foi encontrado na base oficial.");
    }

    throw new HttpError(502, "A consulta oficial de CPF falhou.");
  }

  if (!payload || typeof payload !== "object") {
    throw new HttpError(502, "O provedor oficial retornou um formato inválido.");
  }

  return extractOfficialRecord(payload);
}

function formatBirthDate(value, format) {
  if (!value) {
    return "";
  }

  const [year, month, day] = String(value).split("-");

  if (!year || !month || !day) {
    return "";
  }

  switch (format) {
    case "yyyy-MM-dd":
      return `${year}-${month}-${day}`;
    case "yyyyMMdd":
      return `${year}${month}${day}`;
    case "dd/MM/yyyy":
    default:
      return `${day}/${month}/${year}`;
  }
}

function buildHubDevParams({ cpfDigits, birthDate }) {
  const hubdev = config.cpfVerification.hubdev;
  const params = new URLSearchParams();

  params.set(hubdev.cpfParam, cpfDigits);
  params.set(hubdev.tokenParam, hubdev.token);

  if (hubdev.requireBirthDate) {
    const formattedBirthDate = formatBirthDate(birthDate, hubdev.birthDateFormat);

    if (!formattedBirthDate) {
      throw new HttpError(
        400,
        "A conta precisa ter data de nascimento valida para consultar o CPF no HubDev."
      );
    }

    params.set(hubdev.birthDateParam, formattedBirthDate);
  }

  if (hubdev.ignoreDb) {
    params.set("ignore_db", "1");
  }

  if (hubdev.turbo) {
    params.set("turbo", "1");
  }

  return params;
}

function mapHubDevError(message) {
  const normalized = normalizeStatus(message);

  if (normalized.includes("TOKEN INVALIDO") || normalized.includes("TOKEN BLOQUEADO")) {
    return new HttpError(503, message);
  }

  if (
    normalized.includes("IP DE ORIGEM NAO IDENTIFICADO") ||
    normalized.includes("IP DE ORIGEM NAO PERMITIDO")
  ) {
    return new HttpError(503, message);
  }

  if (
    normalized.includes("CPF INVALIDO") ||
    normalized.includes("DATA NASCIMENTO INVALIDA") ||
    normalized.includes("PARAMETRO INVALIDO")
  ) {
    return new HttpError(400, message);
  }

  if (normalized.includes("LIMITE EXCEDIDO")) {
    return new HttpError(429, message);
  }

  if (
    normalized.includes("TIMEOUT") ||
    normalized.includes("CONSULTA NAO RETORNOU") ||
    normalized.includes("NAO FOI POSSIVEL")
  ) {
    return new HttpError(502, message);
  }

  return new HttpError(502, message || "A consulta de CPF no HubDev falhou.");
}

async function fetchHubDevCpfRecord({ cpfDigits, birthDate }) {
  const hubdev = config.cpfVerification.hubdev;
  const params = buildHubDevParams({ cpfDigits, birthDate });
  const requestUrl = `${hubdev.queryUrl.replace(/\/$/, "")}/?${params.toString()}`;
  const requestInit =
    hubdev.method === "POST"
      ? {
          method: "POST",
          headers: {
            Accept: "application/json",
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body: params,
          signal: AbortSignal.timeout(hubdev.timeoutMs),
        }
      : {
          method: "GET",
          headers: {
            Accept: "application/json",
          },
          signal: AbortSignal.timeout(hubdev.timeoutMs),
        };

  let response;

  try {
    response = await fetch(hubdev.method === "POST" ? hubdev.queryUrl : requestUrl, requestInit);
  } catch (error) {
    if (error instanceof Error && error.name === "TimeoutError") {
      throw new HttpError(
        504,
        hubdev.turbo
          ? "A consulta turbo do HubDev excedeu o tempo limite."
          : "A consulta do HubDev excedeu o tempo limite."
      );
    }

    throw new HttpError(502, "Não foi possível consultar o CPF no HubDev.");
  }

  const payload = await response.json().catch(() => null);
  const message = readNestedValue(payload, [["message"], ["mensagem"], ["error"], ["erro"]]);
  const returnCode = normalizeStatus(readNestedValue(payload, [["return"]]));

  if (!response.ok) {
    throw mapHubDevError(message || "A consulta de CPF no HubDev falhou.");
  }

  if (!payload || typeof payload !== "object") {
    throw new HttpError(502, "O HubDev retornou um formato inválido.");
  }

  if (returnCode === "NOK" || payload.status === false) {
    throw mapHubDevError(message);
  }

  if (returnCode && returnCode !== "OK") {
    throw mapHubDevError(message || "A consulta de CPF no HubDev falhou.");
  }

  const record = extractOfficialRecord(payload);

  if (!record.officialName && !record.socialName) {
    throw new HttpError(502, "O HubDev não retornou o nome vinculado ao CPF.");
  }

  return record;
}

async function verifyWithSerpro({ cpfDigits, fullName }) {
  const accessToken = await getSerproAccessToken();
  const record = await fetchSerproCpfRecord(accessToken, cpfDigits);

  if (record.cpfDigits && record.cpfDigits !== cpfDigits) {
    throw new HttpError(502, "O provedor oficial retornou um CPF divergente.");
  }

  ensureStatusIsRegular(record.status);
  const verifiedName = ensureNameMatches(fullName, record);

  return {
    provider: "serpro",
    verifiedAt: new Date().toISOString(),
    verifiedName,
  };
}

async function verifyWithHubDev({ cpfDigits, birthDate, fullName }) {
  const record = await fetchHubDevCpfRecord({
    cpfDigits,
    birthDate,
  });

  if (record.cpfDigits && record.cpfDigits !== cpfDigits) {
    throw new HttpError(502, "O HubDev retornou um CPF divergente.");
  }

  ensureStatusIsRegular(record.status);
  const verifiedName = ensureNameMatches(fullName, record);

  return {
    provider: "hubdev",
    verifiedAt: new Date().toISOString(),
    verifiedName,
  };
}

export async function verifyOfficialCpf({ cpf, birthDate, fullName }) {
  const cpfDigits = normalizeCpf(cpf);

  if (!isCpfVerificationConfigured()) {
    throw new HttpError(
      503,
      "A verificação oficial de CPF ainda não foi configurada no servidor."
    );
  }

  if (config.cpfVerification.provider === "hubdev") {
    return verifyWithHubDev({
      cpfDigits,
      birthDate,
      fullName,
    });
  }

  if (config.cpfVerification.provider === "serpro") {
    return verifyWithSerpro({
      cpfDigits,
      fullName,
    });
  }

  throw new HttpError(503, "O provedor oficial de CPF configurado não é suportado.");
}

