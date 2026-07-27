export const CHAT_EXTERNAL_CONTACT_WARNING =
  "Não envie mensagens sobre contato externo ou sua conta será bloqueada automaticamente.";

const LINK_PATTERN =
  /\b(?:https?:\/\/|www\.|[a-z0-9-]+\s*(?:\.|\(ponto\)|\[ponto\]| ponto )\s*(?:com|com\.br|net|org|app|site|blog|info|me|io|co))\b/i;
const EMAIL_PATTERN =
  /\b[a-z0-9._%+-]+\s*(?:@|\(at\)| arroba )\s*[a-z0-9.-]+\s*(?:\.|\(ponto\)|\[ponto\]| ponto )\s*[a-z]{2,}\b/i;
const DIGIT_RUN_PATTERN = /\d(?:[\s().,_-]*\d){7,}/;

function normalizeChatText(value: string) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\barroba\b/g, "@")
    .replace(/\bponto\b/g, ".")
    .replace(/\btraco\b/g, "-")
    .replace(/\bunderscore\b/g, "_")
    .replace(/\s+/g, " ")
    .trim();
}

function hasPhoneLikeSequence(normalized: string) {
  return normalized.replace(/\D/g, "").length >= 8;
}

export function containsExternalContact(value: string) {
  const normalized = normalizeChatText(value);

  if (!normalized) {
    return false;
  }

  if (LINK_PATTERN.test(normalized) || EMAIL_PATTERN.test(normalized)) {
    return true;
  }

  if (DIGIT_RUN_PATTERN.test(normalized) && hasPhoneLikeSequence(normalized)) {
    return true;
  }

  return /\b(?:instagram|telegram|whatsapp|facebook|gmail|hotmail|outlook)\b/i.test(
    normalized
  );
}
