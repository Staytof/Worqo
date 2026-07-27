import { db } from "../server/db.mjs";
import { createId, createPasswordHash, nowIso } from "../server/security.mjs";

const email = (process.env.PLAY_REVIEW_EMAIL || "play-review@worqo.app").trim().toLowerCase();
const password = process.env.PLAY_REVIEW_PASSWORD || "";

if (!password || password.length < 12) {
  throw new Error("Defina PLAY_REVIEW_PASSWORD com pelo menos 12 caracteres.");
}

const timestamp = nowIso();
const existingUser = db.prepare("SELECT * FROM users WHERE email = ?").get(email);
const passwordHash = createPasswordHash(password);
const reviewPhone = "review:google-play";

if (existingUser) {
  db.prepare(
    `
      UPDATE users
      SET
        full_name = 'Google Play Review',
        phone = ?,
        birth_date = '1990-01-01',
        password_hash = ?,
        avatar = NULL,
        headline = 'Conta de revisão do Google Play',
        bio = 'Conta verificada para avaliação do Google Play Console.',
        professions_json = '["Suporte técnico"]',
        skills_json = '["Conta verificada","Fluxo de demonstração"]',
        availability_note = 'Disponível para revisão do app.',
        cpf = '',
        cpf_digits = '',
        cpf_verified_at = NULL,
        cpf_verified_name = NULL,
        cpf_verification_provider = NULL,
        cpf_verification_checked_at = NULL,
        terms_accepted_at = COALESCE(terms_accepted_at, ?),
        privacy_accepted_at = COALESCE(privacy_accepted_at, ?),
        legal_version = '2026-06-18',
        address = 'Suzano, SP',
        verified_channel = 'email',
        email_verified_at = COALESCE(email_verified_at, ?),
        phone_verified_at = NULL,
        profile_setup_completed_at = COALESCE(profile_setup_completed_at, ?),
        last_active_at = NULL,
        pix_withdrawal_key_type = NULL,
        pix_withdrawal_key = '',
        suspended_at = NULL,
        suspension_reason = NULL,
        auth_provider = 'password',
        google_subject = NULL,
        identity_locked_at = COALESCE(identity_locked_at, ?),
        deleted_at = NULL,
        deletion_requested_at = NULL,
        updated_at = ?
      WHERE id = ?
    `
  ).run(
    reviewPhone,
    passwordHash,
    timestamp,
    timestamp,
    timestamp,
    timestamp,
    timestamp,
    timestamp,
    existingUser.id
  );

  console.log(`Conta de revisão atualizada: ${email}`);
} else {
  db.prepare(
    `
      INSERT INTO users (
        id,
        full_name,
        email,
        phone,
        birth_date,
        password_hash,
        headline,
        bio,
        professions_json,
        skills_json,
        availability_note,
        terms_accepted_at,
        privacy_accepted_at,
        legal_version,
        address,
        verified_channel,
        email_verified_at,
        profile_setup_completed_at,
        auth_provider,
        identity_locked_at,
        created_at,
        updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'email', ?, ?, 'password', ?, ?, ?)
    `
  ).run(
    createId(),
    "Google Play Review",
    email,
    reviewPhone,
    "1990-01-01",
    passwordHash,
    "Conta de revisão do Google Play",
    "Conta verificada para avaliação do Google Play Console.",
    JSON.stringify(["Suporte técnico"]),
    JSON.stringify(["Conta verificada", "Fluxo de demonstração"]),
    "Disponível para revisão do app.",
    timestamp,
    timestamp,
    "2026-06-18",
    "Suzano, SP",
    timestamp,
    timestamp,
    timestamp,
    timestamp,
    timestamp
  );

  console.log(`Conta de revisão criada: ${email}`);
}
