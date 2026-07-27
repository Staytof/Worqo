export function normalizeCpf(value = "") {
  return String(value).replace(/\D/g, "").slice(0, 11);
}

export function formatCpf(value = "") {
  const digits = normalizeCpf(value);

  return digits
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d{1,2})$/, "$1-$2");
}

export function isValidCpf(value = "") {
  const cpf = normalizeCpf(value);

  if (cpf.length !== 11 || /^(\d)\1+$/.test(cpf)) {
    return false;
  }

  let sum = 0;

  for (let index = 0; index < 9; index += 1) {
    sum += Number(cpf[index]) * (10 - index);
  }

  let remainder = (sum * 10) % 11;

  if (remainder === 10) {
    remainder = 0;
  }

  if (remainder !== Number(cpf[9])) {
    return false;
  }

  sum = 0;

  for (let index = 0; index < 10; index += 1) {
    sum += Number(cpf[index]) * (11 - index);
  }

  remainder = (sum * 10) % 11;

  if (remainder === 10) {
    remainder = 0;
  }

  return remainder === Number(cpf[10]);
}

export function normalizePersonName(value = "") {
  return String(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase();
}

const NAME_PARTICLES = new Set(["DA", "DE", "DI", "DO", "DU", "DAS", "DOS", "E"]);

function getComparableNameTokens(value) {
  return normalizePersonName(value)
    .split(" ")
    .filter(Boolean)
    .filter((token) => !NAME_PARTICLES.has(token));
}

function countSharedTokens(leftTokens, rightTokens) {
  const rightPool = new Map();

  for (const token of rightTokens) {
    rightPool.set(token, (rightPool.get(token) ?? 0) + 1);
  }

  let sharedTokens = 0;

  for (const token of leftTokens) {
    const currentCount = rightPool.get(token) ?? 0;

    if (currentCount <= 0) {
      continue;
    }

    sharedTokens += 1;
    rightPool.set(token, currentCount - 1);
  }

  return sharedTokens;
}

function isTokenSubsequence(shorterTokens, longerTokens) {
  let longerIndex = 0;

  for (const token of shorterTokens) {
    while (longerIndex < longerTokens.length && longerTokens[longerIndex] !== token) {
      longerIndex += 1;
    }

    if (longerIndex >= longerTokens.length) {
      return false;
    }

    longerIndex += 1;
  }

  return true;
}

export function arePersonNamesEquivalent(left, right) {
  const normalizedLeft = normalizePersonName(left);
  const normalizedRight = normalizePersonName(right);

  if (!normalizedLeft || !normalizedRight) {
    return false;
  }

  if (normalizedLeft === normalizedRight) {
    return true;
  }

  const leftTokens = getComparableNameTokens(left);
  const rightTokens = getComparableNameTokens(right);

  if (leftTokens.length === 0 || rightTokens.length === 0) {
    return false;
  }

  if (leftTokens.join(" ") === rightTokens.join(" ")) {
    return true;
  }

  const firstNamesMatch = leftTokens[0] === rightTokens[0];
  const lastNamesMatch = leftTokens[leftTokens.length - 1] === rightTokens[rightTokens.length - 1];

  if (!firstNamesMatch || !lastNamesMatch) {
    return false;
  }

  const sharedTokens = countSharedTokens(leftTokens, rightTokens);
  const minTokenCount = Math.min(leftTokens.length, rightTokens.length);
  const requiredSharedTokens = Math.max(2, Math.ceil(minTokenCount * 0.67));
  const shorterTokens =
    leftTokens.length <= rightTokens.length ? leftTokens : rightTokens;
  const longerTokens =
    leftTokens.length <= rightTokens.length ? rightTokens : leftTokens;

  return (
    sharedTokens >= requiredSharedTokens &&
    isTokenSubsequence(shorterTokens, longerTokens)
  );
}
