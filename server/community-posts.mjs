import { db } from "./db.mjs";
import { createUserNotification } from "./notifications.mjs";
import { createId, nowIso } from "./security.mjs";
import { HttpError } from "./utils.mjs";
import { assertNoExternalContact } from "./chat-guard.mjs";

const VALID_PIN_TYPES = new Set(["Conserto", "Limpeza", "Freelas"]);
const VALID_POST_TYPES = new Set(["offer", "request"]);
const POST_CONTENT_MIN_LENGTH = 12;
const POST_CONTENT_MAX_LENGTH = 160;
const POST_PROFESSION_MAX_LENGTH = 80;
const POST_DURATION_MIN_DAYS = 1;
const POST_DURATION_MAX_DAYS = 5;
const ONLINE_ACTIVITY_WINDOW_MS = 1000 * 60 * 5;
const LEGACY_DECLINED_CONTACT_REQUEST_MESSAGE =
  "Conversa recusada pelo(a) prestador(a) no momento.";

const communityPostSelection = `
  SELECT
    community_posts.*,
    author.full_name AS author_name,
    author.avatar AS author_avatar,
    author.last_active_at AS author_last_active_at,
    author.cpf_verified_at AS author_cpf_verified_at,
    author.cpf_digits AS author_cpf_digits,
    current_chat.id AS current_chat_id
  FROM community_posts
  INNER JOIN users AS author ON author.id = community_posts.author_user_id
  LEFT JOIN community_post_chats AS current_chat
    ON current_chat.post_id = community_posts.id
    AND current_chat.post_author_user_id = community_posts.author_user_id
    AND current_chat.contact_user_id = ?
`;

const communityChatSelection = `
  SELECT
    community_post_chats.*,
    community_posts.category AS post_category,
    community_posts.content AS post_content,
    community_posts.post_type AS post_type,
    author.full_name AS author_name,
    author.avatar AS author_avatar,
    author.last_active_at AS author_last_active_at,
    author.cpf_verified_at AS author_cpf_verified_at,
    author.cpf_digits AS author_cpf_digits,
    contact.full_name AS contact_name,
    contact.avatar AS contact_avatar,
    contact.last_active_at AS contact_last_active_at,
    contact.cpf_verified_at AS contact_cpf_verified_at,
    contact.cpf_digits AS contact_cpf_digits
  FROM community_post_chats
  INNER JOIN community_posts ON community_posts.id = community_post_chats.post_id
  INNER JOIN users AS author ON author.id = community_post_chats.post_author_user_id
  INNER JOIN users AS contact ON contact.id = community_post_chats.contact_user_id
`;

const selectCommunityPostsForViewer = db.prepare(`
  ${communityPostSelection}
  WHERE community_posts.archived_at IS NULL
    AND (community_posts.expires_at IS NULL OR community_posts.expires_at > ?)
  ORDER BY community_posts.updated_at DESC
`);

const selectCommunityPostByIdForViewer = db.prepare(`
  ${communityPostSelection}
  WHERE community_posts.id = ?
    AND community_posts.archived_at IS NULL
    AND (community_posts.expires_at IS NULL OR community_posts.expires_at > ?)
  LIMIT 1
`);

const selectCommunityPostForUpdate = db.prepare(`
  SELECT *
  FROM community_posts
  WHERE id = ?
    AND archived_at IS NULL
  LIMIT 1
`);

const selectCommunityPostChat = db.prepare(`
  SELECT *
  FROM community_post_chats
  WHERE post_id = ?
    AND post_author_user_id = ?
    AND contact_user_id = ?
  LIMIT 1
`);

const selectCommunityChatsByUser = db.prepare(`
  ${communityChatSelection}
  WHERE (
    community_post_chats.post_author_user_id = ?
    AND community_post_chats.post_author_archived_at IS NULL
  )
    OR (
      community_post_chats.contact_user_id = ?
      AND community_post_chats.contact_archived_at IS NULL
    )
  ORDER BY community_post_chats.updated_at DESC
`);

const selectCommunityChatByIdForUser = db.prepare(`
  ${communityChatSelection}
  WHERE community_post_chats.id = ?
    AND (
      community_post_chats.post_author_user_id = ?
      OR community_post_chats.contact_user_id = ?
    )
  LIMIT 1
`);

const selectCommunityChatMessagesByChatId = db.prepare(`
  SELECT *
  FROM community_post_chat_messages
  WHERE chat_id = ?
  ORDER BY created_at ASC
`);

const selectCommunityChatRequesterById = db.prepare(`
  SELECT full_name, avatar
  FROM users
  WHERE id = ?
  LIMIT 1
`);

const insertCommunityPostStatement = db.prepare(`
  INSERT INTO community_posts (
    id,
    author_user_id,
    post_type,
    category,
    content,
    profession,
    experience,
    duration_days,
    expires_at,
    latitude,
    longitude,
    created_at,
    updated_at
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

const insertCommunityPostChatStatement = db.prepare(`
  INSERT INTO community_post_chats (
    id,
    post_id,
    post_author_user_id,
    contact_user_id,
    post_author_last_seen_at,
    contact_last_seen_at,
    created_at,
    updated_at
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
`);

const insertCommunityPostChatMessageStatement = db.prepare(`
  INSERT INTO community_post_chat_messages (
    id,
    chat_id,
    sender_user_id,
    body,
    message_type,
    image_url,
    created_at
  ) VALUES (?, ?, ?, ?, ?, ?, ?)
`);

const touchCommunityPostStatement = db.prepare(`
  UPDATE community_posts
  SET updated_at = ?
  WHERE id = ?
`);

const archiveCommunityPostStatement = db.prepare(`
  UPDATE community_posts
  SET archived_at = ?, updated_at = ?
  WHERE id = ?
    AND author_user_id = ?
    AND archived_at IS NULL
`);

const touchCommunityPostChatStatement = db.prepare(`
  UPDATE community_post_chats
  SET updated_at = ?
  WHERE id = ?
`);

const touchAndUnarchiveCommunityPostChatStatement = db.prepare(`
  UPDATE community_post_chats
  SET
    post_author_archived_at = NULL,
    contact_archived_at = NULL,
    updated_at = ?
  WHERE id = ?
`);

const archiveCommunityPostAuthorChatStatement = db.prepare(`
  UPDATE community_post_chats
  SET post_author_archived_at = ?
  WHERE id = ? AND post_author_user_id = ?
`);

const archiveCommunityContactChatStatement = db.prepare(`
  UPDATE community_post_chats
  SET contact_archived_at = ?
  WHERE id = ? AND contact_user_id = ?
`);

const deleteCommunityPostChatStatement = db.prepare(`
  DELETE FROM community_post_chats
  WHERE id = ?
`);

const markCommunityPostAuthorChatSeenStatement = db.prepare(`
  UPDATE community_post_chats
  SET post_author_last_seen_at = ?
  WHERE id = ?
`);

const markCommunityContactChatSeenStatement = db.prepare(`
  UPDATE community_post_chats
  SET contact_last_seen_at = ?
  WHERE id = ?
`);

function ensurePinType(value) {
  const normalizedValue = String(value ?? "").trim();

  if (!VALID_PIN_TYPES.has(normalizedValue)) {
    throw new HttpError(400, "Selecione uma categoria válida para publicar no mural.");
  }

  return normalizedValue;
}

function ensurePostType(value) {
  const normalizedValue = String(value ?? "").trim().toLowerCase();

  if (!VALID_POST_TYPES.has(normalizedValue)) {
    throw new HttpError(400, "Selecione um tipo válido para publicar no mural.");
  }

  return normalizedValue;
}

function ensurePostContent(value) {
  const normalizedValue = String(value ?? "").trim().replace(/\s+/g, " ");

  if (normalizedValue.length < POST_CONTENT_MIN_LENGTH) {
    throw new HttpError(400, "Escreva pelo menos 12 caracteres para publicar no mural.");
  }

  if (normalizedValue.length > POST_CONTENT_MAX_LENGTH) {
    throw new HttpError(400, "Resuma sua publicação do mural em até 160 caracteres.");
  }

  return normalizedValue;
}

function normalizeProfessionLabel(value) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function isInternalReviewProfession(value) {
  return /(revisao do app|review|google play|teste|tester|console)/.test(
    normalizeProfessionLabel(value)
  );
}

function ensurePostProfession(value, fallback = "") {
  const sourceValue = value ?? fallback;
  const normalizedValue = isInternalReviewProfession(sourceValue)
    ? "Suporte técnico"
    : String(sourceValue).trim().replace(/\s+/g, " ");

  if (!normalizedValue) {
    throw new HttpError(400, "Informe a profissão para publicar sua divulgação.");
  }

  if (normalizedValue.length > POST_PROFESSION_MAX_LENGTH) {
    throw new HttpError(400, "Resuma a profissão em até 80 caracteres.");
  }

  return normalizedValue;
}

function ensurePromotionDurationDays(value) {
  const durationDays = Number(value);

  if (
    !Number.isInteger(durationDays) ||
    durationDays < POST_DURATION_MIN_DAYS ||
    durationDays > POST_DURATION_MAX_DAYS
  ) {
    throw new HttpError(400, "Escolha uma divulgação entre 1 e 5 dias.");
  }

  return durationDays;
}

function ensurePromotionCoordinate(value, fieldName) {
  const numericValue = Number(value);

  if (!Number.isFinite(numericValue)) {
    throw new HttpError(400, `Não conseguimos validar sua ${fieldName} para publicar.`);
  }

  return numericValue;
}

function ensureChatMessageBody(value) {
  const normalizedValue = String(value ?? "").trim();

  if (!normalizedValue) {
    throw new HttpError(400, "Escreva uma mensagem antes de enviar.");
  }

  if (normalizedValue.length > 2000) {
    throw new HttpError(400, "A mensagem está muito longa. Resuma em até 2000 caracteres.");
  }

  assertNoExternalContact(normalizedValue);

  return normalizedValue;
}

function ensureChatImageUrl(value) {
  const normalizedValue = String(value ?? "").trim();

  if (!normalizedValue) {
    throw new HttpError(400, "Selecione uma imagem antes de enviar.");
  }

  if (!/^data:image\/(jpeg|jpg|png|webp);base64,/i.test(normalizedValue)) {
    throw new HttpError(400, "Envie uma imagem válida.");
  }

  if (normalizedValue.length > 850_000) {
    throw new HttpError(400, "A imagem está muito grande. Tente uma foto menor.");
  }

  return normalizedValue;
}

function ensureChatMessagePayload(payload, { allowImage = false } = {}) {
  const isObjectPayload = payload && typeof payload === "object" && !Array.isArray(payload);
  const messageType = isObjectPayload
    ? String(payload.messageType ?? (payload.imageUrl ? "image" : "text")).trim()
    : "text";

  if (messageType === "image") {
    if (!allowImage) {
      throw new HttpError(403, "Apenas clientes podem enviar imagens no chat.");
    }

    const imageUrl = ensureChatImageUrl(payload.imageUrl);
    const caption = String(payload.body ?? payload.text ?? "").trim();

    if (caption) {
      assertNoExternalContact(caption);

      if (caption.length > 300) {
        throw new HttpError(400, "A legenda da imagem deve ter até 300 caracteres.");
      }
    }

    return {
      body: caption,
      messageType: "image",
      imageUrl,
    };
  }

  return {
    body: ensureChatMessageBody(isObjectPayload ? payload.body ?? payload.text : payload),
    messageType: "text",
    imageUrl: null,
  };
}

function mapVerificationFlag(verifiedAt, digits) {
  return Boolean(verifiedAt && digits);
}

function mapOnlineFlag(lastActiveAt) {
  if (!lastActiveAt) {
    return false;
  }

  const lastActiveTime = new Date(lastActiveAt).getTime();

  if (Number.isNaN(lastActiveTime)) {
    return false;
  }

  return Date.now() - lastActiveTime <= ONLINE_ACTIVITY_WINDOW_MS;
}

function buildPostTimeLabel(createdAt) {
  const created = new Date(createdAt);
  const now = Date.now();
  const diffMs = now - created.getTime();

  if (!Number.isFinite(diffMs) || diffMs < 60_000) {
    return "Agora";
  }

  if (diffMs < 3_600_000) {
    return `${Math.max(1, Math.floor(diffMs / 60_000))} min`;
  }

  const sameDay = created.toDateString() === new Date(now).toDateString();

  if (sameDay) {
    return new Intl.DateTimeFormat("pt-BR", {
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "America/Sao_Paulo",
    }).format(created);
  }

  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "short",
    timeZone: "America/Sao_Paulo",
  }).format(created);
}

function getChatAccent(type) {
  if (type === "Limpeza") {
    return "amber";
  }

  if (type === "Freelas") {
    return "emerald";
  }

  return "blue";
}

function buildChatNotificationPreview(messageBody) {
  if (messageBody?.messageType === "image") {
    const caption = String(messageBody.body ?? "").trim().replace(/\s+/g, " ");

    if (caption) {
      return `enviou uma imagem: ${caption.length > 48 ? `${caption.slice(0, 45)}...` : caption}`;
    }

    return "enviou uma imagem";
  }

  const normalized = String(messageBody?.body ?? messageBody ?? "").trim().replace(/\s+/g, " ");

  if (normalized.length <= 72) {
    return normalized;
  }

  return `${normalized.slice(0, 69)}...`;
}

function getNotificationFirstName(fullName, fallback = "Usuário") {
  const normalized = String(fullName ?? "").trim();

  if (!normalized) {
    return fallback;
  }

  return normalized.split(/\s+/)[0] || fallback;
}

function notifyCommunityContactRequest(chatId, postAuthorUserId, requesterUserId) {
  const requester = selectCommunityChatRequesterById.get(requesterUserId);
  const requesterName = requester?.full_name ?? "Cliente";

  createUserNotification(
    postAuthorUserId,
    "chat-request",
    `${getNotificationFirstName(requesterName, "Cliente")} quer conversar com você.`,
    {
      title: "Solicitação de conversa",
      avatar: requester?.avatar ?? null,
      chatId,
    }
  );
}

function mapCommunityPost(row, viewerUserId) {
  const isOwnPost = row.author_user_id === viewerUserId;

  return {
    id: row.id,
    user: row.author_name,
    isVerified: mapVerificationFlag(row.author_cpf_verified_at, row.author_cpf_digits),
    type: row.post_type,
    category: row.category,
    content: row.content,
    profession: row.profession ?? "",
    experience: row.experience ?? row.content,
    durationDays: row.duration_days ?? null,
    expiresAt: row.expires_at ?? null,
    latitude: row.latitude ?? null,
    longitude: row.longitude ?? null,
    avatar: row.author_avatar ?? null,
    timeLabel: buildPostTimeLabel(row.created_at),
    distance: isOwnPost ? "Seu post" : "No mural",
    chatId: isOwnPost ? null : row.current_chat_id ?? null,
    authorId: isOwnPost ? "me" : "community",
  };
}

function mapCommunityChatMessage(row, currentUserId, otherParticipantSeenAt) {
  const isOwnMessage = row.sender_user_id === currentUserId;
  const messageType = row.message_type === "image" && row.image_url ? "image" : "text";

  return {
    id: row.id,
    sender: isOwnMessage ? "me" : "contact",
    text: messageType === "image" && !row.body ? "Imagem enviada" : row.body,
    messageType,
    imageUrl: messageType === "image" ? row.image_url : null,
    timestamp: new Intl.DateTimeFormat("pt-BR", {
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "America/Sao_Paulo",
    }).format(new Date(row.created_at)),
    status:
      isOwnMessage && otherParticipantSeenAt && otherParticipantSeenAt >= row.created_at
        ? "read"
        : "sent",
  };
}

function mapCommunityChat(row, currentUserId) {
  const currentUserIsPostAuthor = row.post_author_user_id === currentUserId;
  const contactName = currentUserIsPostAuthor ? row.contact_name : row.author_name;
  const contactAvatar = currentUserIsPostAuthor ? row.contact_avatar : row.author_avatar;
  const contactLastActiveAt = currentUserIsPostAuthor
    ? row.contact_last_active_at
    : row.author_last_active_at;
  const contactVerified = currentUserIsPostAuthor
    ? mapVerificationFlag(row.contact_cpf_verified_at, row.contact_cpf_digits)
    : mapVerificationFlag(row.author_cpf_verified_at, row.author_cpf_digits);
  const otherParticipantSeenAt = currentUserIsPostAuthor
    ? row.contact_last_seen_at
    : row.post_author_last_seen_at;
  const currentUserSeenAt = currentUserIsPostAuthor
    ? row.post_author_last_seen_at
    : row.contact_last_seen_at;
  const messageRows = selectCommunityChatMessagesByChatId.all(row.id);
  const messages = messageRows.map((messageRow) =>
    mapCommunityChatMessage(messageRow, currentUserId, otherParticipantSeenAt)
  );
  const unread = messageRows.filter(
    (messageRow) =>
      messageRow.sender_user_id !== currentUserId &&
      (!currentUserSeenAt || messageRow.created_at > currentUserSeenAt)
  ).length;

  return {
    id: row.id,
    name: contactName,
    avatar: contactAvatar ?? null,
    contactUserId: currentUserIsPostAuthor ? row.contact_user_id : row.post_author_user_id,
    isOnline: mapOnlineFlag(contactLastActiveAt),
    isVerified: contactVerified,
    role: currentUserIsPostAuthor
      ? row.post_type === "offer"
        ? "Cliente interessado"
        : "Prestador(a)"
      : row.post_type === "offer"
        ? "Prestador(a)"
        : "Cliente",
    unread,
    accent: getChatAccent(row.post_category),
    messages,
    serviceRequestId: null,
    serviceType: row.post_category,
    servicePreview: row.post_content,
    updatedAt: row.updated_at,
  };
}

function isLegacyDeclinedContactRequestChat(chatId) {
  const messages = selectCommunityChatMessagesByChatId.all(chatId);

  return (
    messages.length > 0 &&
    messages.every(
      (message) =>
        String(message.body ?? "").trim() === LEGACY_DECLINED_CONTACT_REQUEST_MESSAGE
    )
  );
}

function getCommunityChatForUser(userId, chatId) {
  const chatRow = selectCommunityChatByIdForUser.get(chatId, userId, userId);

  if (!chatRow) {
    throw new HttpError(404, "Conversa não encontrada.");
  }

  return mapCommunityChat(chatRow, userId);
}

function markCommunityChatSeen(chatRow, userId) {
  const timestamp = nowIso();

  if (chatRow.post_author_user_id === userId) {
    markCommunityPostAuthorChatSeenStatement.run(timestamp, chatRow.id);
    return;
  }

  if (chatRow.contact_user_id === userId) {
    markCommunityContactChatSeenStatement.run(timestamp, chatRow.id);
    return;
  }

  throw new HttpError(403, "Você não participa desta conversa.");
}

export function listCommunityPostsForUser(userId) {
  return selectCommunityPostsForViewer
    .all(userId, nowIso())
    .map((row) => mapCommunityPost(row, userId));
}

export function createCommunityPostForUser(user, payload) {
  if (!user?.isCpfVerified) {
    throw new HttpError(403, "Confirme seu CPF no perfil antes de publicar no mural.");
  }

  const timestamp = nowIso();
  const postId = createId();
  const postType = ensurePostType(payload?.type);
  const content = ensurePostContent(payload?.content);
  const durationDays =
    postType === "offer" && payload?.durationDays !== undefined
      ? ensurePromotionDurationDays(payload.durationDays)
      : null;
  const expiresAt =
    durationDays === null
      ? null
      : new Date(Date.now() + durationDays * 24 * 60 * 60 * 1000).toISOString();
  const primaryProfession = Array.isArray(user.professions) ? user.professions[0] : "";
  const profession =
    postType === "offer" ? ensurePostProfession(payload?.profession, primaryProfession) : null;
  const latitude =
    postType === "offer" ? ensurePromotionCoordinate(payload?.latitude, "localização") : null;
  const longitude =
    postType === "offer" ? ensurePromotionCoordinate(payload?.longitude, "localização") : null;

  insertCommunityPostStatement.run(
    postId,
    user.id,
    postType,
    ensurePinType(payload?.category),
    content,
    profession,
    content,
    durationDays,
    expiresAt,
    latitude,
    longitude,
    timestamp,
    timestamp
  );

  const createdPost = selectCommunityPostByIdForViewer.get(user.id, postId, nowIso());
  return mapCommunityPost(createdPost, user.id);
}

export function openCommunityPostChatForUser(userId, postId) {
  const post = selectCommunityPostForUpdate.get(postId);

  if (!post || post.archived_at) {
    throw new HttpError(404, "Publicação não encontrada.");
  }

  if (post.expires_at && post.expires_at <= nowIso()) {
    throw new HttpError(404, "Divulgação expirada.");
  }

  if (post.author_user_id === userId) {
    throw new HttpError(409, "Seu próprio post já está publicado no mural.");
  }

  const existingChat = selectCommunityPostChat.get(postId, post.author_user_id, userId);

  if (existingChat) {
    if (isLegacyDeclinedContactRequestChat(existingChat.id)) {
      deleteCommunityPostChatStatement.run(existingChat.id);
    } else {
      const timestamp = nowIso();
      const hasMessages = selectCommunityChatMessagesByChatId.all(existingChat.id).length > 0;

      touchAndUnarchiveCommunityPostChatStatement.run(timestamp, existingChat.id);
      markCommunityChatSeen(existingChat, userId);

      if (!hasMessages) {
        notifyCommunityContactRequest(existingChat.id, post.author_user_id, userId);
      }

      return {
        chat: getCommunityChatForUser(userId, existingChat.id),
        post: mapCommunityPost(
          selectCommunityPostByIdForViewer.get(userId, postId, nowIso()),
          userId
        ),
      };
    }
  }

  const timestamp = nowIso();
  const chatId = createId();

  insertCommunityPostChatStatement.run(
    chatId,
    post.id,
    post.author_user_id,
    userId,
    null,
    timestamp,
    timestamp,
    timestamp
  );
  touchCommunityPostStatement.run(timestamp, post.id);
  notifyCommunityContactRequest(chatId, post.author_user_id, userId);

  return {
    chat: getCommunityChatForUser(userId, chatId),
    post: mapCommunityPost(selectCommunityPostByIdForViewer.get(userId, postId, nowIso()), userId),
  };
}

export function archiveCommunityPostForUser(userId, postId) {
  const post = selectCommunityPostForUpdate.get(postId);

  if (!post || post.archived_at) {
    throw new HttpError(404, "Publicação não encontrada.");
  }

  if (post.author_user_id !== userId) {
    throw new HttpError(403, "Você só pode remover os seus próprios posts.");
  }

  const timestamp = nowIso();
  archiveCommunityPostStatement.run(timestamp, timestamp, postId, userId);

  return { removedPostId: postId };
}

export function listCommunityChatsForUser(userId) {
  return selectCommunityChatsByUser
    .all(userId, userId)
    .filter((row) => {
      if (!isLegacyDeclinedContactRequestChat(row.id)) {
        return true;
      }

      deleteCommunityPostChatStatement.run(row.id);
      return false;
    })
    .map((row) => mapCommunityChat(row, userId));
}

export function markCommunityChatReadForUser(userId, chatId) {
  const chatRow = selectCommunityChatByIdForUser.get(chatId, userId, userId);

  if (!chatRow) {
    throw new HttpError(404, "Conversa não encontrada.");
  }

  markCommunityChatSeen(chatRow, userId);

  return getCommunityChatForUser(userId, chatId);
}

export function archiveCommunityChatForUser(userId, chatId) {
  const chatRow = selectCommunityChatByIdForUser.get(chatId, userId, userId);

  if (!chatRow) {
    throw new HttpError(404, "Conversa não encontrada.");
  }

  const timestamp = nowIso();

  if (chatRow.post_author_user_id === userId) {
    archiveCommunityPostAuthorChatStatement.run(timestamp, chatId, userId);
    return { ok: true };
  }

  if (chatRow.contact_user_id === userId) {
    archiveCommunityContactChatStatement.run(timestamp, chatId, userId);
    return { ok: true };
  }

  throw new HttpError(403, "Você não participa desta conversa.");
}

export function declineCommunityContactRequestForUser(userId, chatId) {
  const chatRow = selectCommunityChatByIdForUser.get(chatId, userId, userId);

  if (!chatRow) {
    throw new HttpError(404, "Conversa não encontrada.");
  }

  if (chatRow.post_author_user_id !== userId) {
    throw new HttpError(403, "Apenas o(a) prestador(a) pode recusar esta solicitação.");
  }

  const messages = selectCommunityChatMessagesByChatId.all(chatId);

  if (messages.length > 0) {
    throw new HttpError(409, "Esta conversa já foi iniciada.");
  }

  createUserNotification(
    chatRow.contact_user_id,
    "chat-request-declined",
    `${getNotificationFirstName(chatRow.author_name, "Prestador(a)")} recusou sua solicitação de conversa.`,
    {
      title: "Conversa recusada",
      avatar: chatRow.author_avatar ?? null,
      path: "/app",
    }
  );

  deleteCommunityPostChatStatement.run(chatId);

  return { ok: true, removedChatId: chatId };
}

export function sendCommunityChatMessageForUser(userId, chatId, payload) {
  const chatRow = selectCommunityChatByIdForUser.get(chatId, userId, userId);

  if (!chatRow) {
    throw new HttpError(404, "Conversa não encontrada.");
  }

  const currentUserIsClient =
    chatRow.post_type === "offer"
      ? chatRow.contact_user_id === userId
      : chatRow.post_author_user_id === userId;
  const messagePayload = ensureChatMessagePayload(payload, {
    allowImage: currentUserIsClient,
  });
  const timestamp = nowIso();

  insertCommunityPostChatMessageStatement.run(
    createId(),
    chatId,
    userId,
    messagePayload.body,
    messagePayload.messageType,
    messagePayload.imageUrl,
    timestamp
  );
  touchAndUnarchiveCommunityPostChatStatement.run(timestamp, chatId);
  touchCommunityPostStatement.run(timestamp, chatRow.post_id);
  markCommunityChatSeen(chatRow, userId);

  const currentUserIsPostAuthor = chatRow.post_author_user_id === userId;
  const recipientUserId = currentUserIsPostAuthor
    ? chatRow.contact_user_id
    : chatRow.post_author_user_id;
  const senderName = currentUserIsPostAuthor ? chatRow.author_name : chatRow.contact_name;
  const senderAvatar = currentUserIsPostAuthor
    ? chatRow.author_avatar
    : chatRow.contact_avatar;

  createUserNotification(
    recipientUserId,
    "chat-message",
    `${getNotificationFirstName(senderName)}: ${buildChatNotificationPreview(messagePayload)}`,
    {
      title: getNotificationFirstName(senderName),
      avatar: senderAvatar ?? null,
      chatId,
    }
  );

  return getCommunityChatForUser(userId, chatId);
}

