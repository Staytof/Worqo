import { db } from "./db.mjs";
import { isAdminEmail } from "./config.mjs";
import { createUserNotification } from "./notifications.mjs";
import { createId, nowIso } from "./security.mjs";
import { HttpError } from "./utils.mjs";

const ACTIVE_SUPPORT_STATUSES = new Set(["waiting", "active"]);

const supportTicketSelection = `
  SELECT
    support_tickets.*,
    requester.full_name AS requester_name,
    requester.email AS requester_email,
    requester.avatar AS requester_avatar,
    admin.full_name AS assigned_admin_name,
    admin.avatar AS assigned_admin_avatar
  FROM support_tickets
  INNER JOIN users AS requester ON requester.id = support_tickets.requester_user_id
  LEFT JOIN users AS admin ON admin.id = support_tickets.assigned_admin_user_id
`;

const selectOpenSupportTicketByRequesterStatement = db.prepare(`
  ${supportTicketSelection}
  WHERE support_tickets.requester_user_id = ?
    AND support_tickets.status IN ('waiting', 'active')
  ORDER BY support_tickets.created_at ASC
  LIMIT 1
`);

const selectLatéstSupportTicketByRequesterStatement = db.prepare(`
  ${supportTicketSelection}
  WHERE support_tickets.requester_user_id = ?
  ORDER BY
    CASE
      WHEN support_tickets.status IN ('waiting', 'active') THEN 0
      ELSE 1
    END ASC,
    support_tickets.updated_at DESC,
    support_tickets.created_at DESC
  LIMIT 1
`);

const selectSupportTicketByIdForRequesterStatement = db.prepare(`
  ${supportTicketSelection}
  WHERE support_tickets.id = ?
    AND support_tickets.requester_user_id = ?
  LIMIT 1
`);

const selectSupportTicketByIdForAdminStatement = db.prepare(`
  ${supportTicketSelection}
  WHERE support_tickets.id = ?
  LIMIT 1
`);

const selectOpenSupportTicketsStatement = db.prepare(`
  ${supportTicketSelection}
  WHERE support_tickets.status IN ('waiting', 'active')
  ORDER BY support_tickets.created_at ASC
  LIMIT 80
`);

const selectSupportTicketMessagesByTicketIdStatement = db.prepare(`
  SELECT
    support_ticket_messages.*,
    sender.full_name AS sender_name,
    sender.avatar AS sender_avatar
  FROM support_ticket_messages
  INNER JOIN users AS sender ON sender.id = support_ticket_messages.sender_user_id
  WHERE support_ticket_messages.ticket_id = ?
  ORDER BY support_ticket_messages.created_at ASC
`);

const countSupportQueueAheadStatement = db.prepare(`
  SELECT COUNT(*) AS total
  FROM support_tickets
  WHERE status = 'waiting'
    AND created_at < ?
`);

const countWaitingSupportTicketsStatement = db.prepare(`
  SELECT COUNT(*) AS total
  FROM support_tickets
  WHERE status = 'waiting'
`);

const selectAdminUsersStatement = db.prepare(`
  SELECT id, email
  FROM users
`);

const insertSupportTicketStatement = db.prepare(`
  INSERT INTO support_tickets (
    id,
    requester_user_id,
    assigned_admin_user_id,
    status,
    created_at,
    updated_at,
    closed_at,
    last_customer_message_at,
    last_admin_message_at,
    requester_last_seen_at,
    admin_last_seen_at
  ) VALUES (?, ?, NULL, 'waiting', ?, ?, NULL, NULL, NULL, ?, NULL)
`);

const insertSupportTicketMessageStatement = db.prepare(`
  INSERT INTO support_ticket_messages (
    id,
    ticket_id,
    sender_user_id,
    sender_role,
    body,
    created_at
  ) VALUES (?, ?, ?, ?, ?, ?)
`);

const touchSupportTicketForRequesterStatement = db.prepare(`
  UPDATE support_tickets
  SET
    updated_at = ?,
    last_customer_message_at = ?,
    requester_last_seen_at = ?
  WHERE id = ?
`);

const touchSupportTicketForAdminStatement = db.prepare(`
  UPDATE support_tickets
  SET
    assigned_admin_user_id = ?,
    status = 'active',
    updated_at = ?,
    last_admin_message_at = ?,
    admin_last_seen_at = ?
  WHERE id = ?
`);

const markSupportTicketSeenByRequesterStatement = db.prepare(`
  UPDATE support_tickets
  SET requester_last_seen_at = ?
  WHERE id = ?
`);

const markSupportTicketSeenByAdminStatement = db.prepare(`
  UPDATE support_tickets
  SET admin_last_seen_at = ?
  WHERE id = ?
`);

const closeSupportTicketStatement = db.prepare(`
  UPDATE support_tickets
  SET
    assigned_admin_user_id = ?,
    status = 'closed',
    updated_at = ?,
    closed_at = ?,
    admin_last_seen_at = ?
  WHERE id = ?
`);

function normalizeSupportStatus(value) {
  const normalized = String(value ?? "").trim().toLowerCase();
  return normalized === "active" || normalized === "closed" ? normalized : "waiting";
}

function normalizeSupportMessageBody(body) {
  const normalized = String(body ?? "").replace(/\r\n/g, "\n").trim();

  if (!normalized) {
    throw new HttpError(400, "Digite uma mensagem para continuar no suporte.");
  }

  return normalized.slice(0, 1600);
}

function mapSupportMessage(row) {
  const isAdminMessage = row.sender_role === "admin";

  return {
    id: row.id,
    senderUserId: row.sender_user_id,
    senderRole: isAdminMessage ? "admin" : "requester",
    senderName: isAdminMessage ? "Administração" : row.sender_name ?? "Cliente",
    senderAvatar: row.sender_avatar ?? null,
    body: row.body ?? "",
    createdAt: row.created_at ?? "",
  };
}

function getSupportQueueAheadCount(createdAt) {
  return Number(countSupportQueueAheadStatement.get(createdAt)?.total ?? 0);
}

function getRealSupportQueueCount() {
  return Number(countWaitingSupportTicketsStatement.get()?.total ?? 0);
}

function getAdminUserIds() {
  return selectAdminUsersStatement
    .all()
    .filter((user) => isAdminEmail(user.email))
    .map((user) => user.id);
}

function isSupportAdminUser(userId) {
  const user = db.prepare("SELECT email FROM users WHERE id = ?").get(userId);
  return Boolean(user && isAdminEmail(user.email));
}

function notifyAdminsAboutSupport(ticketId, requesterUserId, message, title = "Nova mensagem no SAC") {
  const normalizedMessage = String(message ?? "").trim();

  for (const adminUserId of getAdminUserIds()) {
    if (adminUserId === requesterUserId) {
      continue;
    }

    createUserNotification(
      adminUserId,
      "support-message",
      normalizedMessage || "Novo atendimento aguardando no SAC.",
      {
        title,
        ticketId,
        path: "/app/admin",
      }
    );
  }
}

function notifyRequesterAboutSupportReply(ticket, message) {
  createUserNotification(
    ticket.requester_user_id,
    "support-message",
    String(message ?? "").trim() || "O suporte respondeu seu atendimento.",
    {
      title: "Resposta do SAC",
      ticketId: ticket.id,
      path: "/app/profile/support",
    }
  );
}

function mapSupportTicket(row) {
  if (!row) {
    return null;
  }

  const status = normalizeSupportStatus(row.status);

  return {
    id: row.id,
    status,
    createdAt: row.created_at ?? "",
    updatedAt: row.updated_at ?? "",
    closedAt: row.closed_at ?? null,
    lastCustomerMessageAt: row.last_customer_message_at ?? null,
    lastAdminMessageAt: row.last_admin_message_at ?? null,
    requesterUserId: row.requester_user_id,
    requesterName: row.requester_name ?? "Cliente",
    requesterEmail: row.requester_email ?? "",
    requesterAvatar: row.requester_avatar ?? null,
    assignedAdminUserId: row.assigned_admin_user_id ?? null,
    assignedAdminName: row.assigned_admin_name ?? null,
    assignedAdminAvatar: row.assigned_admin_avatar ?? null,
    queueAheadCount: status === "closed" ? 0 : getSupportQueueAheadCount(row.created_at ?? ""),
    messages: selectSupportTicketMessagesByTicketIdStatement.all(row.id).map(mapSupportMessage),
  };
}

function getOpenSupportTicketByRequester(userId) {
  return selectOpenSupportTicketByRequesterStatement.get(userId);
}

function getSupportTicketByIdForRequester(userId, ticketId) {
  return selectSupportTicketByIdForRequesterStatement.get(ticketId, userId);
}

function getSupportTicketByIdForAdmin(ticketId) {
  return selectSupportTicketByIdForAdminStatement.get(ticketId);
}

export function getSupportTicketForUser(userId) {
  if (isSupportAdminUser(userId)) {
    return null;
  }

  const openTicket = getOpenSupportTicketByRequester(userId);

  if (openTicket) {
    markSupportTicketSeenByRequesterStatement.run(nowIso(), openTicket.id);
    return mapSupportTicket(getSupportTicketByIdForRequester(userId, openTicket.id));
  }

  const latestTicket = selectLatéstSupportTicketByRequesterStatement.get(userId);

  if (!latestTicket) {
    return null;
  }

  markSupportTicketSeenByRequesterStatement.run(nowIso(), latestTicket.id);
  return mapSupportTicket(getSupportTicketByIdForRequester(userId, latestTicket.id));
}

export function openSupportTicketForUser(userId) {
  if (isSupportAdminUser(userId)) {
    throw new HttpError(403, "Administradores atendem o SAC pelo painel e não entram na fila.");
  }

  const existingOpenTicket = getOpenSupportTicketByRequester(userId);

  if (existingOpenTicket) {
    markSupportTicketSeenByRequesterStatement.run(nowIso(), existingOpenTicket.id);
    return mapSupportTicket(getSupportTicketByIdForRequester(userId, existingOpenTicket.id));
  }

  const timestamp = nowIso();
  const ticketId = createId();

  insertSupportTicketStatement.run(ticketId, userId, timestamp, timestamp, timestamp);
  notifyAdminsAboutSupport(
    ticketId,
    userId,
    "Novo atendimento aberto no SAC.",
    "Novo atendimento no SAC"
  );

  return mapSupportTicket(getSupportTicketByIdForRequester(userId, ticketId));
}

export function reportChatConductForUser(userId, chat, body = {}) {
  if (isSupportAdminUser(userId)) {
    throw new HttpError(403, "Administradores devem tratar denúncias pelo painel.");
  }

  const reason = String(body.reason ?? "").trim().slice(0, 120);
  const details = String(body.details ?? "").trim().slice(0, 1000);
  const reportedName = String(chat?.name ?? "Contato").trim().slice(0, 120);
  const chatRole = String(chat?.role ?? "").trim().slice(0, 160);
  const chatId = String(chat?.id ?? "").trim();
  const serviceRequestId = String(chat?.serviceRequestId ?? "").trim();
  const contactUserId = String(chat?.contactUserId ?? "").trim();
  const lastMessages = Array.isArray(chat?.messages)
    ? chat.messages
        .slice(-5)
        .map((message) => {
          const sender = message.sender === "me" ? "Denunciante" : "Contato";
          return `- ${sender}: ${String(message.text ?? "").trim().slice(0, 240)}`;
        })
        .filter(Boolean)
        .join("\n")
    : "";

  if (!reason) {
    throw new HttpError(400, "Selecione o motivo da denúncia.");
  }

  const ticket = openSupportTicketForUser(userId);
  const reportBody = [
    "[DENÚNCIA DE CONDUTA NO CHAT]",
    `Contato denunciado: ${reportedName}`,
    chatRole ? `Perfil/serviço: ${chatRole}` : "",
    chatId ? `ID da conversa: ${chatId}` : "",
    serviceRequestId ? `ID do serviço: ${serviceRequestId}` : "",
    contactUserId ? `ID do(a) usuário(a) denunciado(a): ${contactUserId}` : "",
    `Motivo: ${reason}`,
    details ? `Detalhes informados: ${details}` : "",
    lastMessages ? `últimas mensagens visíveis:\n${lastMessages}` : "",
  ]
    .filter(Boolean)
    .join("\n");

  const updatedTicket = sendSupportMessageForUser(userId, ticket.id, reportBody);

  return {
    ok: true,
    ticket: updatedTicket,
  };
}

export function sendSupportMessageForUser(userId, ticketId, body) {
  if (isSupportAdminUser(userId)) {
    throw new HttpError(403, "Administradores respondem o SAC pela mesa de atendimento.");
  }

  const ticket = getSupportTicketByIdForRequester(userId, ticketId);

  if (!ticket) {
    throw new HttpError(404, "Atendimento de suporte não encontrado.");
  }

  if (normalizeSupportStatus(ticket.status) === "closed") {
    throw new HttpError(409, "Este atendimento já foi encerrado. Abra um novo suporte para continuar.");
  }

  const timestamp = nowIso();
  const messageBody = normalizeSupportMessageBody(body);

  insertSupportTicketMessageStatement.run(
    createId(),
    ticketId,
    userId,
    "requester",
    messageBody,
    timestamp
  );
  touchSupportTicketForRequesterStatement.run(timestamp, timestamp, timestamp, ticketId);
  notifyAdminsAboutSupport(ticketId, userId, messageBody);

  return mapSupportTicket(getSupportTicketByIdForRequester(userId, ticketId));
}

export function listSupportTicketsForAdmin() {
  const timestamp = nowIso();
  const ticketRows = selectOpenSupportTicketsStatement.all();

  for (const ticket of ticketRows) {
    markSupportTicketSeenByAdminStatement.run(timestamp, ticket.id);
  }

  return ticketRows.map(mapSupportTicket);
}

export function sendSupportMessageForAdmin(adminUserId, ticketId, body) {
  const ticket = getSupportTicketByIdForAdmin(ticketId);

  if (!ticket) {
    throw new HttpError(404, "Atendimento de suporte não encontrado.");
  }

  if (normalizeSupportStatus(ticket.status) === "closed") {
    throw new HttpError(409, "Este atendimento já foi encerrado.");
  }

  const timestamp = nowIso();
  const messageBody = normalizeSupportMessageBody(body);

  insertSupportTicketMessageStatement.run(
    createId(),
    ticketId,
    adminUserId,
    "admin",
    messageBody,
    timestamp
  );
  touchSupportTicketForAdminStatement.run(adminUserId, timestamp, timestamp, timestamp, ticketId);
  notifyRequesterAboutSupportReply(ticket, messageBody);

  return mapSupportTicket(getSupportTicketByIdForAdmin(ticketId));
}

export function getSupportQueueSummary() {
  return {
    waitingTickets: getRealSupportQueueCount(),
    activeTickets: Number(
      db
        .prepare("SELECT COUNT(*) AS total FROM support_tickets WHERE status = 'active'")
        .get()?.total ?? 0
    ),
  };
}

export function closeSupportTicketForAdmin(adminUserId, ticketId) {
  const ticket = getSupportTicketByIdForAdmin(ticketId);

  if (!ticket) {
    throw new HttpError(404, "Atendimento de suporte não encontrado.");
  }

  if (normalizeSupportStatus(ticket.status) === "closed") {
    return mapSupportTicket(ticket);
  }

  const timestamp = nowIso();
  closeSupportTicketStatement.run(adminUserId, timestamp, timestamp, timestamp, ticketId);

  return mapSupportTicket(getSupportTicketByIdForAdmin(ticketId));
}


