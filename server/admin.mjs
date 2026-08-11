import { db } from "./db.mjs";
import { isAdminEmail } from "./config.mjs";
import { sendProviderVerificationDecisionEmail } from "./providers/email-provider.mjs";
import { HttpError } from "./utils.mjs";

const LIVE_REQUEST_STATUSES = new Set([
  "searching",
  "assigned",
  "chatting",
  "details",
  "waiting-worker",
  "payment",
  "confirmed",
]);
const OPEN_MAP_REQUEST_STATUSES = new Set(["searching", "assigned"]);
const PAID_STATUSES = new Set(["RECEIVED", "CONFIRMED"]);
const PENDING_WITHDRAWAL_STATUSES = new Set([
  "PENDING",
  "BANK_PROCESSING",
  "AWAITING_AUTORIZATION",
  "AWAITING_AUTHORIZATION",
]);
const RECENT_SIGNUP_WINDOW_DAYS = 7;
const RECENT_ACTIVE_WINDOW_HOURS = 24;

const selectAdminRequestRowsStatement = db.prepare(`
  SELECT
    service_requests.*,
    requester.full_name AS requester_name,
    requester.email AS requester_email,
    worker.full_name AS worker_name,
    worker.email AS worker_email,
    (
      SELECT COUNT(*)
      FROM service_requests AS worker_incidents
      WHERE worker_incidents.worker_user_id = service_requests.worker_user_id
        AND worker_incidents.dispute_kind = 'provider-no-show'
        AND worker_incidents.dispute_status = 'refunded'
    ) AS worker_no_show_count
  FROM service_requests
  INNER JOIN users AS requester ON requester.id = service_requests.requester_user_id
  LEFT JOIN users AS worker ON worker.id = service_requests.worker_user_id
  ORDER BY service_requests.updated_at DESC, service_requests.created_at DESC
`);

const selectRequestStatusCountsStatement = db.prepare(`
  SELECT status, COUNT(*) AS total
  FROM service_requests
  GROUP BY status
  ORDER BY total DESC, status ASC
`);

const selectAllWithdrawalsStatement = db.prepare(`
  SELECT
    worker_withdrawals.*,
    users.full_name AS user_name,
    users.email AS user_email
  FROM worker_withdrawals
  INNER JOIN users ON users.id = worker_withdrawals.user_id
  ORDER BY worker_withdrawals.created_at DESC
`);

const selectTimelineByRequestIdStatement = db.prepare(`
  SELECT *
  FROM service_request_events
  WHERE service_request_id = ?
  ORDER BY created_at ASC
`);

const selectActiveServiceChatsStatement = db.prepare(`
  SELECT
    service_chats.id,
    service_chats.service_request_id,
    service_chats.created_at,
    service_chats.updated_at,
    service_requests.category,
    service_requests.description,
    service_requests.status,
    requester.full_name AS requester_name,
    requester.email AS requester_email,
    worker.full_name AS worker_name,
    worker.email AS worker_email
  FROM service_chats
  INNER JOIN service_requests ON service_requests.id = service_chats.service_request_id
  INNER JOIN users AS requester ON requester.id = service_chats.requester_user_id
  INNER JOIN users AS worker ON worker.id = service_chats.worker_user_id
  WHERE service_chats.locked_at IS NULL
    AND service_requests.status IN ('assigned', 'chatting', 'details', 'waiting-worker', 'payment', 'confirmed')
  ORDER BY service_chats.updated_at DESC
`);

const selectActiveCommunityChatsStatement = db.prepare(`
  SELECT
    community_post_chats.id,
    NULL AS service_request_id,
    community_post_chats.created_at,
    community_post_chats.updated_at,
    community_posts.category,
    community_posts.content AS description,
    'conversation' AS status,
    contact.full_name AS requester_name,
    contact.email AS requester_email,
    author.full_name AS worker_name,
    author.email AS worker_email
  FROM community_post_chats
  INNER JOIN community_posts ON community_posts.id = community_post_chats.post_id
  INNER JOIN users AS contact ON contact.id = community_post_chats.contact_user_id
  INNER JOIN users AS author ON author.id = community_post_chats.post_author_user_id
  WHERE community_posts.archived_at IS NULL
  ORDER BY community_post_chats.updated_at DESC
`);

const selectAdminServiceChatMessagesStatement = db.prepare(`
  SELECT
    service_chat_messages.id,
    service_chat_messages.body,
    service_chat_messages.message_type,
    service_chat_messages.image_url,
    service_chat_messages.created_at,
    users.full_name AS sender_name
  FROM service_chat_messages
  INNER JOIN users ON users.id = service_chat_messages.sender_user_id
  WHERE service_chat_messages.chat_id = ?
  ORDER BY service_chat_messages.created_at ASC
`);

const selectAdminCommunityChatMessagesStatement = db.prepare(`
  SELECT
    community_post_chat_messages.id,
    community_post_chat_messages.body,
    community_post_chat_messages.message_type,
    community_post_chat_messages.image_url,
    community_post_chat_messages.created_at,
    users.full_name AS sender_name
  FROM community_post_chat_messages
  INNER JOIN users ON users.id = community_post_chat_messages.sender_user_id
  WHERE community_post_chat_messages.chat_id = ?
  ORDER BY community_post_chat_messages.created_at ASC
`);

const selectAdminUserRowsStatement = db.prepare(`
  SELECT
    users.id,
    users.full_name,
    users.email,
    users.phone,
    users.avatar,
    users.headline,
    users.created_at,
    users.updated_at,
    users.last_active_at,
    users.verified_channel,
    users.email_verified_at,
    users.cpf_verified_at,
    users.profile_setup_completed_at,
    users.pix_withdrawal_key_type,
    users.pix_withdrawal_key,
    users.admin_flagged_at,
    users.admin_flag_reason,
    users.suspended_at,
    users.suspension_reason,
    (
      SELECT COUNT(*)
      FROM service_requests
      WHERE requester_user_id = users.id
    ) AS requests_created_count,
    (
      SELECT COUNT(*)
      FROM service_requests
      WHERE worker_user_id = users.id
    ) AS jobs_taken_count,
    (
      SELECT COUNT(*)
      FROM service_requests
      WHERE worker_user_id = users.id
        AND status = 'completed'
    ) AS completed_services_count,
    (
      SELECT COUNT(*)
      FROM support_tickets
      WHERE requester_user_id = users.id
        AND status IN ('waiting', 'active')
    ) AS open_support_tickets,
    (
      SELECT COUNT(*)
      FROM service_requests
      WHERE (requester_user_id = users.id OR worker_user_id = users.id)
        AND status IN ('searching', 'assigned', 'chatting', 'details', 'waiting-worker', 'payment', 'confirmed')
    ) AS active_service_flows
  FROM users
  WHERE users.deleted_at IS NULL
  ORDER BY users.created_at DESC, users.updated_at DESC
`);

const selectSupportOverviewStatement = db.prepare(`
  SELECT
    COUNT(*) AS total_tickets,
    SUM(CASE WHEN status = 'waiting' THEN 1 ELSE 0 END) AS waiting_tickets,
    SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) AS active_tickets,
    SUM(CASE WHEN status = 'closed' THEN 1 ELSE 0 END) AS closed_tickets,
    MAX(created_at) AS latest_opened_at,
    MAX(last_customer_message_at) AS latest_customer_message_at
  FROM support_tickets
`);

const providerVerificationSelect = `
  SELECT
    users.id,
    users.full_name,
    users.email,
    users.phone,
    users.birth_date,
    users.cpf,
    users.cpf_digits,
    users.avatar,
    users.headline,
    users.created_at,
    users.updated_at,
    users.email_verified_at,
    users.cpf_verified_at,
    users.profile_setup_completed_at,
    users.provider_verification_status,
    users.provider_verification_submitted_at,
    users.provider_verification_decided_at,
    users.provider_verification_requested_reason,
    users.provider_verification_decision_note,
    users.provider_verification_document_version,
    users.provider_rg_number,
    users.provider_face_image,
    users.provider_rg_document_image,
    reviewer.full_name AS provider_verification_reviewer_name
  FROM users
  LEFT JOIN users AS reviewer
    ON reviewer.id = users.provider_verification_reviewed_by_user_id
`;

const selectProviderVerificationRowsStatement = db.prepare(`
  ${providerVerificationSelect}
  WHERE users.account_kind = 'provider'
    AND users.deleted_at IS NULL
  ORDER BY
    CASE users.provider_verification_status
      WHEN 'under_review' THEN 0
      WHEN 'changes_requested' THEN 1
      WHEN 'pending_documents' THEN 2
      WHEN 'rejected' THEN 3
      WHEN 'approved' THEN 4
      ELSE 5
    END,
    users.provider_verification_submitted_at DESC,
    users.created_at DESC
`);

const selectProviderVerificationRowByIdStatement = db.prepare(`
  ${providerVerificationSelect}
  WHERE users.id = ?
    AND users.account_kind = 'provider'
    AND users.deleted_at IS NULL
  LIMIT 1
`);

const updateProviderVerificationStatement = db.prepare(`
  UPDATE users
  SET
    provider_verification_status = ?,
    provider_verification_decided_at = ?,
    provider_verification_requested_reason = ?,
    provider_verification_decision_note = ?,
    provider_verification_reviewed_by_user_id = ?,
    cpf_verified_at = CASE WHEN ? = 'approved' THEN COALESCE(cpf_verified_at, ?) ELSE cpf_verified_at END,
    cpf_verified_name = CASE WHEN ? = 'approved' THEN full_name ELSE cpf_verified_name END,
    cpf_verification_provider = CASE WHEN ? = 'approved' THEN 'worko-admin-review' ELSE cpf_verification_provider END,
    cpf_verification_checked_at = CASE WHEN ? = 'approved' THEN ? ELSE cpf_verification_checked_at END,
    pix_withdrawal_key_type = CASE
      WHEN ? = 'approved' AND COALESCE(pix_withdrawal_key_type, '') = '' THEN 'CPF'
      ELSE pix_withdrawal_key_type
    END,
    pix_withdrawal_key = CASE
      WHEN ? = 'approved' AND COALESCE(pix_withdrawal_key, '') = '' THEN cpf_digits
      ELSE pix_withdrawal_key
    END,
    updated_at = ?
  WHERE id = ?
`);

function isRecentWithinDays(value, days) {
  if (!value) {
    return false;
  }

  const timestamp = new Date(value).getTime();

  if (Number.isNaN(timestamp)) {
    return false;
  }

  return Date.now() - timestamp <= days * 24 * 60 * 60 * 1000;
}

function isRecentWithinHours(value, hours) {
  if (!value) {
    return false;
  }

  const timestamp = new Date(value).getTime();

  if (Number.isNaN(timestamp)) {
    return false;
  }

  return Date.now() - timestamp <= hours * 60 * 60 * 1000;
}

function mapDispute(row) {
  const status = String(row.dispute_status ?? "").trim().toLowerCase();

  if (!status) {
    return null;
  }

  return {
    status:
      status === "open" || status === "resolved" || status === "refunded" ? status : null,
    kind: row.dispute_kind === "provider-no-show" ? "provider-no-show" : "general",
    reason: row.dispute_reason ?? "",
    openedAt: row.disputed_at ?? null,
    openedByUserId: row.disputed_by_user_id ?? null,
    evidenceImage: row.dispute_evidence_image ?? null,
    providerResponse: row.dispute_provider_response ?? null,
    providerRespondedAt: row.dispute_provider_responded_at ?? null,
    providerAcknowledgedNoShow: Boolean(row.dispute_provider_acknowledged_no_show),
    responseDueAt: row.dispute_response_due_at ?? null,
    resolution: row.dispute_resolution ?? null,
    resolvedAt: row.dispute_resolved_at ?? null,
    adminNote: row.dispute_admin_note ?? null,
  };
}

function mapTimelineEvent(row) {
  return {
    id: row.id,
    kind: row.event_kind,
    actorRole: row.actor_role,
    title: row.title,
    description: row.description,
    createdAt: row.created_at,
  };
}

function parseAgreementTitle(value) {
  if (!value) {
    return "";
  }

  try {
    const parsed = JSON.parse(value);
    return typeof parsed?.title === "string"
      ? parsed.title.trim().replace(/\s+/g, " ").slice(0, 80)
      : "";
  } catch {
    return "";
  }
}

function mapWithdrawal(row) {
  return {
    id: row.id,
    userId: row.user_id,
    userName: row.user_name ?? "Profissional",
    userEmail: row.user_email ?? "",
    providerTransferId: row.provider_transfer_id,
    mode: row.mode ?? "instant",
    grossAmountCents: Number(row.gross_amount_cents) || 0,
    feeAmountCents: Number(row.fee_amount_cents) || 0,
    amountCents: Number(row.amount_cents) || 0,
    currency: row.currency ?? "brl",
    status: String(row.status ?? "").trim().toUpperCase(),
    pixKeyType: row.pix_key_type ?? null,
    pixKeyMasked: row.pix_key ?? "",
    description: row.description ?? "",
    createdAt: row.created_at ?? "",
    updatedAt: row.updated_at ?? "",
  };
}

function mapUser(row) {
  return {
    id: row.id,
    fullName: row.full_name,
    email: row.email,
    phone: row.phone,
    avatar: row.avatar ?? null,
    headline: row.headline ?? "",
    createdAt: row.created_at ?? "",
    updatedAt: row.updated_at ?? "",
    lastActiveAt: row.last_active_at ?? null,
    verifiedChannel: row.verified_channel ?? null,
    emailVerifiedAt: row.email_verified_at ?? null,
    cpfVerifiedAt: row.cpf_verified_at ?? null,
    profileCompletedAt: row.profile_setup_completed_at ?? null,
    hasPixKeyConfigured: Boolean(row.pix_withdrawal_key_type && row.pix_withdrawal_key),
    isAdmin: isAdminEmail(row.email),
    isFlagged: Boolean(row.admin_flagged_at),
    flaggedAt: row.admin_flagged_at ?? null,
    flagReason: row.admin_flag_reason ?? null,
    isSuspended: Boolean(row.suspended_at),
    suspendedAt: row.suspended_at ?? null,
    suspensionReason: row.suspension_reason ?? null,
    requestsCreatedCount: Number(row.requests_created_count) || 0,
    jobsTakenCount: Number(row.jobs_taken_count) || 0,
    completedServicesCount: Number(row.completed_services_count) || 0,
    openSupportTickets: Number(row.open_support_tickets) || 0,
    activeServiceFlows: Number(row.active_service_flows) || 0,
  };
}

function mapProviderVerification(row, includeDocuments = true) {
  return {
    id: row.id,
    fullName: row.full_name,
    email: row.email,
    phone: row.phone,
    birthDate: row.birth_date,
    cpf: row.cpf,
    avatar: row.avatar ?? null,
    headline: row.headline ?? "",
    createdAt: row.created_at ?? "",
    updatedAt: row.updated_at ?? "",
    emailVerifiedAt: row.email_verified_at ?? null,
    cpfVerifiedAt: row.cpf_verified_at ?? null,
    profileCompletedAt: row.profile_setup_completed_at ?? null,
    status: row.provider_verification_status ?? "pending_documents",
    submittedAt: row.provider_verification_submitted_at ?? null,
    decidedAt: row.provider_verification_decided_at ?? null,
    requestedReason: row.provider_verification_requested_reason ?? null,
    decisionNote: row.provider_verification_decision_note ?? null,
    documentVersion: Number(row.provider_verification_document_version) || 0,
    rgNumber: row.provider_rg_number ?? "",
    faceImage: includeDocuments ? row.provider_face_image ?? null : null,
    rgDocumentImage: includeDocuments ? row.provider_rg_document_image ?? null : null,
    reviewerName: row.provider_verification_reviewer_name ?? null,
  };
}

const updateUserAdminStateStatement = db.prepare(`
  UPDATE users
  SET
    admin_flagged_at = ?,
    admin_flag_reason = ?,
    suspended_at = ?,
    suspension_reason = ?,
    updated_at = ?
  WHERE id = ?
`);

const blockSuspendedAccountEmailStatement = db.prepare(`
  INSERT INTO blocked_account_emails (email, user_id, reason, created_at)
  VALUES (?, ?, 'suspended', ?)
  ON CONFLICT(email) DO UPDATE SET
    user_id = excluded.user_id,
    reason = excluded.reason
`);

const selectAdminUserRowByIdStatement = db.prepare(`
  SELECT
    users.id,
    users.full_name,
    users.email,
    users.phone,
    users.avatar,
    users.headline,
    users.created_at,
    users.updated_at,
    users.last_active_at,
    users.verified_channel,
    users.email_verified_at,
    users.cpf_verified_at,
    users.profile_setup_completed_at,
    users.pix_withdrawal_key_type,
    users.pix_withdrawal_key,
    users.admin_flagged_at,
    users.admin_flag_reason,
    users.suspended_at,
    users.suspension_reason,
    (
      SELECT COUNT(*)
      FROM service_requests
      WHERE requester_user_id = users.id
    ) AS requests_created_count,
    (
      SELECT COUNT(*)
      FROM service_requests
      WHERE worker_user_id = users.id
    ) AS jobs_taken_count,
    (
      SELECT COUNT(*)
      FROM service_requests
      WHERE worker_user_id = users.id
        AND status = 'completed'
    ) AS completed_services_count,
    (
      SELECT COUNT(*)
      FROM support_tickets
      WHERE requester_user_id = users.id
        AND status IN ('waiting', 'active')
    ) AS open_support_tickets,
    (
      SELECT COUNT(*)
      FROM service_requests
      WHERE (requester_user_id = users.id OR worker_user_id = users.id)
        AND status IN ('searching', 'assigned', 'chatting', 'details', 'waiting-worker', 'payment', 'confirmed')
    ) AS active_service_flows
  FROM users
  WHERE users.id = ?
  LIMIT 1
`);

function buildOverview(requestRows, withdrawals, users, supportOverviewRow, providerVerifications) {
  const grossVolumeCents = requestRows.reduce((total, row) => {
    const paymentStatus = String(row.asaas_payment_status ?? "").trim().toUpperCase();
    return PAID_STATUSES.has(paymentStatus)
      ? total + (Number(row.payment_amount_total_cents) || 0)
      : total;
  }, 0);

  const feeVolumeCents = requestRows.reduce((total, row) => {
    const paymentStatus = String(row.asaas_payment_status ?? "").trim().toUpperCase();
    return PAID_STATUSES.has(paymentStatus)
      ? total + (Number(row.payment_amount_fee_cents) || 0)
      : total;
  }, 0);

  return {
    totalUsers: users.length,
    newUsers7d: users.filter((user) => isRecentWithinDays(user.createdAt, RECENT_SIGNUP_WINDOW_DAYS))
      .length,
    verifiedUsers: users.filter((user) => Boolean(user.cpfVerifiedAt)).length,
    emailVerifiedUsers: users.filter((user) => Boolean(user.emailVerifiedAt)).length,
    profileCompletedUsers: users.filter((user) => Boolean(user.profileCompletedAt)).length,
    activeUsers24h: users.filter((user) => isRecentWithinHours(user.lastActiveAt, RECENT_ACTIVE_WINDOW_HOURS))
      .length,
    openRequests: requestRows.filter((row) => LIVE_REQUEST_STATUSES.has(row.status)).length,
    openMapRequests: requestRows.filter((row) => OPEN_MAP_REQUEST_STATUSES.has(row.status)).length,
    confirmedServices: requestRows.filter((row) => row.status === "confirmed").length,
    openDisputes: requestRows.filter(
      (row) => String(row.dispute_status ?? "").trim().toLowerCase() === "open"
    ).length,
    supportOpenTickets:
      (Number(supportOverviewRow.waiting_tickets) || 0) +
      (Number(supportOverviewRow.active_tickets) || 0),
    pendingWithdrawals: withdrawals.filter((withdrawal) =>
      PENDING_WITHDRAWAL_STATUSES.has(withdrawal.status)
    ).length,
    grossVolumeCents,
    feeVolumeCents,
    pendingProviderVerifications: providerVerifications.filter(
      (provider) => provider.status === "under_review"
    ).length,
  };
}

function mapAdminActiveChat(row, kind) {
  const messages = (kind === "service"
    ? selectAdminServiceChatMessagesStatement
    : selectAdminCommunityChatMessagesStatement
  ).all(row.id);

  return {
    id: row.id,
    kind,
    serviceRequestId: row.service_request_id ?? null,
    category: row.category ?? "Atendimento",
    description: row.description ?? "",
    status: row.status ?? "conversation",
    requesterName: row.requester_name ?? "Cliente",
    requesterEmail: row.requester_email ?? "",
    workerName: row.worker_name ?? "Prestador(a)",
    workerEmail: row.worker_email ?? "",
    createdAt: row.created_at ?? "",
    updatedAt: row.updated_at ?? "",
    messages: messages.map((message) => ({
      id: message.id,
      senderName: message.sender_name ?? "Usuário(a)",
      body: message.body ?? "",
      messageType: message.message_type === "image" ? "image" : "text",
      imageUrl: message.image_url ?? null,
      createdAt: message.created_at ?? "",
    })),
  };
}

export function getAdminDashboard({ includeProviderDocuments = false } = {}) {
  const requestRows = selectAdminRequestRowsStatement.all();
  const requestStatusCounts = selectRequestStatusCountsStatement.all().map((row) => ({
    status: row.status,
    total: Number(row.total) || 0,
  }));
  const withdrawals = selectAllWithdrawalsStatement.all().map(mapWithdrawal);
  const users = selectAdminUserRowsStatement
    .all()
    .map(mapUser)
    .filter((user) => !user.isAdmin);
  const supportOverviewRow = selectSupportOverviewStatement.get() ?? {};
  const providerVerifications = selectProviderVerificationRowsStatement
    .all()
    .filter((provider) => !isAdminEmail(provider.email))
    .map((provider) => mapProviderVerification(provider, includeProviderDocuments));

  return {
    overview: buildOverview(
      requestRows,
      withdrawals,
      users,
      supportOverviewRow,
      providerVerifications
    ),
    requestStatusCounts,
    requests: requestRows.map((row) => ({
      id: row.id,
      category: row.category,
      agreementTitle: parseAgreementTitle(row.service_details_json),
      description: row.description,
      status: row.status,
      requesterName: row.requester_name ?? "Cliente",
      requesterEmail: row.requester_email ?? "",
      workerName: row.worker_name ?? null,
      workerEmail: row.worker_email ?? null,
      workerNoShowCount: Number(row.worker_no_show_count) || 0,
      latitude: Number(row.latitude) || 0,
      longitude: Number(row.longitude) || 0,
      accuracy: Number(row.accuracy) || null,
      locationLabel: row.location_label || null,
      createdAt: row.created_at ?? "",
      updatedAt: row.updated_at ?? "",
      subtotalCents: Number(row.payment_amount_subtotal_cents) || 0,
      feeCents: Number(row.payment_amount_fee_cents) || 0,
      totalCents: Number(row.payment_amount_total_cents) || 0,
      paymentStatus: row.asaas_payment_status ?? null,
      dispute: mapDispute(row),
      timeline: selectTimelineByRequestIdStatement.all(row.id).map(mapTimelineEvent),
    })),
    activeChats: [
      ...selectActiveServiceChatsStatement.all().map((row) => mapAdminActiveChat(row, "service")),
      ...selectActiveCommunityChatsStatement.all().map((row) => mapAdminActiveChat(row, "community")),
    ].sort((left, right) => new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime()),
    users,
    providerVerifications,
    supportOverview: {
      totalTickets: Number(supportOverviewRow.total_tickets) || 0,
      waitingTickets: Number(supportOverviewRow.waiting_tickets) || 0,
      activeTickets: Number(supportOverviewRow.active_tickets) || 0,
      closedTickets: Number(supportOverviewRow.closed_tickets) || 0,
      latestOpenedAt: supportOverviewRow.latest_opened_at ?? null,
      latestCustomerMessageAt: supportOverviewRow.latest_customer_message_at ?? null,
    },
    withdrawals,
  };
}

export async function updateProviderVerification(adminUserId, providerUserId, { action, reason }) {
  const provider = selectProviderVerificationRowByIdStatement.get(providerUserId);

  if (!provider || isAdminEmail(provider.email)) {
    throw new HttpError(404, "Prestador(a) não encontrado(a) para verificação.");
  }

  const normalizedAction = String(action ?? "").trim().toLowerCase();
  const normalizedReason = String(reason ?? "").trim().replace(/\s+/g, " ").slice(0, 500);
  const currentStatus = String(provider.provider_verification_status ?? "pending_documents");
  const timestamp = new Date().toISOString();
  let nextStatus;

  if (normalizedAction === "approve") {
    if (currentStatus !== "under_review") {
      throw new HttpError(409, "Somente documentos em análise podem ser aprovados.");
    }

    if (
      !provider.cpf_digits ||
      !provider.provider_rg_number ||
      !provider.provider_face_image ||
      !provider.provider_rg_document_image
    ) {
      throw new HttpError(409, "O cadastro não possui todos os documentos obrigatórios.");
    }

    nextStatus = "approved";
  } else if (normalizedAction === "request-documents") {
    if (!["pending_documents", "under_review", "changes_requested"].includes(currentStatus)) {
      throw new HttpError(409, "Este cadastro não aceita uma nova solicitação de documentos.");
    }

    if (normalizedReason.length < 4) {
      throw new HttpError(400, "Explique quais documentos precisam ser enviados novamente.");
    }

    nextStatus = "changes_requested";
  } else if (normalizedAction === "reject") {
    if (!["under_review", "changes_requested", "pending_documents"].includes(currentStatus)) {
      throw new HttpError(409, "Este cadastro já possui uma decisão final.");
    }

    if (normalizedReason.length < 4) {
      throw new HttpError(400, "Informe o motivo da recusa do cadastro.");
    }

    nextStatus = "rejected";
  } else {
    throw new HttpError(400, "Ação de verificação de prestador(a) inválida.");
  }

  const decidedAt = nextStatus === "changes_requested" ? null : timestamp;
  const requestedReason = nextStatus === "changes_requested" ? normalizedReason : null;
  const decisionNote = nextStatus === "changes_requested" ? null : normalizedReason || null;

  updateProviderVerificationStatement.run(
    nextStatus,
    decidedAt,
    requestedReason,
    decisionNote,
    adminUserId,
    nextStatus,
    timestamp,
    nextStatus,
    nextStatus,
    nextStatus,
    timestamp,
    nextStatus,
    nextStatus,
    timestamp,
    providerUserId
  );

  let emailDelivery;

  try {
    emailDelivery = await sendProviderVerificationDecisionEmail({
      email: provider.email,
      fullName: provider.full_name,
      decision: nextStatus,
      reason: normalizedReason,
    });
  } catch (error) {
    console.error("Provider verification decision email failed.", {
      providerUserId,
      decision: nextStatus,
      error: error instanceof Error ? error.message : String(error),
    });
    emailDelivery = { provider: "failed" };
  }

  return {
    provider: mapProviderVerification(selectProviderVerificationRowByIdStatement.get(providerUserId)),
    emailDelivery,
  };
}

export function updateAdminUserState(userId, { action, reason }) {
  const userRow = selectAdminUserRowByIdStatement.get(userId);

  if (!userRow) {
    throw new HttpError(404, "Usuário(a) não encontrado(a) para administração.");
  }

  if (isAdminEmail(userRow.email)) {
    throw new HttpError(409, "Não é permitido alterar o estado da conta administradora principal.");
  }

  const normalizedAction = String(action ?? "").trim().toLowerCase();
  const normalizedReason = String(reason ?? "").trim().slice(0, 240) || null;
  const timestamp = new Date().toISOString();

  let nextFlaggedAt = userRow.admin_flagged_at ?? null;
  let nextFlagReason = userRow.admin_flag_reason ?? null;
  let nextSuspendedAt = userRow.suspended_at ?? null;
  let nextSuspensionReason = userRow.suspension_reason ?? null;

  if (normalizedAction === "flag") {
    nextFlaggedAt = timestamp;
    nextFlagReason = normalizedReason;
  } else if (normalizedAction === "clear-flag") {
    nextFlaggedAt = null;
    nextFlagReason = null;
  } else if (normalizedAction === "suspend") {
    nextSuspendedAt = timestamp;
    nextSuspensionReason = normalizedReason;
  } else if (normalizedAction === "reinstate") {
    nextSuspendedAt = null;
    nextSuspensionReason = null;
  } else {
    throw new HttpError(400, "Ação administrativa inválida para este(a) usuário(a).");
  }

  updateUserAdminStateStatement.run(
    nextFlaggedAt,
    nextFlagReason,
    nextSuspendedAt,
    nextSuspensionReason,
    timestamp,
    userId
  );

  if (normalizedAction === "suspend") {
    blockSuspendedAccountEmailStatement.run(
      String(userRow.email ?? "").trim().toLowerCase(),
      userId,
      timestamp
    );
  }

  return mapUser(selectAdminUserRowByIdStatement.get(userId));
}

export function assertAdminUser(user) {
  if (!user?.isAdmin) {
    throw new HttpError(403, "Este acesso é restrito ao painel administrativo do Worko.");
  }
}


