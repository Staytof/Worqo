import { db } from "./db.mjs";
import {
  formatCpf,
  isValidCpf,
  normalizeCpf,
} from "./cpf-utils.mjs";
import { verifyOfficialCpf } from "./providers/cpf-provider.mjs";
import {
  createId,
  createNumericCode,
  createPasswordHash,
  createSessionToken,
  hashCode,
  nowIso,
  verifyPassword,
} from "./security.mjs";
import {
  sendEmailVerification,
  sendNewDeviceLoginEmail,
  sendPasswordResetEmail,
} from "./providers/email-provider.mjs";
import { config, isAdminEmail } from "./config.mjs";
import {
  normalizeEmail,
  normalizePhone,
  validateIdentityBirthDate,
  validatePassword,
  validateRegistrationInput,
  validateVerificationCode,
} from "./validators.mjs";
import { HttpError } from "./utils.mjs";
import { createUserNotification } from "./notifications.mjs";

const defaultSessionDurationMs = 1000 * 60 * 60 * 24 * 30;
const rememberedSessionDurationMs = 1000 * 60 * 60 * 24 * 365;
const verificationCodeDurationMs = 1000 * 60 * 10;
const securityChallengeDurationMs = 1000 * 60 * 10;
const securityChallengeMaxAttempts = 5;
const securityChallengeResendWindowMs = 30_000;
const oauthStateDurationMs = 1000 * 60 * 10;
const oauthExchangeDurationMs = 1000 * 60 * 2;
const userActivityTouchWindowMs = 1000 * 60;
const providerVerificationStatuses = new Set([
  "not_required",
  "pending_documents",
  "under_review",
  "changes_requested",
  "approved",
  "rejected",
]);
const providerVerificationSubmissionStatuses = new Set([
  "pending_documents",
  "changes_requested",
]);
const providerVerificationImagePattern = /^data:image\/(?:jpeg|png|webp);base64,[a-z0-9+/=\s]+$/i;
const providerVerificationImageMaxLength = 3_000_000;
const countCompletedServicesForUserStatement = db.prepare(
  `
    SELECT COUNT(*) AS total
    FROM service_requests
    WHERE status = 'completed' AND (requester_user_id = ? OR worker_user_id = ?)
  `
);
const countOutstandingWalletEntriesForAccountDeletionStatement = db.prepare(
  `
    SELECT COUNT(*) AS total
    FROM service_requests
    LEFT JOIN worker_withdrawals ON worker_withdrawals.id = service_requests.worker_withdrawal_id
    WHERE service_requests.worker_user_id = ?
      AND service_requests.asaas_payment_status IN ('RECEIVED', 'CONFIRMED')
      AND (
        service_requests.worker_withdrawal_id IS NULL
        OR COALESCE(worker_withdrawals.status, '') <> 'DONE'
      )
  `
);
const reviewSummaryByUserStatement = db.prepare(
  `
    SELECT
      COUNT(*) AS total_reviews,
      ROUND(AVG(rating), 1) AS average_rating
    FROM service_reviews
    WHERE target_user_id = ?
  `
);
const recentReviewsByUserStatement = db.prepare(
  `
    SELECT
      service_reviews.id,
      service_reviews.rating,
      service_reviews.comment,
      service_reviews.reviewer_user_id,
      reviewer.full_name AS reviewer_name,
      reviewer.avatar AS reviewer_avatar,
      service_requests.category AS service_category,
      service_requests.description AS service_description,
      service_requests.service_details_json,
      service_reviews.created_at
    FROM service_reviews
    INNER JOIN users AS reviewer ON reviewer.id = service_reviews.reviewer_user_id
    LEFT JOIN service_requests ON service_requests.id = service_reviews.service_request_id
    WHERE service_reviews.target_user_id = ?
    ORDER BY service_reviews.created_at DESC
    LIMIT 5
  `
);

function mapReviewRow(row) {
  let serviceTitle = row.service_description ?? "";

  try {
    const details = JSON.parse(row.service_details_json ?? "null");
    if (details && typeof details.title === "string" && details.title.trim()) {
      serviceTitle = details.title.trim();
    }
  } catch {
    serviceTitle = row.service_description ?? "";
  }

  return {
    id: row.id,
    rating: Number(row.rating) || 0,
    comment: row.comment ?? "",
    reviewerId: row.reviewer_user_id,
    reviewerName: row.reviewer_name ?? "Cliente",
    reviewerAvatar: row.reviewer_avatar ?? null,
    serviceTitle: serviceTitle || row.service_category || "Atendimento Worko",
    createdAt: row.created_at ?? "",
  };
}

function getUserReviewMeta(userId) {
  const summary = reviewSummaryByUserStatement.get(userId);
  const recentReviews = recentReviewsByUserStatement.all(userId).map(mapReviewRow);
  const reviewsCount = Number(summary?.total_reviews) || 0;

  return {
    averageRating:
      reviewsCount > 0 && Number.isFinite(Number(summary?.average_rating))
        ? Number(summary.average_rating)
        : null,
    reviewsCount,
    recentReviews,
  };
}

function parseStoredList(value) {
  try {
    const parsed = JSON.parse(value ?? "[]");

    return Array.isArray(parsed)
      ? parsed
          .map((item) => String(item ?? "").trim())
          .filter(Boolean)
      : [];
  } catch {
    return [];
  }
}

function resolveProviderVerificationStatus(row, accountKind, isAdmin) {
  if (isAdmin || accountKind !== "provider") {
    return "not_required";
  }

  const status = String(row.provider_verification_status ?? "").trim();

  return providerVerificationStatuses.has(status) && status !== "not_required"
    ? status
    : "pending_documents";
}

function normalizeProviderVerificationImage(value, label) {
  const normalized = String(value ?? "").trim();

  if (!normalized || !providerVerificationImagePattern.test(normalized)) {
    throw new HttpError(400, `Envie uma imagem vÃ¡lida para ${label}.`);
  }

  if (normalized.length > providerVerificationImageMaxLength) {
    throw new HttpError(400, `${label} ficou muito grande. Envie uma imagem com atÃ© 2 MB.`);
  }

  return normalized;
}

function normalizeProviderRgNumber(value) {
  const normalized = String(value ?? "")
    .trim()
    .replace(/[^a-zA-Z0-9.-]/g, "")
    .slice(0, 20);

  if (normalized.length < 5) {
    throw new HttpError(400, "Informe um nÃºmero de RG vÃ¡lido.");
  }

  return normalized;
}

function normalizeProfileList(value, fallback, maxItems = 12) {
  if (!Array.isArray(value)) {
    return fallback;
  }

  return JSON.stringify(
    Array.from(
      new Set(
        value
          .map((item) => String(item ?? "").trim())
          .filter(Boolean)
      )
    ).slice(0, maxItems)
  );
}

function normalizePixKeyType(value) {
  const normalizedValue = String(value ?? "")
    .trim()
    .toUpperCase();

  if (!normalizedValue) {
    return null;
  }

  if (normalizedValue !== "CPF") {
    throw new HttpError(400, "A chave Pix para saque precisa ser um CPF válido.");
  }

  return normalizedValue;
}

function normalizePixKeyValue(keyType, value) {
  const normalizedValue = String(value ?? "").trim();

  if (!keyType) {
    return "";
  }

  if (!normalizedValue) {
    throw new HttpError(400, "Informe a chave Pix antes de salvar.");
  }

  if (keyType === "CPF") {
    const digits = normalizeCpf(normalizedValue);

    if (!isValidCpf(digits)) {
      throw new HttpError(400, "A chave Pix em CPF está inválida.");
    }

    return digits;
  }

  if (keyType === "CNPJ") {
    const digits = normalizedValue.replace(/\D/g, "");

    if (digits.length !== 14) {
      throw new HttpError(400, "A chave Pix em CNPJ precisa ter 14 dígitos.");
    }

    return digits;
  }

  if (keyType === "EMAIL") {
    const email = normalizeEmail(normalizedValue);

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      throw new HttpError(400, "Informe um e-mail válido para a chave Pix.");
    }

    return email;
  }

  if (keyType === "PHONE") {
    return normalizePhone(normalizedValue);
  }

  if (keyType === "EVP") {
    if (normalizedValue.length < 8 || normalizedValue.length > 77) {
      throw new HttpError(400, "A chave aleatoria Pix parece inválida.");
    }

    return normalizedValue;
  }

  return normalizedValue;
}

function ensureCurrentLegalVersion(legalVersion) {
  const normalizedVersion = String(legalVersion ?? "").trim();

  if (!normalizedVersion) {
    throw new HttpError(
      400,
      "Aceite os Termos de Uso e o Aviso de Privacidade para continuar."
    );
  }

  return normalizedVersion;
}

function mapUser(row) {
  if (!row) {
    return null;
  }

  const isAdmin = isAdminEmail(row.email);
  const storedAccountKind =
    row.account_kind === "client" || row.account_kind === "provider" ? row.account_kind : null;
  const accountKind =
    storedAccountKind ?? (isAdmin || row.profile_setup_completed_at ? "provider" : null);
  const providerVerificationStatus = resolveProviderVerificationStatus(row, accountKind, isAdmin);
  const completedServicesCount =
    countCompletedServicesForUserStatement.get(row.id, row.id)?.total ?? 0;
  const reviewMeta = getUserReviewMeta(row.id);

  return {
    id: row.id,
    fullName: row.full_name,
    email: row.email,
    accountKind,
    phone: isAdmin ? "" : row.phone,
    birthDate: row.birth_date,
    avatar: row.avatar,
    headline: row.headline ?? "",
    bio: row.bio ?? "",
    professions: parseStoredList(row.professions_json),
    skills: parseStoredList(row.skills_json),
    availabilityNote: row.availability_note ?? "",
    cpf: row.cpf ?? "",
    address: row.address ?? "",
    certificates: parseStoredList(row.certificates_json),
    isAccountVerified: Boolean(row.verified_channel),
    isCpfVerified: Boolean(row.cpf_verified_at && row.cpf_digits),
    cpfVerifiedAt: row.cpf_verified_at ?? null,
    cpfVerificationProvider: row.cpf_verification_provider ?? null,
    termsAcceptedAt: row.terms_accepted_at ?? null,
    privacyAcceptedAt: row.privacy_accepted_at ?? null,
    legalAcceptedVersion: row.legal_version ?? null,
    verifiedChannel: row.verified_channel === "email" ? "email" : null,
    emailVerifiedAt: row.email_verified_at ?? null,
    hasCompletedProfileSetup: isAdmin || Boolean(row.profile_setup_completed_at),
    providerVerificationStatus,
    providerVerificationSubmittedAt: row.provider_verification_submitted_at ?? null,
    providerVerificationRequestedReason: row.provider_verification_requested_reason ?? null,
    providerVerificationDecisionNote: row.provider_verification_decision_note ?? null,
    providerVerificationDocumentVersion: Number(row.provider_verification_document_version) || 0,
    providerVerificationHasDocuments: Boolean(
      row.provider_face_image && row.provider_rg_document_image && row.provider_rg_number
    ),
    pixKeyType: row.pix_withdrawal_key_type ?? null,
    pixKey: row.pix_withdrawal_key ?? "",
    hasPixKeyConfigured: Boolean(row.pix_withdrawal_key_type && row.pix_withdrawal_key),
    canReceivePixTransfers:
      row.pix_withdrawal_key_type === "CPF" &&
      Boolean(row.pix_withdrawal_key && row.cpf_digits && row.pix_withdrawal_key === row.cpf_digits),
    isAdmin,
    isSuspended: Boolean(row.suspended_at),
    suspendedAt: row.suspended_at ?? null,
    suspensionReason: row.suspension_reason ?? null,
    identityLockedAt: row.identity_locked_at ?? null,
    completedServicesCount: Number(completedServicesCount) || 0,
    averageRating: reviewMeta.averageRating,
    reviewsCount: reviewMeta.reviewsCount,
    recentReviews: reviewMeta.recentReviews,
    appTourCompletedAt: row.app_tour_completed_at ?? null,
    createdAt: row.created_at ?? "",
  };
}

function normalizeAccountKind(value) {
  const normalized = String(value ?? "").trim().toLowerCase();

  if (normalized === "client" || normalized === "cliente") {
    return "client";
  }

  if (normalized === "provider" || normalized === "prestador") {
    return "provider";
  }

  return null;
}

function mapPublicUser(row) {
  if (!row) {
    return null;
  }

  const completedServicesCount =
    countCompletedServicesForUserStatement.get(row.id, row.id)?.total ?? 0;
  const reviewMeta = getUserReviewMeta(row.id);

  return {
    id: row.id,
    fullName: row.full_name,
    accountKind:
      row.account_kind === "client" || row.account_kind === "provider"
        ? row.account_kind
        : null,
    avatar: row.avatar,
    headline: row.headline ?? "",
    bio: row.bio ?? "",
    professions: parseStoredList(row.professions_json),
    skills: parseStoredList(row.skills_json),
    availabilityNote: row.availability_note ?? "",
    certificates: parseStoredList(row.certificates_json),
    isAccountVerified: Boolean(row.verified_channel),
    isCpfVerified: Boolean(row.cpf_verified_at && row.cpf_digits),
    completedServicesCount: Number(completedServicesCount) || 0,
    averageRating: reviewMeta.averageRating,
    reviewsCount: reviewMeta.reviewsCount,
    recentReviews: reviewMeta.recentReviews,
    createdAt: row.created_at ?? "",
  };
}

function getUserById(userId) {
  return db.prepare("SELECT * FROM users WHERE id = ?").get(userId);
}

function getUserByEmail(email) {
  return db.prepare("SELECT * FROM users WHERE email = ?").get(email);
}

function getUserByGoogleSubject(googleSubject) {
  return db.prepare("SELECT * FROM users WHERE google_subject = ?").get(googleSubject);
}

function getUserByPhone(phone) {
  return db.prepare("SELECT * FROM users WHERE phone = ?").get(phone);
}

function getUserByCpfDigits(cpfDigits) {
  return db.prepare("SELECT * FROM users WHERE cpf_digits = ?").get(cpfDigits);
}

function assertUserIsActive(user) {
  if (user?.deleted_at) {
    throw new HttpError(410, "Esta conta foi excluída a pedido do(a) usuário(a).");
  }
}

const touchUserActivityStatement = db.prepare(
  `
    UPDATE users
    SET last_active_at = ?, updated_at = ?
    WHERE id = ?
  `
);

function revokePendingCodes(userId, channel) {
  db.prepare(
    `
      UPDATE verification_codes
      SET consumed_at = ?
      WHERE user_id = ? AND channel = ? AND consumed_at IS NULL
    `
  ).run(nowIso(), userId, channel);
}

async function dispatchEmailVerification({ code, fullName, destination }) {
  return sendEmailVerification({
    code,
    email: destination,
    fullName,
  });
}

function createLocalVerificationCode({ channel, destination, userId }) {
  revokePendingCodes(userId, channel);

  const code = createNumericCode();
  const expiresAt = new Date(Date.now() + verificationCodeDurationMs).toISOString();

  db.prepare(
    `
      INSERT INTO verification_codes (
        id, user_id, channel, destination, code_hash, expires_at, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `
  ).run(
    createId(),
    userId,
    channel,
    destination,
    hashCode(code),
    expiresAt,
    nowIso()
  );

  return code;
}

async function dispatchVerification({ channel, fullName, destination, userId }) {
  const code = createLocalVerificationCode({
    channel,
    destination,
    userId,
  });

  const delivery = await dispatchEmailVerification({
    code,
    fullName,
    destination,
  });

  return {
    ...delivery,
    debugCode: delivery.provider.startsWith("mock") ? code : null,
  };
}

function normalizeSessionText(value, maxLength = 160) {
  return String(value ?? "").trim().slice(0, maxLength);
}

function normalizeDeviceMetadata(options = {}) {
  const timezone = normalizeSessionText(options.timezone, 100);
  const timezoneLocations = {
    "America/Sao_Paulo": "São Paulo, Brasil",
    "America/Fortaleza": "Fortaleza, Brasil",
    "America/Manaus": "Manaus, Brasil",
    "America/Recife": "Recife, Brasil",
    "America/Bahia": "Salvador, Brasil",
    "America/Belem": "Belém, Brasil",
    "America/Cuiaba": "Cuiabá, Brasil",
    "America/Porto_Velho": "Porto Velho, Brasil",
    "America/Rio_Branco": "Rio Branco, Brasil",
  };

  return {
    deviceId: normalizeSessionText(options.deviceId, 160),
    deviceLabel: normalizeSessionText(options.deviceLabel, 160) || "Novo dispositivo",
    devicePlatform: normalizeSessionText(options.devicePlatform, 40) || "unknown",
    timezone,
    loginIp: normalizeSessionText(options.loginIp, 100),
    loginLocation:
      normalizeSessionText(options.loginLocation, 180) ||
      timezoneLocations[timezone] ||
      "Localização aproximada indisponível",
  };
}

function maskEmail(email) {
  const [localPart = "", domain = ""] = String(email ?? "").split("@");
  const visible = localPart.slice(0, Math.min(2, localPart.length));
  const hiddenLength = Math.max(3, localPart.length - visible.length);
  return `${visible}${"*".repeat(hiddenLength)}@${domain}`;
}

function isTrustedLoginDevice(userId, deviceId) {
  const normalizedDeviceId = normalizeSessionText(deviceId, 160);

  if (!normalizedDeviceId) {
    return false;
  }

  return Boolean(
    db
      .prepare(
        `
          SELECT id
          FROM trusted_login_devices
          WHERE user_id = ? AND device_id = ?
          LIMIT 1
        `
      )
      .get(userId, normalizedDeviceId)
  );
}

function trustLoginDevice(userId, device, timestamp = nowIso()) {
  if (!device.deviceId) {
    return;
  }

  db.prepare(
    `
      INSERT INTO trusted_login_devices (
        id,
        user_id,
        device_id,
        device_label,
        device_platform,
        first_verified_at,
        last_verified_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(user_id, device_id) DO UPDATE SET
        device_label = excluded.device_label,
        device_platform = excluded.device_platform,
        last_verified_at = excluded.last_verified_at
    `
  ).run(
    createId(),
    userId,
    device.deviceId,
    device.deviceLabel,
    device.devicePlatform,
    timestamp,
    timestamp
  );
}

function formatSecurityLoginDate(timestamp, timezone) {
  try {
    return new Intl.DateTimeFormat("pt-BR", {
      dateStyle: "short",
      timeStyle: "short",
      timeZone: timezone || "America/Sao_Paulo",
    }).format(new Date(timestamp));
  } catch {
    return new Intl.DateTimeFormat("pt-BR", {
      dateStyle: "short",
      timeStyle: "short",
    }).format(new Date(timestamp));
  }
}

function createSession(userId, { rememberMe = false, ...deviceOptions } = {}) {
  const token = createSessionToken();
  const tokenHash = hashCode(token);
  const now = Date.now();
  const timestamp = nowIso();
  const device = normalizeDeviceMetadata(deviceOptions);
  const expiresAt = new Date(
    now + (rememberMe ? rememberedSessionDurationMs : defaultSessionDurationMs)
  ).toISOString();
  const activeSessions = db
    .prepare(
      `
        SELECT *
        FROM sessions
        WHERE user_id = ? AND revoked_at IS NULL AND expires_at > ?
        ORDER BY created_at DESC
      `
    )
    .all(userId, timestamp);
  const previousSession = activeSessions[0] ?? null;
  const isDifferentDevice =
    Boolean(previousSession) &&
    (!previousSession.device_id ||
      !device.deviceId ||
      previousSession.device_id !== device.deviceId);

  if (isDifferentDevice) {
    const formattedDate = formatSecurityLoginDate(timestamp, device.timezone);

    createUserNotification(
      userId,
      "security-device-change",
      `Sua conta foi acessada em ${device.deviceLabel}, em ${device.loginLocation}, em ${formattedDate}. A sessão anterior foi encerrada por segurança.`,
      {
        title: "Acesso em outro aparelho",
        deviceLabel: device.deviceLabel,
        devicePlatform: device.devicePlatform,
        loginLocation: device.loginLocation,
        loginIp: device.loginIp,
        replacedAt: timestamp,
        path: "/app/notifications",
      }
    );
  }

  db.prepare(
    `
      UPDATE sessions
      SET
        revoked_at = ?,
        revoked_reason = 'device-replaced',
        replaced_device_label = ?,
        replaced_login_location = ?,
        replaced_at = ?
      WHERE user_id = ? AND revoked_at IS NULL
    `
  ).run(
    timestamp,
    device.deviceLabel,
    device.loginLocation,
    timestamp,
    userId
  );

  db.prepare(
    `
      INSERT INTO sessions (
        id,
        user_id,
        token_hash,
        expires_at,
        created_at,
        device_id,
        device_label,
        device_platform,
        login_ip,
        login_location
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `
  ).run(
    createId(),
    userId,
    tokenHash,
    expiresAt,
    timestamp,
    device.deviceId,
    device.deviceLabel,
    device.devicePlatform,
    device.loginIp,
    device.loginLocation
  );

  trustLoginDevice(userId, device, timestamp);

  return token;
}

async function createDeviceLoginChallenge(user, { rememberMe = false, ...deviceOptions } = {}) {
  const device = normalizeDeviceMetadata(deviceOptions);
  const latestChallenge = db
    .prepare(
      `
        SELECT created_at
        FROM device_login_challenges
        WHERE user_id = ? AND consumed_at IS NULL
        ORDER BY created_at DESC
        LIMIT 1
      `
    )
    .get(user.id);

  if (
    latestChallenge &&
    Date.now() - new Date(latestChallenge.created_at).getTime() < securityChallengeResendWindowMs
  ) {
    throw new HttpError(
      429,
      "Um código já foi enviado. Aguarde alguns segundos antes de tentar novamente."
    );
  }

  const timestamp = nowIso();
  const challengeId = createId();
  const code = createNumericCode();
  const expiresAt = new Date(Date.now() + securityChallengeDurationMs).toISOString();

  db.prepare(
    `
      UPDATE device_login_challenges
      SET consumed_at = ?
      WHERE user_id = ? AND consumed_at IS NULL
    `
  ).run(timestamp, user.id);

  db.prepare(
    `
      INSERT INTO device_login_challenges (
        id,
        user_id,
        code_hash,
        remember_me,
        device_id,
        device_label,
        device_platform,
        timezone,
        login_ip,
        login_location,
        expires_at,
        created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `
  ).run(
    challengeId,
    user.id,
    hashCode(code),
    rememberMe ? 1 : 0,
    device.deviceId,
    device.deviceLabel,
    device.devicePlatform,
    device.timezone,
    device.loginIp,
    device.loginLocation,
    expiresAt,
    timestamp
  );

  let delivery;

  try {
    delivery = await sendNewDeviceLoginEmail({
      code,
      email: user.email,
      fullName: user.full_name,
      deviceLabel: device.deviceLabel,
      loginLocation: device.loginLocation,
      requestedAt: formatSecurityLoginDate(timestamp, device.timezone),
    });
  } catch (error) {
    db.prepare(
      "UPDATE device_login_challenges SET consumed_at = ? WHERE id = ?"
    ).run(nowIso(), challengeId);
    throw error;
  }

  return {
    challengeId,
    email: user.email,
    maskedEmail: maskEmail(user.email),
    deviceLabel: device.deviceLabel,
    loginLocation: device.loginLocation,
    expiresAt,
    debugCode: delivery.provider.startsWith("mock") ? code : null,
  };
}

async function prepareAuthenticatedLogin(user, options = {}) {
  const device = normalizeDeviceMetadata(options);
  const normalizedUserEmail = normalizeEmail(user.email);
  const isDeviceVerificationExempt = config.deviceVerificationExemptEmails.includes(
    normalizedUserEmail
  );

  if (isDeviceVerificationExempt || isTrustedLoginDevice(user.id, device.deviceId)) {
    return {
      token: createSession(user.id, options),
      user: mapUser(user),
    };
  }

  return {
    token: null,
    user: null,
    requiresDeviceVerification: true,
    pendingDeviceVerification: await createDeviceLoginChallenge(user, options),
  };
}

function buildDeletedUserEmail(userId) {
  return `deleted-${userId}@deleted.worqo.invalid`;
}

function buildDeletedUserPhone(userId) {
  return `deleted:${String(userId).slice(0, 48)}`;
}

const anonymizeServiceChatMessagesStatement = db.prepare(
  `
    UPDATE service_chat_messages
    SET body = 'Mensagem removida por solicitação de exclusão de conta.'
    WHERE sender_user_id = ?
  `
);
const anonymizeCommunityChatMessagesStatement = db.prepare(
  `
    UPDATE community_post_chat_messages
    SET body = 'Mensagem removida por solicitação de exclusão de conta.'
    WHERE sender_user_id = ?
  `
);
const deleteCommunityContactChatMessagesStatement = db.prepare(
  `
    DELETE FROM community_post_chat_messages
    WHERE chat_id IN (
      SELECT id FROM community_post_chats WHERE contact_user_id = ?
    )
  `
);
const deleteCommunityContactChatsStatement = db.prepare(
  "DELETE FROM community_post_chats WHERE contact_user_id = ?"
);
const deleteUserCommunityPostsStatement = db.prepare(
  "DELETE FROM community_posts WHERE author_user_id = ?"
);
const deleteUserSupportTicketsStatement = db.prepare(
  "DELETE FROM support_tickets WHERE requester_user_id = ?"
);
const deleteUserPushDevicesStatement = db.prepare(
  "DELETE FROM user_push_devices WHERE user_id = ?"
);
const deleteUserNotificationsStatement = db.prepare(
  "DELETE FROM user_notifications WHERE user_id = ?"
);
const deleteUserVerificationCodesStatement = db.prepare(
  "DELETE FROM verification_codes WHERE user_id = ?"
);
const deleteUserPasswordResetChallengesStatement = db.prepare(
  "DELETE FROM password_reset_challenges WHERE user_id = ?"
);
const deleteUserDeviceLoginChallengesStatement = db.prepare(
  "DELETE FROM device_login_challenges WHERE user_id = ?"
);
const deleteUserTrustedLoginDevicesStatement = db.prepare(
  "DELETE FROM trusted_login_devices WHERE user_id = ?"
);
const blockAccountEmailStatement = db.prepare(
  `
    INSERT INTO blocked_account_emails (email, user_id, reason, created_at)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(email) DO UPDATE SET
      user_id = excluded.user_id,
      reason = excluded.reason
  `
);
const revokeUserSessionsStatement = db.prepare(
  `
    UPDATE sessions
    SET revoked_at = ?
    WHERE user_id = ? AND revoked_at IS NULL
  `
);
const clearServiceRequestEventsActorStatement = db.prepare(
  "UPDATE service_request_events SET actor_user_id = NULL WHERE actor_user_id = ?"
);
const deleteWorkerBlocksStatement = db.prepare(
  `
    DELETE FROM service_request_worker_blocks
    WHERE worker_user_id = ? OR requester_user_id = ?
  `
);
const anonymizeUserStatement = db.prepare(
  `
    UPDATE users
    SET
      full_name = 'Conta excluída',
      email = ?,
      phone = ?,
      birth_date = '',
      password_hash = ?,
      avatar = NULL,
      headline = '',
      bio = '',
      professions_json = '[]',
      skills_json = '[]',
      availability_note = '',
      cpf = '',
      cpf_digits = '',
      cpf_verified_at = NULL,
      cpf_verified_name = NULL,
      cpf_verification_provider = NULL,
      cpf_verification_checked_at = NULL,
      terms_accepted_at = NULL,
      privacy_accepted_at = NULL,
      legal_version = NULL,
      address = '',
      certificates_json = '[]',
      verified_channel = NULL,
      email_verified_at = NULL,
      phone_verified_at = NULL,
      profile_setup_completed_at = NULL,
      provider_verification_status = 'not_required',
      provider_verification_submitted_at = NULL,
      provider_verification_decided_at = NULL,
      provider_verification_requested_reason = NULL,
      provider_verification_decision_note = NULL,
      provider_verification_reviewed_by_user_id = NULL,
      provider_verification_document_version = 0,
      provider_rg_number = '',
      provider_face_image = NULL,
      provider_rg_document_image = NULL,
      last_active_at = NULL,
      asaas_customer_id = NULL,
      pix_withdrawal_key_type = NULL,
      pix_withdrawal_key = '',
      admin_flagged_at = NULL,
      admin_flag_reason = NULL,
      suspended_at = ?,
      suspension_reason = 'Conta excluída pelo(a) usuário(a).',
      auth_provider = 'password',
      google_subject = NULL,
      identity_locked_at = NULL,
      deleted_at = ?,
      deletion_requested_at = ?,
      updated_at = ?
    WHERE id = ?
  `
);

function ensureGoogleOAuthConfigured() {
  if (!config.googleOAuth.clientId || !config.googleOAuth.clientSecret) {
    throw new HttpError(
      503,
      "Login com Google ainda não está configurado no servidor."
    );
  }
}

function normalizeGoogleOAuthReturnTo(returnTo) {
  const rawReturnTo = String(returnTo ?? "").trim();

  if (!rawReturnTo) {
    return "";
  }

  try {
    const parsedReturnTo = new URL(rawReturnTo);

    if (
      parsedReturnTo.protocol === "com.worqo.app:" &&
      parsedReturnTo.hostname === "auth" &&
      parsedReturnTo.pathname === "/google"
    ) {
      return "com.worqo.app://auth/google";
    }

    const allowedOrigins = new Set(config.clientOrigins);
    const candidateOrigin = `${parsedReturnTo.protocol}//${parsedReturnTo.host}`;

    if (
      ["http:", "https:", "capacitor:", "ionic:"].includes(parsedReturnTo.protocol) &&
      allowedOrigins.has(candidateOrigin)
    ) {
      return parsedReturnTo.toString();
    }
  } catch {
    return "";
  }

  return "";
}

function consumeGoogleOAuthState(state) {
  const stateHash = hashCode(String(state ?? ""));
  const stateRow = db
    .prepare(
      `
        SELECT *
        FROM oauth_login_states
        WHERE provider = 'google'
          AND state_hash = ?
          AND consumed_at IS NULL
        LIMIT 1
      `
    )
    .get(stateHash);

  if (!stateRow) {
    throw new HttpError(400, "Sessão de login Google inválida. Tente novamente.");
  }

  if (new Date(stateRow.expires_at).getTime() < Date.now()) {
    throw new HttpError(400, "Sessão de login Google expirada. Tente novamente.");
  }

  db.prepare("UPDATE oauth_login_states SET consumed_at = ? WHERE id = ?").run(
    nowIso(),
    stateRow.id
  );

  return {
    rememberMe: Boolean(stateRow.remember_me),
    returnTo: stateRow.return_to || "",
    flowVersion: Number(stateRow.flow_version) || 1,
    deviceId: stateRow.device_id || "",
    deviceLabel: stateRow.device_label || "",
    devicePlatform: stateRow.device_platform || "",
    timezone: stateRow.timezone || "",
    loginIp: stateRow.login_ip || "",
    loginLocation: stateRow.login_location || "",
  };
}

export function createGoogleOAuthExchange(result) {
  const exchange = createSessionToken();
  const timestamp = nowIso();
  const expiresAt = new Date(Date.now() + oauthExchangeDurationMs).toISOString();
  const { returnTo = "", flowVersion = 1, ...exchangeResult } = result ?? {};

  db.prepare(
    `
      INSERT INTO oauth_login_results (
        id,
        exchange_hash,
        result_json,
        expires_at,
        consumed_at,
        created_at
      ) VALUES (?, ?, ?, ?, NULL, ?)
    `
  ).run(
    createId(),
    hashCode(exchange),
    JSON.stringify(exchangeResult),
    expiresAt,
    timestamp
  );

  return { exchange, returnTo, flowVersion };
}

export function cancelGoogleOAuthLogin(state) {
  const { returnTo, flowVersion } = consumeGoogleOAuthState(state);
  return { returnTo, flowVersion };
}

export function consumeGoogleOAuthExchange(exchange) {
  const exchangeHash = hashCode(String(exchange ?? ""));
  const resultRow = db
    .prepare(
      `
        SELECT *
        FROM oauth_login_results
        WHERE exchange_hash = ?
          AND consumed_at IS NULL
        LIMIT 1
      `
    )
    .get(exchangeHash);

  if (!resultRow) {
    throw new HttpError(400, "Retorno do Google inválido ou já utilizado. Tente novamente.");
  }

  db.prepare("DELETE FROM oauth_login_results WHERE id = ?").run(resultRow.id);

  if (new Date(resultRow.expires_at).getTime() < Date.now()) {
    throw new HttpError(400, "O retorno do Google expirou. Tente novamente.");
  }

  try {
    return JSON.parse(resultRow.result_json);
  } catch {
    throw new HttpError(500, "Não conseguimos recuperar o retorno seguro do Google.");
  }
}

async function requestGoogleToken(code) {
  const body = new URLSearchParams({
    client_id: config.googleOAuth.clientId,
    client_secret: config.googleOAuth.clientSecret,
    code,
    grant_type: "authorization_code",
    redirect_uri: config.googleOAuth.redirectUri,
  });

  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
  });

  const payload = await response.json().catch(() => null);

  if (!response.ok || !payload?.access_token) {
    const googleError = String(payload?.error ?? "").trim();
    const googleDescription = String(payload?.error_description ?? "").trim();
    const knownMessage =
      googleError === "invalid_client"
        ? "Client ID ou chave secreta do Google inválidos."
        : googleError === "redirect_uri_mismatch"
          ? "A URL de redirecionamento do Google não confere com a cadastrada no Console Cloud."
          : googleError === "invalid_grant"
            ? "O código do Google expirou ou já foi usado. Tente entrar novamente."
            : "";

    console.warn("Falha ao trocar codigo OAuth do Google.", {
      status: response.status,
      error: googleError || null,
      errorDescription: googleDescription || null,
      redirectUri: config.googleOAuth.redirectUri,
    });

    throw new HttpError(
      502,
      knownMessage ||
        googleDescription ||
        "Não conseguimos validar o login com Google agora."
    );
  }

  return payload;
}

async function requestGoogleProfile(accessToken) {
  const response = await fetch("https://openidconnect.googleapis.com/v1/userinfo", {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  const profile = await response.json().catch(() => null);

  if (!response.ok || !profile?.sub || !profile?.email) {
    throw new HttpError(502, "Não conseguimos obter os dados da conta Google.");
  }

  if (profile.email_verified !== true) {
    throw new HttpError(403, "Use uma conta Google com e-mail verificado.");
  }

  return {
    subject: String(profile.sub).trim(),
    email: normalizeEmail(profile.email),
    fullName: String(profile.name ?? profile.email).trim(),
    avatar: String(profile.picture ?? "").trim() || null,
  };
}

function readGoogleProfileFromIdToken(idToken) {
  const tokenParts = String(idToken ?? "").split(".");

  if (tokenParts.length !== 3) {
    return null;
  }

  let claims;

  try {
    claims = JSON.parse(Buffer.from(tokenParts[1], "base64url").toString("utf8"));
  } catch {
    throw new HttpError(502, "O Google devolveu uma identificação inválida. Tente novamente.");
  }

  const audiences = Array.isArray(claims?.aud) ? claims.aud : [claims?.aud];
  const issuer = String(claims?.iss ?? "").trim();
  const expiresAt = Number(claims?.exp ?? 0) * 1000;

  if (
    !audiences.includes(config.googleOAuth.clientId) ||
    !["accounts.google.com", "https://accounts.google.com"].includes(issuer) ||
    !Number.isFinite(expiresAt) ||
    expiresAt <= Date.now() ||
    !claims?.sub ||
    !claims?.email
  ) {
    throw new HttpError(403, "Não conseguimos confirmar a identidade desta conta Google.");
  }

  if (claims.email_verified !== true) {
    throw new HttpError(403, "Use uma conta Google com e-mail verificado.");
  }

  return {
    subject: String(claims.sub).trim(),
    email: normalizeEmail(claims.email),
    fullName: String(claims.name ?? claims.email).trim(),
    avatar: String(claims.picture ?? "").trim() || null,
  };
}

function toPendingVerification(user) {
  return {
    userId: user.id,
    fullName: user.full_name,
    email: user.email,
    phone: user.phone,
    birthDate: user.birth_date,
  };
}

function buildGooglePlaceholderPhone(googleSubject) {
  return `google:${String(googleSubject).slice(0, 48)}`;
}

function buildAdminPlaceholderPhone(email) {
  return `admin:${normalizeEmail(email).slice(0, 48)}`;
}

function isAccountEmailBlocked(email) {
  return Boolean(
    db
      .prepare("SELECT email FROM blocked_account_emails WHERE email = ? LIMIT 1")
      .get(normalizeEmail(email))
  );
}

function assertEmailCanCreateAccount(email) {
  if (isAccountEmailBlocked(email)) {
    throw new HttpError(
      403,
      "Este e-mail pertence a uma conta excluída, banida ou suspensa e não pode criar outra conta Worko."
    );
  }
}

function createGoogleUser(profile) {
  assertEmailCanCreateAccount(profile.email);
  const timestamp = nowIso();
  const userId = createId();
  const isAdminProfile = isAdminEmail(profile.email);

  db.prepare(
    `
      INSERT INTO users (
        id,
        full_name,
        email,
        phone,
        birth_date,
        password_hash,
        avatar,
        verified_channel,
        email_verified_at,
        terms_accepted_at,
        privacy_accepted_at,
        legal_version,
        auth_provider,
        google_subject,
        created_at,
        updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, NULL, NULL, NULL, NULL, NULL, 'google', ?, ?, ?)
    `
  ).run(
    userId,
    isAdminProfile ? "Administração" : profile.fullName || profile.email,
    profile.email,
    isAdminProfile ? buildAdminPlaceholderPhone(profile.email) : buildGooglePlaceholderPhone(profile.subject),
    "",
    createPasswordHash(createSessionToken()),
    profile.avatar,
    profile.subject,
    timestamp,
    timestamp
  );

  return getUserById(userId);
}

function upsertGoogleUser(profile) {
  const bySubject = getUserByGoogleSubject(profile.subject);
  const byEmail = getUserByEmail(profile.email);
  const user = bySubject ?? byEmail;
  const timestamp = nowIso();

  if (!user) {
    return createGoogleUser(profile);
  }

  assertUserIsActive(user);

  if (user.suspended_at) {
    throw new HttpError(
      403,
      user.suspension_reason
        ? `Sua conta foi suspensa. Motivo: ${user.suspension_reason}`
        : "Sua conta foi suspensa temporariamente."
    );
  }

  if (bySubject && byEmail && bySubject.id !== byEmail.id) {
    throw new HttpError(
      409,
      "Essa conta Google já está vinculada a outro(a) usuário(a) do Worko."
    );
  }

  if (isAdminEmail(user.email)) {
    db.prepare(
      `
        UPDATE users
        SET
          full_name = 'Administração',
          phone = ?,
          birth_date = '',
          cpf = '',
          cpf_digits = '',
          cpf_verified_at = NULL,
          cpf_verified_name = NULL,
          cpf_verification_provider = NULL,
          cpf_verification_checked_at = NULL,
          identity_locked_at = NULL,
          profile_setup_completed_at = NULL,
          pix_withdrawal_key_type = NULL,
          pix_withdrawal_key = '',
          updated_at = ?
        WHERE id = ?
      `
    ).run(buildAdminPlaceholderPhone(user.email), timestamp, user.id);
  }

  db.prepare(
    `
      UPDATE users
      SET
        google_subject = COALESCE(NULLIF(google_subject, ''), ?),
        auth_provider = CASE
          WHEN auth_provider = 'google' THEN auth_provider
          ELSE 'password'
        END,
        avatar = COALESCE(NULLIF(avatar, ''), ?),
        updated_at = ?
      WHERE id = ?
    `
  ).run(profile.subject, profile.avatar ?? "", timestamp, user.id);

  return getUserById(user.id);
}

export function createGoogleOAuthStartUrl({
  rememberMe = true,
  returnTo = "",
  deviceId = "",
  deviceLabel = "",
  devicePlatform = "",
  timezone = "",
  loginIp = "",
  loginLocation = "",
  flowVersion = 1,
} = {}) {
  ensureGoogleOAuthConfigured();

  const state = createSessionToken();
  const expiresAt = new Date(Date.now() + oauthStateDurationMs).toISOString();
  const normalizedReturnTo = normalizeGoogleOAuthReturnTo(returnTo);

  db.prepare(
    `
      INSERT INTO oauth_login_states (
        id,
        provider,
        state_hash,
        remember_me,
        return_to,
        device_id,
        device_label,
        device_platform,
        timezone,
        login_ip,
        login_location,
        flow_version,
        expires_at,
        created_at
      ) VALUES (?, 'google', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `
  ).run(
    createId(),
    hashCode(state),
    rememberMe ? 1 : 0,
    normalizedReturnTo,
    normalizeSessionText(deviceId, 160),
    normalizeSessionText(deviceLabel, 160),
    normalizeSessionText(devicePlatform, 40),
    normalizeSessionText(timezone, 100),
    normalizeSessionText(loginIp, 100),
    normalizeSessionText(loginLocation, 180),
    Number(flowVersion) >= 2 ? 2 : 1,
    expiresAt,
    nowIso()
  );

  const googleUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  googleUrl.searchParams.set("client_id", config.googleOAuth.clientId);
  googleUrl.searchParams.set("redirect_uri", config.googleOAuth.redirectUri);
  googleUrl.searchParams.set("response_type", "code");
  googleUrl.searchParams.set("scope", "openid email profile");
  googleUrl.searchParams.set("state", state);
  googleUrl.searchParams.set("prompt", "select_account");

  return googleUrl.toString();
}

export async function completeGoogleOAuthLogin({ code, state }) {
  ensureGoogleOAuthConfigured();

  if (!code || !state) {
    throw new HttpError(400, "Retorno do Google incompleto. Tente novamente.");
  }

  const {
    rememberMe,
    returnTo,
    flowVersion,
    deviceId,
    deviceLabel,
    devicePlatform,
    timezone,
    loginIp,
    loginLocation,
  } = consumeGoogleOAuthState(state);
  const googleTokens = await requestGoogleToken(String(code));
  const profile =
    readGoogleProfileFromIdToken(googleTokens.id_token) ??
    (await requestGoogleProfile(googleTokens.access_token));
  const user = upsertGoogleUser(profile);

  if (!user.verified_channel) {
    return {
      token: null,
      pendingVerification: toPendingVerification(user),
      user: mapUser(user),
      rememberMe,
      returnTo,
      flowVersion,
    };
  }

  const session = await prepareAuthenticatedLogin(user, {
    rememberMe,
    deviceId,
    deviceLabel,
    devicePlatform,
    timezone,
    loginIp,
    loginLocation,
  });

  return {
    ...session,
    rememberMe,
    returnTo,
    flowVersion,
  };
}

export async function registerUser(payload) {
  const email = normalizeEmail(payload.email);
  const isAdminRegistration = isAdminEmail(email);

  validateRegistrationInput(payload, { requireIdentity: !isAdminRegistration });
  assertEmailCanCreateAccount(email);

  const phone = isAdminRegistration
    ? buildAdminPlaceholderPhone(email)
    : normalizePhone(payload.phone);
  const fullName = isAdminRegistration ? "Administração" : payload.fullName.trim();
  const birthDate = isAdminRegistration ? "" : payload.birthDate;

  if (getUserByEmail(email)) {
    throw new HttpError(409, "Já existe uma conta com esse e-mail.");
  }

  if (getUserByPhone(phone)) {
    throw new HttpError(409, "Já existe uma conta com esse telefone.");
  }

  const userId = createId();
  const timestamp = nowIso();

  db.prepare(
    `
      INSERT INTO users (
        id, full_name, email, phone, birth_date, password_hash, identity_locked_at, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `
  ).run(
    userId,
    fullName,
    email,
    phone,
    birthDate,
    createPasswordHash(payload.password),
    isAdminRegistration ? null : timestamp,
    timestamp,
    timestamp
  );

  return {
    userId,
    fullName,
    email,
    phone: isAdminRegistration ? "" : phone,
    birthDate,
  };
}

export async function sendVerificationCode({ userId }) {
  const user = getUserById(userId);

  if (!user) {
    throw new HttpError(404, "Usuário(a) não encontrado(a) para validação.");
  }

  const destination = user.email;
  const latestCode = db
    .prepare(
      `
        SELECT created_at
        FROM verification_codes
        WHERE user_id = ? AND channel = ?
        ORDER BY created_at DESC
        LIMIT 1
      `
    )
    .get(userId, "email");

  if (latestCode) {
    const millisecondsSinceLastCode =
      Date.now() - new Date(latestCode.created_at).getTime();

    if (millisecondsSinceLastCode < 30_000) {
      throw new HttpError(
        429,
        "Aguarde alguns segundos antes de solicitar um novo código."
      );
    }
  }

  const delivery = await dispatchVerification({
    channel: "email",
    fullName: user.full_name,
    destination,
    userId,
  });

  return {
    provider: delivery.provider,
    destination,
    debugCode: delivery.debugCode ?? null,
  };
}

function verifyEmailAccount({
  code,
  userId,
  acceptTerms,
  acceptPrivacy,
  legalVersion,
  rememberMe,
  deviceId,
  deviceLabel,
  devicePlatform,
  timezone,
  loginIp,
  loginLocation,
}) {
  validateVerificationCode(code);

  if (!acceptTerms || !acceptPrivacy) {
    throw new HttpError(
      400,
      "Aceite os Termos de Uso e o Aviso de Privacidade antes de validar a conta."
    );
  }

  const acceptedLegalVersion = ensureCurrentLegalVersion(legalVersion);

  const verificationRow = db
    .prepare(
      `
        SELECT *
        FROM verification_codes
        WHERE user_id = ? AND channel = 'email' AND consumed_at IS NULL
        ORDER BY created_at DESC
        LIMIT 1
      `
    )
    .get(userId);

  if (!verificationRow) {
    throw new HttpError(400, "Solicite um código antes de validar.");
  }

  if (new Date(verificationRow.expires_at).getTime() < Date.now()) {
    throw new HttpError(400, "O código expirou. Solicite um novo código.");
  }

  if (verificationRow.code_hash !== hashCode(code)) {
    throw new HttpError(400, "Código inválido.");
  }

  const timestamp = nowIso();

  db.prepare(
    `
      UPDATE verification_codes
      SET consumed_at = ?
      WHERE id = ?
    `
  ).run(timestamp, verificationRow.id);

  db.prepare(
    `
      UPDATE users
      SET
        verified_channel = 'email',
        email_verified_at = ?,
        terms_accepted_at = ?,
        privacy_accepted_at = ?,
        legal_version = ?,
        updated_at = ?
      WHERE id = ?
    `
  ).run(
    timestamp,
    timestamp,
    timestamp,
    acceptedLegalVersion,
    timestamp,
    userId
  );

  const token = createSession(userId, {
    rememberMe: Boolean(rememberMe),
    deviceId,
    deviceLabel,
    devicePlatform,
    timezone,
    loginIp,
    loginLocation,
  });
  return {
    token,
    user: mapUser(getUserById(userId)),
  };
}

export function verifyAccount({
  code,
  userId,
  acceptTerms,
  acceptPrivacy,
  legalVersion,
  rememberMe,
  deviceId,
  deviceLabel,
  devicePlatform,
  timezone,
  loginIp,
  loginLocation,
}) {
  const user = getUserById(userId);

  if (!user) {
    throw new HttpError(404, "Usuário(a) não encontrado(a).");
  }

  return verifyEmailAccount({
    code,
    userId,
    acceptTerms,
    acceptPrivacy,
    legalVersion,
    rememberMe,
    deviceId,
    deviceLabel,
    devicePlatform,
    timezone,
    loginIp,
    loginLocation,
  });
}

export async function loginUser({
  email,
  password,
  rememberMe,
  deviceId,
  deviceLabel,
  devicePlatform,
  timezone,
  loginIp,
  loginLocation,
}) {
  const normalizedEmail = normalizeEmail(email ?? "");
  const normalizedPassword = String(password ?? "").trim();
  const user = getUserByEmail(normalizedEmail);
  const suspendedAt = user?.suspended_at ?? null;
  const suspensionReason = user?.suspension_reason ?? null;

  if (!user || !verifyPassword(normalizedPassword, user.password_hash)) {
    throw new HttpError(401, "E-mail ou senha inválidos.");
  }

  assertUserIsActive(user);

  if (suspendedAt) {
    throw new HttpError(
      403,
      suspensionReason
        ? `Sua conta foi suspensa. Motivo: ${suspensionReason}`
        : "Sua conta foi suspensa temporariamente."
    );
  }

  if (!user.verified_channel) {
    throw new HttpError(403, "Valide seu e-mail antes de entrar no aplicativo.", {
      pendingVerification: {
        userId: user.id,
        fullName: user.full_name,
        email: user.email,
        phone: user.phone,
        birthDate: user.birth_date,
      },
    });
  }

  return prepareAuthenticatedLogin(user, {
    rememberMe: Boolean(rememberMe),
    deviceId,
    deviceLabel,
    devicePlatform,
    timezone,
    loginIp,
    loginLocation,
  });
}

export async function requestPasswordReset({ email }) {
  const startedAt = Date.now();
  const normalizedEmail = normalizeEmail(email ?? "");
  const genericResponse = {
    ok: true,
    message:
      "Se existir uma conta ativa com este e-mail, enviaremos um código de recuperação válido por 10 minutos.",
  };
  const finishRequest = async (response) => {
    const remainingDelay = Math.max(0, 650 - (Date.now() - startedAt));

    if (remainingDelay > 0) {
      await new Promise((resolve) => setTimeout(resolve, remainingDelay));
    }

    return response;
  };
  const user = getUserByEmail(normalizedEmail);

  if (!user || user.deleted_at || user.suspended_at || !user.verified_channel) {
    return finishRequest(genericResponse);
  }

  const latestChallenge = db
    .prepare(
      `
        SELECT created_at
        FROM password_reset_challenges
        WHERE user_id = ? AND consumed_at IS NULL
        ORDER BY created_at DESC
        LIMIT 1
      `
    )
    .get(user.id);

  if (
    latestChallenge &&
    Date.now() - new Date(latestChallenge.created_at).getTime() < securityChallengeResendWindowMs
  ) {
    return finishRequest(genericResponse);
  }

  const timestamp = nowIso();
  const challengeId = createId();
  const code = createNumericCode();
  const expiresAt = new Date(Date.now() + securityChallengeDurationMs).toISOString();

  db.prepare(
    `
      UPDATE password_reset_challenges
      SET consumed_at = ?
      WHERE user_id = ? AND consumed_at IS NULL
    `
  ).run(timestamp, user.id);
  db.prepare(
    `
      INSERT INTO password_reset_challenges (
        id, user_id, code_hash, expires_at, created_at
      ) VALUES (?, ?, ?, ?, ?)
    `
  ).run(challengeId, user.id, hashCode(code), expiresAt, timestamp);

  try {
    const delivery = await sendPasswordResetEmail({
      code,
      email: user.email,
      fullName: user.full_name,
    });

    return finishRequest({
      ...genericResponse,
      debugCode: delivery.provider.startsWith("mock") ? code : null,
    });
  } catch (error) {
    db.prepare(
      "UPDATE password_reset_challenges SET consumed_at = ? WHERE id = ?"
    ).run(nowIso(), challengeId);
    console.error("Password reset email delivery failed.", {
      userId: user.id,
      error: error instanceof Error ? error.message : String(error),
    });
    return finishRequest(genericResponse);
  }
}

export function resetPassword({ email, code, newPassword }) {
  const normalizedEmail = normalizeEmail(email ?? "");
  const password = validatePassword(String(newPassword ?? "").trim());
  validateVerificationCode(code);
  const user = getUserByEmail(normalizedEmail);
  const invalidCodeError = () =>
    new HttpError(400, "Código inválido ou expirado. Solicite um novo código.");

  if (!user || user.deleted_at || user.suspended_at) {
    throw invalidCodeError();
  }

  const challenge = db
    .prepare(
      `
        SELECT *
        FROM password_reset_challenges
        WHERE user_id = ? AND consumed_at IS NULL
        ORDER BY created_at DESC
        LIMIT 1
      `
    )
    .get(user.id);

  if (
    !challenge ||
    new Date(challenge.expires_at).getTime() < Date.now() ||
    Number(challenge.failed_attempts) >= securityChallengeMaxAttempts
  ) {
    throw invalidCodeError();
  }

  if (challenge.code_hash !== hashCode(code)) {
    db.prepare(
      `
        UPDATE password_reset_challenges
        SET failed_attempts = failed_attempts + 1
        WHERE id = ?
      `
    ).run(challenge.id);
    throw invalidCodeError();
  }

  const timestamp = nowIso();
  db.exec("BEGIN IMMEDIATE");

  try {
    db.prepare(
      "UPDATE password_reset_challenges SET consumed_at = ? WHERE id = ? AND consumed_at IS NULL"
    ).run(timestamp, challenge.id);
    db.prepare(
      "UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?"
    ).run(createPasswordHash(password), timestamp, user.id);
    db.prepare(
      `
        UPDATE sessions
        SET revoked_at = ?, revoked_reason = 'password-reset'
        WHERE user_id = ? AND revoked_at IS NULL
      `
    ).run(timestamp, user.id);
    db.prepare(
      `
        UPDATE device_login_challenges
        SET consumed_at = ?
        WHERE user_id = ? AND consumed_at IS NULL
      `
    ).run(timestamp, user.id);
    db.prepare("DELETE FROM trusted_login_devices WHERE user_id = ?").run(user.id);
    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }

  return {
    ok: true,
    message: "Senha redefinida. Entre novamente usando sua nova senha.",
  };
}

export function verifyDeviceLogin({ challengeId, code }) {
  validateVerificationCode(code);
  const challenge = db
    .prepare(
      `
        SELECT *
        FROM device_login_challenges
        WHERE id = ? AND consumed_at IS NULL
        LIMIT 1
      `
    )
    .get(String(challengeId ?? "").trim());
  const invalidCodeError = () =>
    new HttpError(400, "Código inválido ou expirado. Faça o login novamente.");

  if (
    !challenge ||
    new Date(challenge.expires_at).getTime() < Date.now() ||
    Number(challenge.failed_attempts) >= securityChallengeMaxAttempts
  ) {
    throw invalidCodeError();
  }

  if (challenge.code_hash !== hashCode(code)) {
    db.prepare(
      `
        UPDATE device_login_challenges
        SET failed_attempts = failed_attempts + 1
        WHERE id = ?
      `
    ).run(challenge.id);
    throw invalidCodeError();
  }

  const user = getUserById(challenge.user_id);

  if (!user) {
    throw invalidCodeError();
  }

  assertUserIsActive(user);

  if (user.suspended_at) {
    throw new HttpError(403, "Esta conta está suspensa.");
  }

  const timestamp = nowIso();
  const consumed = db.prepare(
    `
      UPDATE device_login_challenges
      SET consumed_at = ?
      WHERE id = ? AND consumed_at IS NULL
    `
  ).run(timestamp, challenge.id);

  if (Number(consumed.changes) !== 1) {
    throw invalidCodeError();
  }

  const token = createSession(user.id, {
    rememberMe: Boolean(challenge.remember_me),
    deviceId: challenge.device_id,
    deviceLabel: challenge.device_label,
    devicePlatform: challenge.device_platform,
    timezone: challenge.timezone,
    loginIp: challenge.login_ip,
    loginLocation: challenge.login_location,
  });

  return {
    token,
    user: mapUser(getUserById(user.id)),
  };
}

export function getSessionUser(token) {
  if (!token) {
    throw new HttpError(401, "Sessão ausente.");
  }

  const session = db
    .prepare(
      `
        SELECT *
        FROM sessions
        WHERE sessions.token_hash = ?
        LIMIT 1
      `
    )
    .get(hashCode(token));

  if (!session) {
    throw new HttpError(401, "Sessão inválida.");
  }

  if (session.revoked_at) {
    if (session.revoked_reason === "device-replaced") {
      throw new HttpError(
        401,
        "Sua conta foi acessada em outro aparelho. Entre novamente para usar este dispositivo.",
        {
          code: "SESSION_REPLACED",
          deviceLabel: session.replaced_device_label || "outro aparelho",
          loginLocation:
            session.replaced_login_location || "localização aproximada indisponível",
          replacedAt: session.replaced_at || session.revoked_at,
        }
      );
    }

    throw new HttpError(401, "Sessão inválida.");
  }

  if (new Date(session.expires_at).getTime() < Date.now()) {
    throw new HttpError(401, "Sessão expirada.");
  }

  const userRow = getUserById(session.user_id);
  const suspendedSessionAt = userRow?.suspended_at ?? null;
  const sessionSuspensionReason = userRow?.suspension_reason ?? null;

  if (!userRow) {
    throw new HttpError(401, "Não encontramos a sessão informada.");
  }

  assertUserIsActive(userRow);

  if (suspendedSessionAt) {
    throw new HttpError(
      403,
      sessionSuspensionReason
        ? `Sua conta foi suspensa. Motivo: ${sessionSuspensionReason}`
        : "Sua conta foi suspensa temporariamente."
    );
  }

  const lastActivityAt = userRow.last_active_at ? new Date(userRow.last_active_at).getTime() : 0;

  if (!Number.isFinite(lastActivityAt) || Date.now() - lastActivityAt >= userActivityTouchWindowMs) {
    const timestamp = nowIso();
    touchUserActivityStatement.run(timestamp, timestamp, session.user_id);
    userRow.last_active_at = timestamp;
  }

  return mapUser(userRow);
}

export function revokeSession(token) {
  if (!token) {
    return;
  }

  db.prepare(
    `
      UPDATE sessions
      SET revoked_at = ?
      WHERE token_hash = ? AND revoked_at IS NULL
    `
  ).run(nowIso(), hashCode(token));
}

export function completeUserAppTour(userId) {
  const user = getUserById(userId);

  if (!user || user.deleted_at) {
    throw new HttpError(404, "Conta não encontrada.");
  }

  const completedAt = user.app_tour_completed_at || nowIso();

  db.prepare(
    `
      UPDATE users
      SET app_tour_completed_at = COALESCE(app_tour_completed_at, ?), updated_at = ?
      WHERE id = ?
    `
  ).run(completedAt, nowIso(), userId);

  return {
    user: mapUser(getUserById(userId)),
    completedAt,
  };
}

export function getPublicUserProfile(targetUserId) {
  const user = getUserById(targetUserId);

  if (!user || user.deleted_at) {
    throw new HttpError(404, "Perfil não encontrado.");
  }

  return mapPublicUser(user);
}

export function deleteUserAccount(userId, { reason = "user-deleted" } = {}) {
  const user = getUserById(userId);

  if (!user || user.deleted_at) {
    throw new HttpError(404, "Conta não encontrada.");
  }

  if (isAdminEmail(user.email)) {
    throw new HttpError(403, "Contas administrativas devem ser encerradas pelo suporte.");
  }

  const outstandingWalletEntries = Number(
    countOutstandingWalletEntriesForAccountDeletionStatement.get(userId)?.total ?? 0
  );

  if (outstandingWalletEntries > 0) {
    throw new HttpError(
      409,
      "Não é possível excluir a conta enquanto houver saldo ou saque em processamento na carteira. Zere a carteira e tente novamente."
    );
  }

  const timestamp = nowIso();
  const passwordHash = createPasswordHash(createSessionToken());

  db.exec("BEGIN IMMEDIATE");

  try {
    blockAccountEmailStatement.run(
      normalizeEmail(user.email),
      userId,
      String(reason ?? "user-deleted").trim().slice(0, 80) || "user-deleted",
      timestamp
    );
    anonymizeServiceChatMessagesStatement.run(userId);
    anonymizeCommunityChatMessagesStatement.run(userId);
    deleteCommunityContactChatMessagesStatement.run(userId);
    deleteCommunityContactChatsStatement.run(userId);
    deleteUserCommunityPostsStatement.run(userId);
    deleteUserSupportTicketsStatement.run(userId);
    deleteUserPushDevicesStatement.run(userId);
    deleteUserNotificationsStatement.run(userId);
    deleteUserVerificationCodesStatement.run(userId);
    deleteUserPasswordResetChallengesStatement.run(userId);
    deleteUserDeviceLoginChallengesStatement.run(userId);
    deleteUserTrustedLoginDevicesStatement.run(userId);
    revokeUserSessionsStatement.run(timestamp, userId);
    clearServiceRequestEventsActorStatement.run(userId);
    deleteWorkerBlocksStatement.run(userId, userId);
    anonymizeUserStatement.run(
      buildDeletedUserEmail(userId),
      buildDeletedUserPhone(userId),
      passwordHash,
      timestamp,
      timestamp,
      timestamp,
      timestamp,
      userId
    );

    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }

  return {
    ok: true,
    deletedAt: timestamp,
  };
}

export function updateUserProfile(userId, updates) {
  const user = getUserById(userId);

  if (!user) {
    throw new HttpError(404, "Usuário(a) não encontrado(a).");
  }

  assertUserIsActive(user);

  const nextCertificatés = Array.isArray(updates.certificates)
    ? JSON.stringify(updates.certificates)
    : user.certificates_json;
  const nextHeadline =
    typeof updates.headline === "string"
      ? updates.headline.trim().slice(0, 80)
      : user.headline ?? "";
  const nextBio =
    typeof updates.bio === "string" ? updates.bio.trim().slice(0, 420) : user.bio ?? "";
  const nextProfessions = normalizeProfileList(updates.professions, user.professions_json, 5);
  const nextSkills = normalizeProfileList(updates.skills, user.skills_json, 10);
  const nextAvailabilityNote =
    typeof updates.availabilityNote === "string"
      ? updates.availabilityNote.trim().slice(0, 100)
      : user.availability_note ?? "";
  const nextAvatar = updates.avatar ?? user.avatar;
  const currentAccountKind =
    normalizeAccountKind(user.account_kind) ??
    (user.profile_setup_completed_at || isAdminEmail(user.email) ? "provider" : null);
  let nextAccountKind = currentAccountKind;

  if (updates.accountKind !== undefined) {
    const requestedAccountKind = normalizeAccountKind(updates.accountKind);

    if (!requestedAccountKind) {
      throw new HttpError(400, "Escolha Cliente ou Prestador(a) para continuar.");
    }

    if (currentAccountKind && requestedAccountKind !== currentAccountKind) {
      throw new HttpError(
        409,
        "Essa categoria já foi definida e não pode ser alterada pelo app."
      );
    }

    nextAccountKind = requestedAccountKind;
  }

  const currentProviderVerificationStatus = resolveProviderVerificationStatus(
    user,
    currentAccountKind,
    isAdminEmail(user.email)
  );
  let nextProviderVerificationStatus = currentProviderVerificationStatus;

  if (nextAccountKind !== "provider" || isAdminEmail(user.email)) {
    nextProviderVerificationStatus = "not_required";
  } else if (
    currentProviderVerificationStatus === "not_required" ||
    !String(user.provider_verification_status ?? "").trim()
  ) {
    nextProviderVerificationStatus = "pending_documents";
  }

  const nextCpfDigits = normalizeCpf(updates.cpf ?? user.cpf ?? "");
  const nextCpf = nextCpfDigits ? formatCpf(nextCpfDigits) : "";
  const nextAddress = updates.address ?? user.address ?? "";
  const basePixKeyType =
    updates.pixKeyType === undefined
      ? user.pix_withdrawal_key_type === "CPF"
        ? user.pix_withdrawal_key_type
        : null
      : updates.pixKeyType;
  const nextPixKeyType = normalizePixKeyType(basePixKeyType);
  let nextPixKey =
    updates.pixKeyType === null || updates.pixKey === null
      ? ""
      : normalizePixKeyValue(
          nextPixKeyType,
          updates.pixKey === undefined ? user.pix_withdrawal_key ?? "" : updates.pixKey
        );
  let effectivePixKeyType = nextPixKeyType;
  const cpfChanged = nextCpfDigits !== (user.cpf_digits ?? "");
  let profileCompletedAt = user.profile_setup_completed_at;
  const isCompletingProfileSetup =
    !profileCompletedAt && updates.avatar !== undefined && Boolean(nextAvatar);

  if (isCompletingProfileSetup) {
    if (!nextAccountKind) {
      throw new HttpError(400, "Escolha Cliente ou Prestador(a) antes da foto de perfil.");
    }

    if (nextAccountKind === "provider") {
      const professionCount = JSON.parse(nextProfessions).length;

      if (professionCount === 0) {
        throw new HttpError(400, "Informe sua profissão principal.");
      }

      if (!String(nextAddress ?? "").trim()) {
        throw new HttpError(400, "Informe seu endereço para concluir o cadastro.");
      }
    }

    profileCompletedAt = nowIso();
  }
  const identityUpdateRequested =
    updates.fullName !== undefined || updates.phone !== undefined || updates.birthDate !== undefined;
  let nextFullName = user.full_name;
  let nextPhone = user.phone;
  let nextBirthDate = user.birth_date;
  let nextIdentityLockedAt = user.identity_locked_at ?? null;

  if (identityUpdateRequested) {
    if (user.identity_locked_at) {
      const sameFullName =
        updates.fullName === undefined || String(updates.fullName ?? "").trim() === user.full_name;
      const samePhone =
        updates.phone === undefined || normalizePhone(updates.phone ?? "") === user.phone;
      const sameBirthDate =
        updates.birthDate === undefined ||
        String(updates.birthDate ?? "").trim() === user.birth_date;

      if (!sameFullName || !samePhone || !sameBirthDate) {
        throw new HttpError(
          409,
          "Nome, telefone e data de nascimento já foram definidos e não podem ser alterados pelo app."
        );
      }
    } else {
      nextFullName = String(updates.fullName ?? user.full_name ?? "").trim();

      if (nextFullName.split(/\s+/).filter(Boolean).length < 2) {
        throw new HttpError(400, "Informe seu nome completo real para validar o CPF.");
      }

      nextPhone = normalizePhone(updates.phone ?? user.phone ?? "");
      nextBirthDate = validateIdentityBirthDate(updates.birthDate ?? user.birth_date ?? "");

      const existingPhoneOwner = getUserByPhone(nextPhone);

      if (existingPhoneOwner && existingPhoneOwner.id !== userId) {
        throw new HttpError(409, "Este telefone já está vinculado a outra conta.");
      }

      nextIdentityLockedAt = nowIso();
    }
  }

  if (user.cpf_verified_at && cpfChanged) {
    throw new HttpError(
      409,
      "Este CPF já foi verificado e não pode ser alterado pelo aplicativo."
    );
  }

  if (nextCpfDigits && !isValidCpf(nextCpfDigits)) {
    throw new HttpError(400, "CPF inválido. Revise os 11 dígitos antes de salvar.");
  }

  if (nextCpfDigits) {
    const existingCpfOwner = getUserByCpfDigits(nextCpfDigits);

    if (existingCpfOwner && existingCpfOwner.id !== userId) {
      throw new HttpError(409, "Este CPF já está vinculado a outra conta.");
    }
  }

  if (
    nextAccountKind === "provider" &&
    !cpfChanged &&
    user.cpf_verified_at &&
    nextCpfDigits &&
    !nextPixKey
  ) {
    effectivePixKeyType = "CPF";
    nextPixKey = nextCpfDigits;
  }

  db.prepare(
    `
      UPDATE users
      SET
        avatar = ?,
        full_name = ?,
        account_kind = ?,
        phone = ?,
        birth_date = ?,
        headline = ?,
        bio = ?,
        professions_json = ?,
        skills_json = ?,
        availability_note = ?,
        cpf = ?,
        cpf_digits = ?,
        cpf_verified_at = ?,
        cpf_verified_name = ?,
        cpf_verification_provider = ?,
        cpf_verification_checked_at = ?,
        address = ?,
        pix_withdrawal_key_type = ?,
        pix_withdrawal_key = ?,
        certificates_json = ?,
        identity_locked_at = ?,
        profile_setup_completed_at = ?,
        provider_verification_status = ?,
        updated_at = ?
      WHERE id = ?
    `
  ).run(
    nextAvatar,
    nextFullName,
    nextAccountKind,
    nextPhone,
    nextBirthDate,
    nextHeadline,
    nextBio,
    nextProfessions,
    nextSkills,
    nextAvailabilityNote,
    nextCpf,
    nextCpfDigits,
    cpfChanged ? null : user.cpf_verified_at,
    cpfChanged ? null : user.cpf_verified_name,
    cpfChanged ? null : user.cpf_verification_provider,
    cpfChanged ? null : user.cpf_verification_checked_at,
    nextAddress,
    effectivePixKeyType,
    nextPixKey,
    nextCertificatés,
    nextIdentityLockedAt,
    profileCompletedAt,
    nextProviderVerificationStatus,
    nowIso(),
    userId
  );

  return mapUser(getUserById(userId));
}

export function submitProviderVerification(userId, payload) {
  const user = getUserById(userId);

  if (!user) {
    throw new HttpError(404, "UsuÃ¡rio(a) nÃ£o encontrado(a).");
  }

  assertUserIsActive(user);

  if (isAdminEmail(user.email) || normalizeAccountKind(user.account_kind) !== "provider") {
    throw new HttpError(403, "Somente contas de prestador(a) podem enviar documentos.");
  }

  if (!user.profile_setup_completed_at) {
    throw new HttpError(409, "Conclua seu perfil antes de enviar os documentos.");
  }

  const currentStatus = resolveProviderVerificationStatus(user, "provider", false);

  if (!providerVerificationSubmissionStatuses.has(currentStatus)) {
    if (currentStatus === "under_review") {
      throw new HttpError(409, "Seus documentos jÃ¡ estÃ£o em anÃ¡lise.");
    }

    if (currentStatus === "approved") {
      throw new HttpError(409, "Seu cadastro de prestador(a) jÃ¡ foi aprovado.");
    }

    throw new HttpError(403, "Seu cadastro foi recusado e nÃ£o pode reenviar documentos pelo app.");
  }

  const cpfDigits = normalizeCpf(payload?.cpf ?? user.cpf ?? "");

  if (!isValidCpf(cpfDigits)) {
    throw new HttpError(400, "Informe um CPF vÃ¡lido para a anÃ¡lise.");
  }

  const existingCpfOwner = getUserByCpfDigits(cpfDigits);

  if (existingCpfOwner && existingCpfOwner.id !== userId) {
    throw new HttpError(409, "Este CPF jÃ¡ estÃ¡ vinculado a outra conta.");
  }

  const cpfChanged = cpfDigits !== String(user.cpf_digits ?? "");

  if (user.cpf_verified_at && cpfChanged) {
    throw new HttpError(409, "O CPF validado nÃ£o pode ser alterado pelo aplicativo.");
  }

  const faceImage = normalizeProviderVerificationImage(payload?.faceImage, "a foto do rosto");
  const rgDocumentImage = normalizeProviderVerificationImage(payload?.rgDocumentImage, "a foto do RG");
  const rgNumber = normalizeProviderRgNumber(payload?.rgNumber);
  const timestamp = nowIso();

  db.prepare(
    `
      UPDATE users
      SET
        cpf = ?,
        cpf_digits = ?,
        cpf_verified_at = ?,
        cpf_verified_name = ?,
        cpf_verification_provider = ?,
        cpf_verification_checked_at = ?,
        provider_verification_status = 'under_review',
        provider_verification_submitted_at = ?,
        provider_verification_decided_at = NULL,
        provider_verification_requested_reason = NULL,
        provider_verification_decision_note = NULL,
        provider_verification_reviewed_by_user_id = NULL,
        provider_verification_document_version = COALESCE(provider_verification_document_version, 0) + 1,
        provider_rg_number = ?,
        provider_face_image = ?,
        provider_rg_document_image = ?,
        updated_at = ?
      WHERE id = ?
    `
  ).run(
    formatCpf(cpfDigits),
    cpfDigits,
    cpfChanged ? null : user.cpf_verified_at,
    cpfChanged ? null : user.cpf_verified_name,
    cpfChanged ? null : user.cpf_verification_provider,
    cpfChanged ? null : user.cpf_verification_checked_at,
    timestamp,
    rgNumber,
    faceImage,
    rgDocumentImage,
    timestamp,
    userId
  );

  return mapUser(getUserById(userId));
}

export async function verifyUserCpf(userId, cpfValue) {
  const user = getUserById(userId);

  if (!user) {
    throw new HttpError(404, "Usuário(a) não encontrado(a).");
  }

  if (user.cpf_verified_at && user.cpf_digits) {
    throw new HttpError(
      409,
      "Este CPF já foi verificado para esta conta e não pode ser validado novamente."
    );
  }

  const cpfDigits = normalizeCpf(cpfValue ?? user.cpf ?? "");

  if (!cpfDigits) {
    throw new HttpError(400, "Informe um CPF antes de iniciar a verificação.");
  }

  if (!isValidCpf(cpfDigits)) {
    throw new HttpError(400, "CPF inválido. Revise os 11 dígitos antes de validar.");
  }

  const existingCpfOwner = getUserByCpfDigits(cpfDigits);

  if (existingCpfOwner && existingCpfOwner.id !== userId) {
    throw new HttpError(409, "Este CPF já está vinculado a outra conta.");
  }

  const verification = await verifyOfficialCpf({
    cpf: cpfDigits,
    birthDate: user.birth_date,
    fullName: user.full_name,
  });
  const shouldUseCpfAsPixKey = user.account_kind === "provider";

  db.prepare(
    `
      UPDATE users
      SET
        cpf = ?,
        cpf_digits = ?,
        cpf_verified_at = ?,
        cpf_verified_name = ?,
        cpf_verification_provider = ?,
        cpf_verification_checked_at = ?,
        pix_withdrawal_key_type = CASE WHEN ? THEN 'CPF' ELSE pix_withdrawal_key_type END,
        pix_withdrawal_key = CASE WHEN ? THEN ? ELSE pix_withdrawal_key END,
        updated_at = ?
      WHERE id = ?
    `
  ).run(
    formatCpf(cpfDigits),
    cpfDigits,
    verification.verifiedAt,
    verification.verifiedName,
    verification.provider,
    verification.verifiedAt,
    shouldUseCpfAsPixKey ? 1 : 0,
    shouldUseCpfAsPixKey ? 1 : 0,
    cpfDigits,
    nowIso(),
    userId
  );

  return mapUser(getUserById(userId));
}


