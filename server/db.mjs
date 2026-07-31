import fs from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { config, isAdminEmail } from "./config.mjs";
import { normalizeCpf } from "./cpf-utils.mjs";

fs.mkdirSync(path.dirname(config.dbPath), { recursive: true });

export const db = new DatabaseSync(config.dbPath);

db.exec(`
  PRAGMA journal_mode = WAL;
  PRAGMA foreign_keys = ON;

  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    full_name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    phone TEXT NOT NULL UNIQUE,
    birth_date TEXT NOT NULL,
    password_hash TEXT NOT NULL,
    account_kind TEXT,
    avatar TEXT,
    headline TEXT DEFAULT '',
    bio TEXT DEFAULT '',
    professions_json TEXT NOT NULL DEFAULT '[]',
    skills_json TEXT NOT NULL DEFAULT '[]',
    availability_note TEXT DEFAULT '',
    cpf TEXT DEFAULT '',
    cpf_digits TEXT NOT NULL DEFAULT '',
    cpf_verified_at TEXT,
    cpf_verified_name TEXT,
    cpf_verification_provider TEXT,
    cpf_verification_checked_at TEXT,
    terms_accepted_at TEXT,
    privacy_accepted_at TEXT,
    legal_version TEXT,
    address TEXT DEFAULT '',
    certificates_json TEXT NOT NULL DEFAULT '[]',
    verified_channel TEXT,
    email_verified_at TEXT,
    phone_verified_at TEXT,
    profile_setup_completed_at TEXT,
    provider_verification_status TEXT NOT NULL DEFAULT 'not_required',
    provider_verification_submitted_at TEXT,
    provider_verification_decided_at TEXT,
    provider_verification_requested_reason TEXT,
    provider_verification_decision_note TEXT,
    provider_verification_reviewed_by_user_id TEXT,
    provider_verification_document_version INTEGER NOT NULL DEFAULT 0,
    provider_rg_number TEXT NOT NULL DEFAULT '',
    provider_face_image TEXT,
    provider_rg_document_image TEXT,
    deleted_at TEXT,
    deletion_requested_at TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS verification_codes (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    channel TEXT NOT NULL,
    destination TEXT NOT NULL,
    code_hash TEXT NOT NULL,
    expires_at TEXT NOT NULL,
    consumed_at TEXT,
    created_at TEXT NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users (id)
  );

  CREATE TABLE IF NOT EXISTS password_reset_challenges (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    code_hash TEXT NOT NULL,
    expires_at TEXT NOT NULL,
    consumed_at TEXT,
    failed_attempts INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users (id)
  );

  CREATE TABLE IF NOT EXISTS device_login_challenges (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    code_hash TEXT NOT NULL,
    remember_me INTEGER NOT NULL DEFAULT 1,
    device_id TEXT NOT NULL,
    device_label TEXT NOT NULL,
    device_platform TEXT NOT NULL,
    timezone TEXT NOT NULL,
    login_ip TEXT NOT NULL,
    login_location TEXT NOT NULL,
    expires_at TEXT NOT NULL,
    consumed_at TEXT,
    failed_attempts INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users (id)
  );

  CREATE TABLE IF NOT EXISTS blocked_account_emails (
    email TEXT PRIMARY KEY,
    user_id TEXT,
    reason TEXT NOT NULL,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS trusted_login_devices (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    device_id TEXT NOT NULL,
    device_label TEXT NOT NULL,
    device_platform TEXT NOT NULL,
    first_verified_at TEXT NOT NULL,
    last_verified_at TEXT NOT NULL,
    UNIQUE (user_id, device_id),
    FOREIGN KEY (user_id) REFERENCES users (id)
  );

  CREATE TABLE IF NOT EXISTS sessions (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    token_hash TEXT NOT NULL UNIQUE,
    expires_at TEXT NOT NULL,
    revoked_at TEXT,
    created_at TEXT NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users (id)
  );

  CREATE TABLE IF NOT EXISTS oauth_login_states (
    id TEXT PRIMARY KEY,
    provider TEXT NOT NULL,
    state_hash TEXT NOT NULL UNIQUE,
    remember_me INTEGER NOT NULL DEFAULT 1,
    return_to TEXT,
    expires_at TEXT NOT NULL,
    consumed_at TEXT,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS service_requests (
    id TEXT PRIMARY KEY,
    requester_user_id TEXT NOT NULL,
    category TEXT NOT NULL,
    description TEXT NOT NULL,
    latitude REAL NOT NULL,
    longitude REAL NOT NULL,
    accuracy REAL,
    location_label TEXT DEFAULT '',
    status TEXT NOT NULL DEFAULT 'searching',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY (requester_user_id) REFERENCES users (id)
  );

  CREATE TABLE IF NOT EXISTS service_chats (
    id TEXT PRIMARY KEY,
    service_request_id TEXT NOT NULL UNIQUE,
    requester_user_id TEXT NOT NULL,
    worker_user_id TEXT NOT NULL,
    requester_last_seen_at TEXT,
    worker_last_seen_at TEXT,
    locked_at TEXT,
    reopened_at TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY (service_request_id) REFERENCES service_requests (id) ON DELETE CASCADE,
    FOREIGN KEY (requester_user_id) REFERENCES users (id),
    FOREIGN KEY (worker_user_id) REFERENCES users (id)
  );

  CREATE TABLE IF NOT EXISTS service_chat_messages (
    id TEXT PRIMARY KEY,
    chat_id TEXT NOT NULL,
    sender_user_id TEXT NOT NULL,
    body TEXT NOT NULL,
    message_type TEXT NOT NULL DEFAULT 'text',
    image_url TEXT,
    created_at TEXT NOT NULL,
    FOREIGN KEY (chat_id) REFERENCES service_chats (id) ON DELETE CASCADE,
    FOREIGN KEY (sender_user_id) REFERENCES users (id)
  );

  CREATE TABLE IF NOT EXISTS community_posts (
    id TEXT PRIMARY KEY,
    author_user_id TEXT NOT NULL,
    post_type TEXT NOT NULL,
    category TEXT NOT NULL,
    content TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    archived_at TEXT,
    FOREIGN KEY (author_user_id) REFERENCES users (id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS community_post_chats (
    id TEXT PRIMARY KEY,
    post_id TEXT NOT NULL,
    post_author_user_id TEXT NOT NULL,
    contact_user_id TEXT NOT NULL,
    post_author_last_seen_at TEXT,
    contact_last_seen_at TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY (post_id) REFERENCES community_posts (id) ON DELETE CASCADE,
    FOREIGN KEY (post_author_user_id) REFERENCES users (id) ON DELETE CASCADE,
    FOREIGN KEY (contact_user_id) REFERENCES users (id) ON DELETE CASCADE,
    UNIQUE (post_id, post_author_user_id, contact_user_id)
  );

  CREATE TABLE IF NOT EXISTS community_post_chat_messages (
    id TEXT PRIMARY KEY,
    chat_id TEXT NOT NULL,
    sender_user_id TEXT NOT NULL,
    body TEXT NOT NULL,
    message_type TEXT NOT NULL DEFAULT 'text',
    image_url TEXT,
    created_at TEXT NOT NULL,
    FOREIGN KEY (chat_id) REFERENCES community_post_chats (id) ON DELETE CASCADE,
    FOREIGN KEY (sender_user_id) REFERENCES users (id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS user_notifications (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    kind TEXT NOT NULL,
    message TEXT NOT NULL,
    meta_json TEXT NOT NULL DEFAULT '{}',
    created_at TEXT NOT NULL,
    consumed_at TEXT,
    FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS user_push_devices (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    token TEXT NOT NULL UNIQUE,
    platform TEXT NOT NULL DEFAULT 'android',
    app_version TEXT DEFAULT '',
    device_label TEXT DEFAULT '',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    disabled_at TEXT,
    last_error TEXT,
    FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS service_reviews (
    id TEXT PRIMARY KEY,
    service_request_id TEXT NOT NULL,
    reviewer_user_id TEXT NOT NULL,
    target_user_id TEXT NOT NULL,
    rating INTEGER NOT NULL,
    comment TEXT NOT NULL,
    created_at TEXT NOT NULL,
    FOREIGN KEY (service_request_id) REFERENCES service_requests (id) ON DELETE CASCADE,
    FOREIGN KEY (reviewer_user_id) REFERENCES users (id) ON DELETE CASCADE,
    FOREIGN KEY (target_user_id) REFERENCES users (id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS asaas_webhook_events (
    id TEXT PRIMARY KEY,
    event_type TEXT NOT NULL,
    processed_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS worker_withdrawals (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    provider_transfer_id TEXT NOT NULL UNIQUE,
    mode TEXT NOT NULL DEFAULT 'instant',
    gross_amount_cents INTEGER NOT NULL DEFAULT 0,
    fee_amount_cents INTEGER NOT NULL DEFAULT 0,
    amount_cents INTEGER NOT NULL,
    currency TEXT NOT NULL DEFAULT 'brl',
    status TEXT NOT NULL,
    pix_key_type TEXT NOT NULL,
    pix_key TEXT NOT NULL,
    description TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS service_request_events (
    id TEXT PRIMARY KEY,
    service_request_id TEXT NOT NULL,
    actor_user_id TEXT,
    actor_role TEXT NOT NULL,
    event_kind TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    meta_json TEXT NOT NULL DEFAULT '{}',
    created_at TEXT NOT NULL,
    FOREIGN KEY (service_request_id) REFERENCES service_requests (id) ON DELETE CASCADE,
    FOREIGN KEY (actor_user_id) REFERENCES users (id) ON DELETE SET NULL
  );

  CREATE TABLE IF NOT EXISTS service_request_worker_blocks (
    service_request_id TEXT NOT NULL,
    worker_user_id TEXT NOT NULL,
    requester_user_id TEXT NOT NULL,
    created_at TEXT NOT NULL,
    expires_at TEXT NOT NULL,
    PRIMARY KEY (service_request_id, worker_user_id),
    FOREIGN KEY (service_request_id) REFERENCES service_requests (id) ON DELETE CASCADE,
    FOREIGN KEY (worker_user_id) REFERENCES users (id) ON DELETE CASCADE,
    FOREIGN KEY (requester_user_id) REFERENCES users (id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS client_error_reports (
    id TEXT PRIMARY KEY,
    request_id TEXT,
    user_id TEXT,
    source TEXT NOT NULL,
    message TEXT NOT NULL,
    stack TEXT,
    path TEXT,
    user_agent TEXT,
    metadata_json TEXT NOT NULL DEFAULT '{}',
    created_at TEXT NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE SET NULL
  );

  CREATE TABLE IF NOT EXISTS support_tickets (
    id TEXT PRIMARY KEY,
    requester_user_id TEXT NOT NULL,
    assigned_admin_user_id TEXT,
    status TEXT NOT NULL DEFAULT 'waiting',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    closed_at TEXT,
    last_customer_message_at TEXT,
    last_admin_message_at TEXT,
    requester_last_seen_at TEXT,
    admin_last_seen_at TEXT,
    FOREIGN KEY (requester_user_id) REFERENCES users (id) ON DELETE CASCADE,
    FOREIGN KEY (assigned_admin_user_id) REFERENCES users (id) ON DELETE SET NULL
  );

  CREATE TABLE IF NOT EXISTS support_ticket_messages (
    id TEXT PRIMARY KEY,
    ticket_id TEXT NOT NULL,
    sender_user_id TEXT NOT NULL,
    sender_role TEXT NOT NULL,
    body TEXT NOT NULL,
    created_at TEXT NOT NULL,
    FOREIGN KEY (ticket_id) REFERENCES support_tickets (id) ON DELETE CASCADE,
    FOREIGN KEY (sender_user_id) REFERENCES users (id) ON DELETE CASCADE
  );
`);

function getUserColumnNames() {
  return new Set(
    db
      .prepare("PRAGMA table_info(users)")
      .all()
      .map((column) => column.name)
  );
}

function ensureUserColumn(columnName, definition) {
  const userColumns = getUserColumnNames();

  if (userColumns.has(columnName)) {
    return;
  }

  db.exec(`ALTER TABLE users ADD COLUMN ${columnName} ${definition}`);
}

function getOauthLoginStateColumnNames() {
  return new Set(
    db
      .prepare("PRAGMA table_info(oauth_login_states)")
      .all()
      .map((column) => column.name)
  );
}

function ensureOauthLoginStateColumn(columnName, definition) {
  const oauthLoginStateColumns = getOauthLoginStateColumnNames();

  if (oauthLoginStateColumns.has(columnName)) {
    return;
  }

  db.exec(`ALTER TABLE oauth_login_states ADD COLUMN ${columnName} ${definition}`);
}

function getServiceRequestColumnNames() {
  return new Set(
    db
      .prepare("PRAGMA table_info(service_requests)")
      .all()
      .map((column) => column.name)
  );
}

function ensureServiceRequestColumn(columnName, definition) {
  const serviceRequestColumns = getServiceRequestColumnNames();

  if (serviceRequestColumns.has(columnName)) {
    return;
  }

  db.exec(`ALTER TABLE service_requests ADD COLUMN ${columnName} ${definition}`);
}

function getServiceChatColumnNames() {
  return new Set(
    db
      .prepare("PRAGMA table_info(service_chats)")
      .all()
      .map((column) => column.name)
  );
}

function ensureServiceChatColumn(columnName, definition) {
  const serviceChatColumns = getServiceChatColumnNames();

  if (serviceChatColumns.has(columnName)) {
    return;
  }

  db.exec(`ALTER TABLE service_chats ADD COLUMN ${columnName} ${definition}`);
}

function getCommunityPostColumnNames() {
  return new Set(
    db
      .prepare("PRAGMA table_info(community_posts)")
      .all()
      .map((column) => column.name)
  );
}

function ensureCommunityPostColumn(columnName, definition) {
  const communityPostColumns = getCommunityPostColumnNames();

  if (communityPostColumns.has(columnName)) {
    return;
  }

  db.exec(`ALTER TABLE community_posts ADD COLUMN ${columnName} ${definition}`);
}

function getCommunityPostChatColumnNames() {
  return new Set(
    db
      .prepare("PRAGMA table_info(community_post_chats)")
      .all()
      .map((column) => column.name)
  );
}

function ensureCommunityPostChatColumn(columnName, definition) {
  const communityPostChatColumns = getCommunityPostChatColumnNames();

  if (communityPostChatColumns.has(columnName)) {
    return;
  }

  db.exec(`ALTER TABLE community_post_chats ADD COLUMN ${columnName} ${definition}`);
}

function getTableColumnNames(tableName) {
  return new Set(
    db
      .prepare(`PRAGMA table_info(${tableName})`)
      .all()
      .map((column) => column.name)
  );
}

function ensureTableColumn(tableName, columnName, definition) {
  const tableColumns = getTableColumnNames(tableName);

  if (tableColumns.has(columnName)) {
    return;
  }

  db.exec(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${definition}`);
}

function getUserNotificationColumnNames() {
  return new Set(
    db
      .prepare("PRAGMA table_info(user_notifications)")
      .all()
      .map((column) => column.name)
  );
}

function ensureUserNotificationColumn(columnName, definition) {
  const notificationColumns = getUserNotificationColumnNames();

  if (notificationColumns.has(columnName)) {
    return;
  }

  db.exec(`ALTER TABLE user_notifications ADD COLUMN ${columnName} ${definition}`);
}

function getWorkerWithdrawalColumnNames() {
  return new Set(
    db
      .prepare("PRAGMA table_info(worker_withdrawals)")
      .all()
      .map((column) => column.name)
  );
}

function ensureWorkerWithdrawalColumn(columnName, definition) {
  const withdrawalColumns = getWorkerWithdrawalColumnNames();

  if (withdrawalColumns.has(columnName)) {
    return;
  }

  db.exec(`ALTER TABLE worker_withdrawals ADD COLUMN ${columnName} ${definition}`);
}

function ensureDirectionalServiceReviews() {
  const indexes = db.prepare("PRAGMA index_list(service_reviews)").all();
  const hasLegacyUniqueServiceRequestIndex = indexes.some((index) => {
    if (!index?.unique) {
      return false;
    }

    const columns = db
      .prepare(`PRAGMA index_info(${JSON.stringify(index.name)})`)
      .all()
      .map((column) => column.name);

    return columns.length === 1 && columns[0] === "service_request_id";
  });

  if (!hasLegacyUniqueServiceRequestIndex) {
    db.exec(`
      CREATE UNIQUE INDEX IF NOT EXISTS service_reviews_request_target_unique_idx
      ON service_reviews (service_request_id, target_user_id);
    `);
    return;
  }

  db.exec(`
    ALTER TABLE service_reviews RENAME TO service_reviews_legacy_single;

    CREATE TABLE service_reviews (
      id TEXT PRIMARY KEY,
      service_request_id TEXT NOT NULL,
      reviewer_user_id TEXT NOT NULL,
      target_user_id TEXT NOT NULL,
      rating INTEGER NOT NULL,
      comment TEXT NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY (service_request_id) REFERENCES service_requests (id) ON DELETE CASCADE,
      FOREIGN KEY (reviewer_user_id) REFERENCES users (id) ON DELETE CASCADE,
      FOREIGN KEY (target_user_id) REFERENCES users (id) ON DELETE CASCADE
    );

    INSERT INTO service_reviews (
      id,
      service_request_id,
      reviewer_user_id,
      target_user_id,
      rating,
      comment,
      created_at
    )
    SELECT
      id,
      service_request_id,
      reviewer_user_id,
      target_user_id,
      rating,
      comment,
      created_at
    FROM service_reviews_legacy_single;

    DROP TABLE service_reviews_legacy_single;

    CREATE UNIQUE INDEX IF NOT EXISTS service_reviews_request_target_unique_idx
    ON service_reviews (service_request_id, target_user_id);
  `);
}

ensureUserColumn("cpf_digits", "TEXT NOT NULL DEFAULT ''");
ensureUserColumn("cpf_verified_at", "TEXT");
ensureUserColumn("cpf_verified_name", "TEXT");
ensureUserColumn("cpf_verification_provider", "TEXT");
ensureUserColumn("cpf_verification_checked_at", "TEXT");
ensureUserColumn("terms_accepted_at", "TEXT");
ensureUserColumn("privacy_accepted_at", "TEXT");
ensureUserColumn("legal_version", "TEXT");
ensureUserColumn("last_active_at", "TEXT");
ensureUserColumn("headline", "TEXT DEFAULT ''");
ensureUserColumn("bio", "TEXT DEFAULT ''");
ensureUserColumn("professions_json", "TEXT NOT NULL DEFAULT '[]'");
ensureUserColumn("skills_json", "TEXT NOT NULL DEFAULT '[]'");
ensureUserColumn("availability_note", "TEXT DEFAULT ''");
ensureUserColumn("asaas_customer_id", "TEXT");
ensureUserColumn("pix_withdrawal_key_type", "TEXT");
ensureUserColumn("pix_withdrawal_key", "TEXT");
ensureUserColumn("admin_flagged_at", "TEXT");
ensureUserColumn("admin_flag_reason", "TEXT");
ensureUserColumn("suspended_at", "TEXT");
ensureUserColumn("suspension_reason", "TEXT");
ensureUserColumn("auth_provider", "TEXT NOT NULL DEFAULT 'password'");
ensureUserColumn("google_subject", "TEXT");
ensureUserColumn("identity_locked_at", "TEXT");
ensureUserColumn("account_kind", "TEXT");
ensureUserColumn("deleted_at", "TEXT");
ensureUserColumn("deletion_requested_at", "TEXT");
ensureUserColumn("app_tour_completed_at", "TEXT");
ensureUserColumn("provider_verification_status", "TEXT NOT NULL DEFAULT 'not_required'");
ensureUserColumn("provider_verification_submitted_at", "TEXT");
ensureUserColumn("provider_verification_decided_at", "TEXT");
ensureUserColumn("provider_verification_requested_reason", "TEXT");
ensureUserColumn("provider_verification_decision_note", "TEXT");
ensureUserColumn("provider_verification_reviewed_by_user_id", "TEXT");
ensureUserColumn("provider_verification_document_version", "INTEGER NOT NULL DEFAULT 0");
ensureUserColumn("provider_rg_number", "TEXT NOT NULL DEFAULT ''");
ensureUserColumn("provider_face_image", "TEXT");
ensureUserColumn("provider_rg_document_image", "TEXT");
ensureOauthLoginStateColumn("return_to", "TEXT");
ensureOauthLoginStateColumn("device_id", "TEXT");
ensureOauthLoginStateColumn("device_label", "TEXT");
ensureOauthLoginStateColumn("device_platform", "TEXT");
ensureOauthLoginStateColumn("timezone", "TEXT");
ensureOauthLoginStateColumn("login_ip", "TEXT");
ensureOauthLoginStateColumn("login_location", "TEXT");
ensureTableColumn("sessions", "device_id", "TEXT");
ensureTableColumn("sessions", "device_label", "TEXT");
ensureTableColumn("sessions", "device_platform", "TEXT");
ensureTableColumn("sessions", "login_ip", "TEXT");
ensureTableColumn("sessions", "login_location", "TEXT");
ensureTableColumn("sessions", "revoked_reason", "TEXT");
ensureTableColumn("sessions", "replaced_device_label", "TEXT");
ensureTableColumn("sessions", "replaced_login_location", "TEXT");
ensureTableColumn("sessions", "replaced_at", "TEXT");

const legacyProviderRows = db
  .prepare(
    `
      SELECT id, email, account_kind, provider_verification_status
      FROM users
      WHERE account_kind = 'provider'
    `
  )
  .all();
const markLegacyProviderVerificationPending = db.prepare(
  `
    UPDATE users
    SET provider_verification_status = 'pending_documents',
        updated_at = ?
    WHERE id = ?
  `
);

for (const provider of legacyProviderRows) {
  const currentStatus = String(provider.provider_verification_status ?? "").trim();

  if (!isAdminEmail(provider.email) && (!currentStatus || currentStatus === "not_required")) {
    markLegacyProviderVerificationPending.run(new Date().toISOString(), provider.id);
  }
}

ensureServiceRequestColumn("worker_user_id", "TEXT");
ensureServiceRequestColumn("accepted_at", "TEXT");
ensureServiceRequestColumn("service_details_json", "TEXT");
ensureServiceRequestColumn("origin_community_chat_id", "TEXT");
ensureServiceRequestColumn("asaas_payment_id", "TEXT");
ensureServiceRequestColumn("asaas_payment_status", "TEXT");
ensureServiceRequestColumn("asaas_payment_invoice_url", "TEXT");
ensureServiceRequestColumn("asaas_payment_due_date", "TEXT");
ensureServiceRequestColumn("asaas_payment_expires_at", "TEXT");
ensureServiceRequestColumn("asaas_payment_copy_paste", "TEXT");
ensureServiceRequestColumn("asaas_payment_qr_code_base64", "TEXT");
ensureServiceRequestColumn("asaas_payment_received_at", "TEXT");
ensureServiceRequestColumn("worker_withdrawal_id", "TEXT");
ensureServiceRequestColumn("worker_withdrawn_at", "TEXT");
ensureServiceRequestColumn("payment_amount_subtotal_cents", "INTEGER");
ensureServiceRequestColumn("payment_amount_fee_cents", "INTEGER");
ensureServiceRequestColumn("payment_amount_total_cents", "INTEGER");
ensureServiceRequestColumn("payment_currency", "TEXT DEFAULT 'brl'");
ensureServiceRequestColumn("dispute_status", "TEXT");
ensureServiceRequestColumn("dispute_reason", "TEXT");
ensureServiceRequestColumn("disputed_by_user_id", "TEXT");
ensureServiceRequestColumn("disputed_at", "TEXT");
ensureServiceRequestColumn("dispute_resolution", "TEXT");
ensureServiceRequestColumn("dispute_resolved_at", "TEXT");
ensureServiceRequestColumn("dispute_admin_note", "TEXT");
ensureServiceRequestColumn("dispute_kind", "TEXT");
ensureServiceRequestColumn("dispute_evidence_image", "TEXT");
ensureServiceRequestColumn("dispute_provider_response", "TEXT");
ensureServiceRequestColumn("dispute_provider_responded_at", "TEXT");
ensureServiceRequestColumn("dispute_provider_acknowledged_no_show", "INTEGER NOT NULL DEFAULT 0");
ensureServiceRequestColumn("dispute_response_due_at", "TEXT");
ensureServiceRequestColumn("dispute_auto_refund_started_at", "TEXT");
ensureServiceRequestColumn("refund_status", "TEXT");
ensureServiceRequestColumn("refund_amount_cents", "INTEGER");
ensureServiceRequestColumn("refunded_at", "TEXT");
ensureServiceRequestColumn("wallet_available_at", "TEXT");
ensureCommunityPostColumn("profession", "TEXT");
ensureCommunityPostColumn("experience", "TEXT");
ensureCommunityPostColumn("duration_days", "INTEGER");
ensureCommunityPostColumn("expires_at", "TEXT");
ensureCommunityPostColumn("latitude", "REAL");
ensureCommunityPostColumn("longitude", "REAL");
ensureServiceChatColumn("requester_archived_at", "TEXT");
ensureServiceChatColumn("worker_archived_at", "TEXT");
ensureServiceChatColumn("locked_at", "TEXT");
ensureServiceChatColumn("reopened_at", "TEXT");
ensureCommunityPostChatColumn("post_author_archived_at", "TEXT");
ensureCommunityPostChatColumn("contact_archived_at", "TEXT");
ensureTableColumn("service_chat_messages", "message_type", "TEXT NOT NULL DEFAULT 'text'");
ensureTableColumn("service_chat_messages", "image_url", "TEXT");
ensureTableColumn("community_post_chat_messages", "message_type", "TEXT NOT NULL DEFAULT 'text'");
ensureTableColumn("community_post_chat_messages", "image_url", "TEXT");
ensureUserNotificationColumn("meta_json", "TEXT NOT NULL DEFAULT '{}'");
ensureTableColumn("user_push_devices", "last_attempt_at", "TEXT");
ensureTableColumn("user_push_devices", "last_success_at", "TEXT");
ensureWorkerWithdrawalColumn("mode", "TEXT NOT NULL DEFAULT 'instant'");
ensureWorkerWithdrawalColumn("gross_amount_cents", "INTEGER NOT NULL DEFAULT 0");
ensureWorkerWithdrawalColumn("fee_amount_cents", "INTEGER NOT NULL DEFAULT 0");

ensureDirectionalServiceReviews();

db.exec(`
  UPDATE service_requests
  SET wallet_available_at = COALESCE(
    (
      SELECT MIN(service_request_events.created_at)
      FROM service_request_events
      WHERE service_request_events.service_request_id = service_requests.id
        AND service_request_events.event_kind = 'service-completed'
    ),
    service_requests.updated_at,
    service_requests.created_at
  )
  WHERE service_requests.status = 'completed'
    AND service_requests.wallet_available_at IS NULL;

  UPDATE service_chats
  SET locked_at = COALESCE(
    (
      SELECT MIN(service_request_events.created_at)
      FROM service_request_events
      WHERE service_request_events.service_request_id = service_chats.service_request_id
        AND service_request_events.event_kind = 'service-completed'
    ),
    service_chats.updated_at
  )
  WHERE service_chats.locked_at IS NULL
    AND EXISTS (
      SELECT 1
      FROM service_requests
      WHERE service_requests.id = service_chats.service_request_id
        AND service_requests.status = 'completed'
    );
`);

db.exec(`
  CREATE UNIQUE INDEX IF NOT EXISTS service_requests_origin_community_chat_idx
  ON service_requests (origin_community_chat_id)
  WHERE origin_community_chat_id IS NOT NULL;

  CREATE INDEX IF NOT EXISTS service_requests_status_created_idx
  ON service_requests (status, created_at DESC);

  CREATE INDEX IF NOT EXISTS service_requests_requester_idx
  ON service_requests (requester_user_id, created_at DESC);

  CREATE INDEX IF NOT EXISTS service_requests_worker_idx
  ON service_requests (worker_user_id, created_at DESC);

  CREATE INDEX IF NOT EXISTS service_chats_requester_updated_idx
  ON service_chats (requester_user_id, updated_at DESC);

  CREATE INDEX IF NOT EXISTS service_chats_worker_updated_idx
  ON service_chats (worker_user_id, updated_at DESC);

  CREATE INDEX IF NOT EXISTS service_chat_messages_chat_created_idx
  ON service_chat_messages (chat_id, created_at ASC);

  CREATE INDEX IF NOT EXISTS community_posts_author_updated_idx
  ON community_posts (author_user_id, updated_at DESC);

  CREATE INDEX IF NOT EXISTS community_posts_public_updated_idx
  ON community_posts (archived_at, updated_at DESC);

  CREATE INDEX IF NOT EXISTS community_post_chats_author_updated_idx
  ON community_post_chats (post_author_user_id, updated_at DESC);

  CREATE INDEX IF NOT EXISTS community_post_chats_contact_updated_idx
  ON community_post_chats (contact_user_id, updated_at DESC);

  CREATE INDEX IF NOT EXISTS community_post_chat_messages_chat_created_idx
  ON community_post_chat_messages (chat_id, created_at ASC);

  CREATE INDEX IF NOT EXISTS service_reviews_target_created_idx
  ON service_reviews (target_user_id, created_at DESC);

  CREATE INDEX IF NOT EXISTS user_notifications_user_consumed_created_idx
  ON user_notifications (user_id, consumed_at, created_at ASC);

  CREATE INDEX IF NOT EXISTS user_push_devices_user_updated_idx
  ON user_push_devices (user_id, disabled_at, updated_at DESC);

  CREATE INDEX IF NOT EXISTS users_asaas_customer_idx
  ON users (asaas_customer_id);

  CREATE INDEX IF NOT EXISTS users_provider_verification_idx
  ON users (provider_verification_status, provider_verification_submitted_at DESC);

  CREATE INDEX IF NOT EXISTS password_reset_challenges_user_created_idx
  ON password_reset_challenges (user_id, created_at DESC);

  CREATE INDEX IF NOT EXISTS device_login_challenges_user_created_idx
  ON device_login_challenges (user_id, created_at DESC);

  CREATE INDEX IF NOT EXISTS trusted_login_devices_user_verified_idx
  ON trusted_login_devices (user_id, last_verified_at DESC);

  CREATE UNIQUE INDEX IF NOT EXISTS users_google_subject_idx
  ON users (google_subject)
  WHERE google_subject IS NOT NULL AND google_subject <> '';

  CREATE INDEX IF NOT EXISTS oauth_login_states_provider_state_idx
  ON oauth_login_states (provider, state_hash, consumed_at);

  CREATE INDEX IF NOT EXISTS service_requests_asaas_payment_idx
  ON service_requests (asaas_payment_id);

  CREATE INDEX IF NOT EXISTS service_requests_worker_withdrawal_idx
  ON service_requests (worker_withdrawal_id);

  CREATE INDEX IF NOT EXISTS worker_withdrawals_user_created_idx
  ON worker_withdrawals (user_id, created_at DESC);

  CREATE INDEX IF NOT EXISTS service_request_events_request_created_idx
  ON service_request_events (service_request_id, created_at ASC);

  CREATE INDEX IF NOT EXISTS service_request_worker_blocks_worker_expires_idx
  ON service_request_worker_blocks (worker_user_id, expires_at DESC);

  CREATE INDEX IF NOT EXISTS service_requests_dispute_status_idx
  ON service_requests (dispute_status, updated_at DESC);

  CREATE INDEX IF NOT EXISTS client_error_reports_created_idx
  ON client_error_reports (created_at DESC);

  CREATE INDEX IF NOT EXISTS support_tickets_requester_status_created_idx
  ON support_tickets (requester_user_id, status, created_at DESC);

  CREATE INDEX IF NOT EXISTS support_tickets_status_created_idx
  ON support_tickets (status, created_at ASC);

  CREATE INDEX IF NOT EXISTS support_ticket_messages_ticket_created_idx
  ON support_ticket_messages (ticket_id, created_at ASC);
`);

const nowTimestamp = new Date().toISOString();
const webhookRetentionCutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
const clientErrorRetentionCutoff = new Date(Date.now() - 45 * 24 * 60 * 60 * 1000).toISOString();

db.prepare(
  `
    INSERT OR IGNORE INTO trusted_login_devices (
      id,
      user_id,
      device_id,
      device_label,
      device_platform,
      first_verified_at,
      last_verified_at
    )
    SELECT
      'trusted-' || id,
      user_id,
      device_id,
      COALESCE(NULLIF(device_label, ''), 'Aparelho conhecido'),
      COALESCE(NULLIF(device_platform, ''), 'unknown'),
      created_at,
      created_at
    FROM sessions
    WHERE COALESCE(device_id, '') <> ''
  `
).run();

db.prepare(
  `
    INSERT OR IGNORE INTO blocked_account_emails (email, user_id, reason, created_at)
    SELECT LOWER(TRIM(email)), id, 'suspended', COALESCE(suspended_at, created_at, ?)
    FROM users
    WHERE suspended_at IS NOT NULL
      AND deleted_at IS NULL
      AND email NOT LIKE 'deleted-%@deleted.worqo.invalid'
  `
).run(nowTimestamp);

db.prepare(
  `
    UPDATE users
    SET identity_locked_at = COALESCE(identity_locked_at, created_at, ?)
    WHERE identity_locked_at IS NULL
      AND COALESCE(birth_date, '') <> ''
      AND phone NOT LIKE 'google:%'
  `
).run(nowTimestamp);

db.prepare(
  `
    DELETE FROM verification_codes
    WHERE consumed_at IS NOT NULL
       OR expires_at < ?
  `
).run(nowTimestamp);

db.prepare(
  `
    DELETE FROM password_reset_challenges
    WHERE consumed_at IS NOT NULL
       OR expires_at < ?
  `
).run(nowTimestamp);

db.prepare(
  `
    DELETE FROM device_login_challenges
    WHERE consumed_at IS NOT NULL
       OR expires_at < ?
  `
).run(nowTimestamp);

db.prepare(
  `
    DELETE FROM sessions
    WHERE revoked_at IS NOT NULL
       OR expires_at < ?
  `
).run(nowTimestamp);

db.prepare(
  `
    DELETE FROM oauth_login_states
    WHERE consumed_at IS NOT NULL
       OR expires_at < ?
  `
).run(nowTimestamp);

db.prepare(
  `
    DELETE FROM asaas_webhook_events
    WHERE processed_at < ?
  `
).run(webhookRetentionCutoff);

db.prepare(
  `
    DELETE FROM client_error_reports
    WHERE created_at < ?
  `
).run(clientErrorRetentionCutoff);

const usersWithCpf = db.prepare("SELECT id, cpf FROM users").all();
const updateCpfDigits = db.prepare("UPDATE users SET cpf_digits = ? WHERE id = ?");

for (const user of usersWithCpf) {
  updateCpfDigits.run(normalizeCpf(user.cpf ?? ""), user.id);
}

const duplicateCpfRows = db
  .prepare(
    `
      SELECT cpf_digits, COUNT(*) AS total
      FROM users
      WHERE cpf_digits <> ''
      GROUP BY cpf_digits
      HAVING COUNT(*) > 1
    `
  )
  .all();

if (duplicateCpfRows.length === 0) {
  db.exec(`
    CREATE UNIQUE INDEX IF NOT EXISTS users_cpf_digits_unique
    ON users (cpf_digits)
    WHERE cpf_digits <> '';
  `);
} else {
  console.warn(
    "Não foi possível criar o índice único de CPF porque existem CPFs duplicados na base."
  );
}

