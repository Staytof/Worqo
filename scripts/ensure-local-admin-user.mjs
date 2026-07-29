import fs from "node:fs";
import { db } from "../server/db.mjs";
import { createId, createPasswordHash, nowIso } from "../server/security.mjs";

const email = "gabrielspec99@gmail.com";
const password = "Gabriel@Worko2026!";
const dbPath = "server/data/auth.db";
const timestamp = nowIso();
const backupStamp = timestamp.replace(/[:.]/g, "-");
const backupPath = dbPath.replace(/\.db$/i, `.pre-recreate-admin-${backupStamp}.backup.db`);

db.exec("PRAGMA wal_checkpoint(TRUNCATE)");
fs.copyFileSync(dbPath, backupPath);

const passwordHash = createPasswordHash(password);
const existing = db.prepare("SELECT id FROM users WHERE lower(email) = ?").get(email);

const commonValues = {
  fullName: "Administração",
  phone: "admin:gabrielspec99@gmail.com",
  birthDate: "1999-07-02",
  headline: "Administração",
  bio: "Painel administrativo Worko.",
  professions: JSON.stringify([]),
  skills: JSON.stringify([]),
  availability: "Painel administrativo.",
  legalVersion: "2026-07-28",
  address: "Suzano, SP",
};

if (existing) {
  db.prepare(
    `
      UPDATE users
      SET
        full_name = ?,
        phone = ?,
        birth_date = ?,
        password_hash = ?,
        account_kind = 'admin',
        headline = ?,
        bio = ?,
        professions_json = ?,
        skills_json = ?,
        availability_note = ?,
        cpf = '',
        cpf_digits = '',
        cpf_verified_at = NULL,
        cpf_verified_name = NULL,
        cpf_verification_provider = NULL,
        cpf_verification_checked_at = NULL,
        terms_accepted_at = COALESCE(terms_accepted_at, ?),
        privacy_accepted_at = COALESCE(privacy_accepted_at, ?),
        legal_version = ?,
        address = ?,
        verified_channel = 'email',
        email_verified_at = COALESCE(email_verified_at, ?),
        phone_verified_at = NULL,
        profile_setup_completed_at = COALESCE(profile_setup_completed_at, ?),
        auth_provider = 'password',
        google_subject = NULL,
        identity_locked_at = COALESCE(identity_locked_at, ?),
        deleted_at = NULL,
        deletion_requested_at = NULL,
        updated_at = ?
      WHERE id = ?
    `
  ).run(
    commonValues.fullName,
    commonValues.phone,
    commonValues.birthDate,
    passwordHash,
    commonValues.headline,
    commonValues.bio,
    commonValues.professions,
    commonValues.skills,
    commonValues.availability,
    timestamp,
    timestamp,
    commonValues.legalVersion,
    commonValues.address,
    timestamp,
    timestamp,
    timestamp,
    timestamp,
    existing.id
  );

  console.log(`Admin atualizada: ${email}`);
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
        account_kind,
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
      ) VALUES (?, ?, ?, ?, ?, ?, 'admin', ?, ?, ?, ?, ?, ?, ?, ?, ?, 'email', ?, ?, 'password', ?, ?, ?)
    `
  ).run(
    createId(),
    commonValues.fullName,
    email,
    commonValues.phone,
    commonValues.birthDate,
    passwordHash,
    commonValues.headline,
    commonValues.bio,
    commonValues.professions,
    commonValues.skills,
    commonValues.availability,
    timestamp,
    timestamp,
    commonValues.legalVersion,
    commonValues.address,
    timestamp,
    timestamp,
    timestamp,
    timestamp,
    timestamp
  );

  console.log(`Admin criada: ${email}`);
}

console.log(`Senha local: ${password}`);
console.log(`Backup criado em: ${backupPath}`);

db.close();
