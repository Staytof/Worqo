import { db } from "./db.mjs";
import { createUserNotification } from "./notifications.mjs";
import { createId, nowIso } from "./security.mjs";
import {
  cancelAsaasPendingPaymentForServiceRequest,
  clearAsaasPaymentSessionForServiceRequest,
  isPixWithdrawalReadyForUser,
  refreshAsaasPaymentForServiceRequest,
  refundAsaasPaymentForServiceRequest,
} from "./asaas.mjs";
import { HttpError } from "./utils.mjs";
import { assertNoExternalContact } from "./chat-guard.mjs";

const VALID_PIN_TYPES = new Set(["Conserto", "Limpeza", "Freelas"]);
const ONLINE_ACTIVITY_WINDOW_MS = 1000 * 60 * 5;
const LIVE_REQUEST_STATUSES = [
  "searching",
  "assigned",
  "chatting",
  "details",
  "waiting-worker",
  "payment",
  "confirmed",
];
const BLOCKING_REQUEST_STATUSES = [
  "searching",
  "assigned",
  "chatting",
  "details",
  "waiting-worker",
  "payment",
  "confirmed",
];
const CANCELLABLE_REQUEST_STATUSES = [
  "searching",
  "assigned",
  "chatting",
  "details",
  "waiting-worker",
  "payment",
];
const REQUESTER_ACCEPTABLE_STATUSES = new Set([
  "assigned",
  "chatting",
  "details",
  "waiting-worker",
  "payment",
]);
const DISPUTABLE_REQUEST_STATUSES = new Set(["payment", "confirmed", "completed"]);
const PUBLIC_REQUEST_MASK_RADIUS_METERS = 150;
const PUBLIC_REQUEST_MASK_MIN_OFFSET_METERS = 70;
const PUBLIC_REQUEST_MASK_OFFSET_VARIATION_METERS = 35;
const REQUEST_DESCRIPTION_MAX_LENGTH = 50;
const REQUEST_WORKER_DECLINE_BLOCK_MS = 1000 * 60 * 10;
const SEARCHING_REQUEST_TTL_MS = 1000 * 60 * 60;

const liveStatusPlaceholders = LIVE_REQUEST_STATUSES.map(() => "?").join(", ");
const blockingStatusPlaceholders = BLOCKING_REQUEST_STATUSES.map(() => "?").join(", ");

const requestSelection = `
  SELECT
    service_requests.*,
    service_chats.id AS chat_id,
    requester.full_name AS requester_name,
    requester.avatar AS requester_avatar,
    requester.cpf_verified_at AS requester_cpf_verified_at,
    requester.cpf_digits AS requester_cpf_digits,
    worker.full_name AS worker_name,
    worker.avatar AS worker_avatar,
    worker.cpf_verified_at AS worker_cpf_verified_at,
    worker.cpf_digits AS worker_cpf_digits
  FROM service_requests
  INNER JOIN users AS requester ON requester.id = service_requests.requester_user_id
  LEFT JOIN users AS worker ON worker.id = service_requests.worker_user_id
  LEFT JOIN service_chats ON service_chats.service_request_id = service_requests.id
`;

const chatSelection = `
  SELECT
    service_chats.*,
    service_requests.category AS service_category,
    service_requests.description AS service_description,
    service_requests.status AS service_status,
    requester.full_name AS requester_name,
    requester.avatar AS requester_avatar,
    requester.last_active_at AS requester_last_active_at,
    requester.cpf_verified_at AS requester_cpf_verified_at,
    requester.cpf_digits AS requester_cpf_digits,
    worker.full_name AS worker_name,
    worker.avatar AS worker_avatar,
    worker.last_active_at AS worker_last_active_at,
    worker.cpf_verified_at AS worker_cpf_verified_at,
    worker.cpf_digits AS worker_cpf_digits
  FROM service_chats
  INNER JOIN service_requests ON service_requests.id = service_chats.service_request_id
  INNER JOIN users AS requester ON requester.id = service_chats.requester_user_id
  INNER JOIN users AS worker ON worker.id = service_chats.worker_user_id
`;

const selectActiveRequestByRequester = db.prepare(
  `
    ${requestSelection}
    WHERE service_requests.requester_user_id = ?
      AND service_requests.status IN (${liveStatusPlaceholders})
    ORDER BY service_requests.created_at DESC
    LIMIT 1
  `
);

const selectActiveRequestByWorker = db.prepare(
  `
    ${requestSelection}
    WHERE service_requests.worker_user_id = ?
      AND service_requests.status IN (${liveStatusPlaceholders})
    ORDER BY service_requests.created_at DESC
    LIMIT 1
  `
);

const selectCompletedRequestsByRequester = db.prepare(
  `
    ${requestSelection}
    WHERE service_requests.requester_user_id = ?
      AND service_requests.status = 'completed'
    ORDER BY service_requests.updated_at DESC, service_requests.created_at DESC
    LIMIT 50
  `
);

const selectPendingClientReviewByWorker = db.prepare(
  `
    ${requestSelection}
    WHERE service_requests.worker_user_id = ?
      AND service_requests.status = 'completed'
      AND NOT EXISTS (
        SELECT 1
        FROM service_reviews
        WHERE service_reviews.service_request_id = service_requests.id
          AND service_reviews.reviewer_user_id = ?
          AND service_reviews.target_user_id = service_requests.requester_user_id
      )
    ORDER BY service_requests.updated_at ASC, service_requests.created_at ASC
    LIMIT 1
  `
);

const selectBlockingRequestByRequester = db.prepare(
  `
    ${requestSelection}
    WHERE service_requests.requester_user_id = ?
      AND service_requests.status IN (${blockingStatusPlaceholders})
    ORDER BY service_requests.created_at DESC
    LIMIT 1
  `
);

const selectBlockingRequestByWorker = db.prepare(
  `
    ${requestSelection}
    WHERE service_requests.worker_user_id = ?
      AND service_requests.status IN (${blockingStatusPlaceholders})
    ORDER BY service_requests.created_at DESC
    LIMIT 1
  `
);

const selectPublicMapRequests = db.prepare(
  `
    ${requestSelection}
    WHERE service_requests.status = 'searching'
      AND service_requests.worker_user_id IS NULL
      AND service_requests.requester_user_id <> ?
      AND service_requests.created_at > ?
      AND NOT EXISTS (
        SELECT 1
        FROM service_request_worker_blocks
        WHERE service_request_worker_blocks.service_request_id = service_requests.id
          AND service_request_worker_blocks.worker_user_id = ?
          AND service_request_worker_blocks.expires_at > ?
      )
    ORDER BY service_requests.created_at DESC
  `
);

const expireOldSearchingServiceRequestsStatement = db.prepare(
  `
    UPDATE service_requests
    SET status = 'cancelled', updated_at = ?
    WHERE status = 'searching'
      AND worker_user_id IS NULL
      AND created_at <= ?
  `
);

const selectRequestById = db.prepare(
  `
    ${requestSelection}
    WHERE service_requests.id = ?
    LIMIT 1
  `
);

const selectServiceChatByRequestId = db.prepare(
  `
    SELECT *
    FROM service_chats
    WHERE service_request_id = ?
    LIMIT 1
  `
);

const selectServiceRequestByOriginCommunityChatId = db.prepare(
  `
    ${requestSelection}
    WHERE service_requests.origin_community_chat_id = ?
    LIMIT 1
  `
);

const selectCommunityOfferChatForServiceStart = db.prepare(
  `
    SELECT
      community_post_chats.*,
      community_posts.category AS post_category,
      community_posts.content AS post_content,
      community_posts.latitude AS post_latitude,
      community_posts.longitude AS post_longitude,
      contact.address AS contact_address
    FROM community_post_chats
    INNER JOIN community_posts ON community_posts.id = community_post_chats.post_id
    INNER JOIN users AS contact ON contact.id = community_post_chats.contact_user_id
    WHERE community_post_chats.id = ?
      AND community_post_chats.contact_user_id = ?
      AND community_posts.post_type = 'offer'
    LIMIT 1
  `
);

const selectServiceChatsByUser = db.prepare(
  `
    ${chatSelection}
    WHERE (
      (service_chats.requester_user_id = ? AND service_chats.requester_archived_at IS NULL)
      OR (service_chats.worker_user_id = ? AND service_chats.worker_archived_at IS NULL)
    )
      AND service_requests.status NOT IN ('completed', 'cancelled')
    ORDER BY service_chats.updated_at DESC
  `
);

const selectServiceChatByIdForUser = db.prepare(
  `
    ${chatSelection}
    WHERE service_chats.id = ?
      AND (service_chats.requester_user_id = ? OR service_chats.worker_user_id = ?)
    LIMIT 1
  `
);

const selectUserVerificationById = db.prepare(
  `
    SELECT cpf_verified_at, cpf_digits
    FROM users
    WHERE id = ?
    LIMIT 1
  `
);

const selectChatMessagesByChatId = db.prepare(
  `
    SELECT *
    FROM service_chat_messages
    WHERE chat_id = ?
    ORDER BY created_at ASC
  `
);

const selectCommunityChatMessagesForServiceStart = db.prepare(
  `
    SELECT *
    FROM community_post_chat_messages
    WHERE chat_id = ?
    ORDER BY created_at ASC
  `
);

const insertServiceRequest = db.prepare(
  `
    INSERT INTO service_requests (
      id,
      requester_user_id,
      category,
      description,
      latitude,
      longitude,
      accuracy,
      location_label,
      worker_user_id,
      accepted_at,
      service_details_json,
      status,
      created_at,
      updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, NULL, NULL, NULL, 'searching', ?, ?)
  `
);

const insertServiceRequestFromCommunityChat = db.prepare(
  `
    INSERT INTO service_requests (
      id,
      requester_user_id,
      category,
      description,
      latitude,
      longitude,
      accuracy,
      location_label,
      worker_user_id,
      accepted_at,
      service_details_json,
      origin_community_chat_id,
      status,
      created_at,
      updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, 'details', ?, ?)
  `
);

const assignServiceRequestStatement = db.prepare(
  `
    UPDATE service_requests
    SET
      worker_user_id = ?,
      accepted_at = ?,
      status = 'assigned',
      updated_at = ?
    WHERE id = ?
      AND status = 'searching'
      AND worker_user_id IS NULL
  `
);

const cancelServiceRequestByRequesterStatement = db.prepare(
  `
    UPDATE service_requests
    SET status = 'cancelled', updated_at = ?
    WHERE id = ? AND requester_user_id = ?
  `
);

const deleteServiceRequestByRequesterStatement = db.prepare(
  `
    DELETE FROM service_requests
    WHERE id = ? AND requester_user_id = ?
  `
);

const releaseServiceRequestByWorkerStatement = db.prepare(
  `
    UPDATE service_requests
    SET
      worker_user_id = NULL,
      accepted_at = NULL,
      status = 'searching',
      updated_at = ?
    WHERE id = ? AND worker_user_id = ?
  `
);

const declineAssignedServiceRequestStatement = db.prepare(
  `
    UPDATE service_requests
    SET
      worker_user_id = NULL,
      accepted_at = NULL,
      service_details_json = NULL,
      status = 'searching',
      updated_at = ?
    WHERE id = ? AND requester_user_id = ? AND status = 'assigned'
  `
);

const acceptAssignedServiceRequestStatement = db.prepare(
  `
    UPDATE service_requests
    SET status = 'chatting', updated_at = ?
    WHERE id = ? AND requester_user_id = ? AND status = 'assigned'
  `
);

const updateServiceRequestDetailsStatement = db.prepare(
  `
    UPDATE service_requests
    SET
      service_details_json = ?,
      latitude = ?,
      longitude = ?,
      accuracy = ?,
      location_label = ?,
      status = 'waiting-worker',
      updated_at = ?
    WHERE id = ? AND requester_user_id = ?
  `
);

const confirmServiceRequestPaymentStatement = db.prepare(
  `
    UPDATE service_requests
    SET status = 'payment', updated_at = ?
    WHERE id = ? AND worker_user_id = ? AND status = 'waiting-worker'
  `
);

const confirmPaidServiceRequestStatement = db.prepare(
  `
    UPDATE service_requests
    SET status = 'confirmed', updated_at = ?
    WHERE id = ? AND requester_user_id = ? AND status = 'payment'
  `
);

const insertServiceChatStatement = db.prepare(
  `
    INSERT INTO service_chats (
      id,
      service_request_id,
      requester_user_id,
      worker_user_id,
      requester_last_seen_at,
      worker_last_seen_at,
      created_at,
      updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `
);

const insertServiceChatMessageStatement = db.prepare(
  `
    INSERT INTO service_chat_messages (
      id,
      chat_id,
      sender_user_id,
      body,
      message_type,
      image_url,
      created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?)
  `
);

const insertServiceReviewStatement = db.prepare(
  `
    INSERT INTO service_reviews (
      id,
      service_request_id,
      reviewer_user_id,
      target_user_id,
      rating,
      comment,
      created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?)
  `
);

const selectServiceReviewByRequestTargetStatement = db.prepare(
  `
    SELECT id
    FROM service_reviews
    WHERE service_request_id = ?
      AND target_user_id = ?
    LIMIT 1
  `
);

const touchServiceChatStatement = db.prepare(
  `
    UPDATE service_chats
    SET updated_at = ?
    WHERE id = ?
  `
);

const touchAndUnarchiveServiceChatStatement = db.prepare(
  `
    UPDATE service_chats
    SET
      requester_archived_at = NULL,
      worker_archived_at = NULL,
      updated_at = ?
    WHERE id = ?
  `
);

const archiveRequesterServiceChatStatement = db.prepare(
  `
    UPDATE service_chats
    SET requester_archived_at = ?
    WHERE id = ? AND requester_user_id = ?
  `
);

const archiveWorkerServiceChatStatement = db.prepare(
  `
    UPDATE service_chats
    SET worker_archived_at = ?
    WHERE id = ? AND worker_user_id = ?
  `
);

const deleteServiceChatByRequestIdStatement = db.prepare(
  `
    DELETE FROM service_chats
    WHERE service_request_id = ?
  `
);

const deleteCommunityPostChatByIdStatement = db.prepare(
  `
    DELETE FROM community_post_chats
    WHERE id = ?
  `
);

const selectServiceRequestEventsStatement = db.prepare(
  `
    SELECT *
    FROM service_request_events
    WHERE service_request_id = ?
    ORDER BY created_at ASC
  `
);

const insertServiceRequestEventStatement = db.prepare(
  `
    INSERT INTO service_request_events (
      id,
      service_request_id,
      actor_user_id,
      actor_role,
      event_kind,
      title,
      description,
      meta_json,
      created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `
);

const selectActiveWorkerBlockForRequestStatement = db.prepare(
  `
    SELECT *
    FROM service_request_worker_blocks
    WHERE service_request_id = ?
      AND worker_user_id = ?
      AND expires_at > ?
    LIMIT 1
  `
);

const upsertServiceRequestWorkerBlockStatement = db.prepare(
  `
    INSERT INTO service_request_worker_blocks (
      service_request_id,
      worker_user_id,
      requester_user_id,
      created_at,
      expires_at
    ) VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(service_request_id, worker_user_id) DO UPDATE SET
      requester_user_id = excluded.requester_user_id,
      created_at = excluded.created_at,
      expires_at = excluded.expires_at
  `
);

const deleteExpiredServiceRequestWorkerBlocksStatement = db.prepare(
  `
    DELETE FROM service_request_worker_blocks
    WHERE expires_at <= ?
  `
);

const openServiceRequestDisputeStatement = db.prepare(
  `
    UPDATE service_requests
    SET
      dispute_status = 'open',
      dispute_reason = ?,
      disputed_by_user_id = ?,
      disputed_at = ?,
      dispute_resolution = NULL,
      dispute_resolved_at = NULL,
      dispute_admin_note = NULL,
      updated_at = ?
    WHERE id = ?
      AND dispute_status IS NULL
  `
);

const resolveServiceRequestDisputeStatement = db.prepare(
  `
    UPDATE service_requests
    SET
      dispute_status = ?,
      dispute_resolution = ?,
      dispute_resolved_at = ?,
      dispute_admin_note = ?,
      refund_status = ?,
      refund_amount_cents = ?,
      refunded_at = ?,
      status = ?,
      updated_at = ?
    WHERE id = ?
      AND dispute_status = 'open'
  `
);

const markRequesterChatSeenStatement = db.prepare(
  `
    UPDATE service_chats
    SET requester_last_seen_at = ?
    WHERE id = ?
  `
);

const markWorkerChatSeenStatement = db.prepare(
  `
    UPDATE service_chats
    SET worker_last_seen_at = ?
    WHERE id = ?
  `
);

function ensurePinType(value) {
  const normalizedValue = String(value ?? "").trim();

  if (!VALID_PIN_TYPES.has(normalizedValue)) {
    throw new HttpError(400, "Selecione uma categoria válida para o pedido.");
  }

  return normalizedValue;
}

function ensureDescription(value) {
  const normalizedValue = String(value ?? "").trim();

  if (normalizedValue.length < 10) {
    throw new HttpError(400, "Descreva melhor o pedido para publicar no mapa.");
  }

  if (normalizedValue.length > REQUEST_DESCRIPTION_MAX_LENGTH) {
    throw new HttpError(400, "O pedido está muito longo. Resuma em até 50 caracteres.");
  }

  return normalizedValue;
}

function ensureCoordinate(value, fieldLabel) {
  const numericValue = Number(value);

  if (!Number.isFinite(numericValue)) {
    throw new HttpError(400, `${fieldLabel} inválida.`);
  }

  return numericValue;
}

function ensureAccuracy(value) {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const numericValue = Number(value);

  if (!Number.isFinite(numericValue) || numericValue < 0) {
    throw new HttpError(400, "Precisão da localização inválida.");
  }

  return numericValue;
}

function hashLocationSeed(value) {
  let hash = 0;

  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
  }

  return hash;
}

function toRadians(value) {
  return (value * Math.PI) / 180;
}

function offsetCoordinates(position, angleDegrees, distanceMeters) {
  const angleRadians = toRadians(angleDegrees);
  const latitudeOffset = (distanceMeters / 111_320) * Math.cos(angleRadians);
  const longitudeScale = Math.max(Math.cos(toRadians(position.lat)), 0.2);
  const longitudeOffset =
    (distanceMeters / (111_320 * longitudeScale)) * Math.sin(angleRadians);

  return {
    lat: position.lat + latitudeOffset,
    lng: position.lng + longitudeOffset,
  };
}

function buildMaskedRequestLocation(requestId, latitude, longitude) {
  const seedHash = hashLocationSeed(requestId);
  const northAngle = (seedHash % 57) - 28;
  const offsetMeters =
    PUBLIC_REQUEST_MASK_MIN_OFFSET_METERS +
    (Math.floor(seedHash / 57) % (PUBLIC_REQUEST_MASK_OFFSET_VARIATION_METERS + 1));

  return offsetCoordinates({ lat: latitude, lng: longitude }, northAngle, offsetMeters);
}

function ensureRequesterCanCreateServiceRequest(user) {
  if (!user?.isCpfVerified) {
    throw new HttpError(403, "Para publicar um pedido no mapa, confirme seu CPF no perfil.");
  }
}

function isUserCpfVerified(userId) {
  const row = selectUserVerificationById.get(userId);
  return Boolean(row?.cpf_verified_at && row?.cpf_digits);
}

function ensureWorkerCanTakeServiceRequest(userId) {
  if (!isUserCpfVerified(userId)) {
    throw new HttpError(403, "Para ver e pegar serviços, confirme seu CPF no perfil.");
  }
}

function normalizeLocationLabel(value) {
  return String(value ?? "").trim().slice(0, 160);
}

function parseServiceDetails(value) {
  if (!value) {
    return null;
  }

  try {
    const parsed = JSON.parse(value);

    if (
      !parsed ||
      typeof parsed !== "object" ||
      typeof parsed.price !== "string" ||
      typeof parsed.schedule !== "string" ||
      (parsed.locationMode !== "residence" && parsed.locationMode !== "street") ||
      typeof parsed.address !== "string"
    ) {
      return null;
    }

    return {
      title:
        typeof parsed.title === "string"
          ? parsed.title.trim().replace(/\s+/g, " ").slice(0, 80)
          : "",
      price: normalizeServicePrice(parsed.price),
      serviceDate: typeof parsed.serviceDate === "string" ? parsed.serviceDate : "",
      schedule: ensureSchedule(parsed.schedule),
      delayToleranceMinutes:
        Number.isFinite(Number(parsed.delayToleranceMinutes)) &&
        Number(parsed.delayToleranceMinutes) >= 0
          ? Math.round(Number(parsed.delayToleranceMinutes))
          : 15,
      locationMode: parsed.locationMode,
      address: parsed.address,
    };
  } catch {
    return null;
  }
}

function ensureServiceDate(value) {
  const normalizedValue = String(value ?? "").trim().slice(0, 10);

  if (!normalizedValue) {
    throw new HttpError(400, "Informe a data do serviço para continuar.");
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(normalizedValue)) {
    throw new HttpError(400, "Informe uma data válida para o serviço.");
  }

  const [year, month, day] = normalizedValue.split("-").map(Number);
  const parsedDate = new Date(year, month - 1, day, 12);

  if (
    Number.isNaN(parsedDate.getTime()) ||
    parsedDate.getFullYear() !== year ||
    parsedDate.getMonth() !== month - 1 ||
    parsedDate.getDate() !== day
  ) {
    throw new HttpError(400, "Informe uma data válida para o serviço.");
  }

  return normalizedValue;
}

function normalizeServicePrice(value) {
  const digits = String(value ?? "")
    .replace(/\D/g, "")
    .slice(0, 12);

  if (!digits) {
    throw new HttpError(400, "Informe um valor válido para o serviço.");
  }

  const padded = digits.padStart(3, "0");
  const integerPart = padded.slice(0, -2);
  const decimalPart = padded.slice(-2);

  return `R$ ${Number(integerPart).toLocaleString("pt-BR")},${decimalPart}`;
}

function ensureSchedule(value) {
  const digits = String(value ?? "")
    .replace(/\D/g, "")
    .slice(0, 4);

  if (digits.length !== 4) {
    throw new HttpError(400, "Informe o horário no formato HH:MM.");
  }

  const hours = Number(digits.slice(0, 2));
  const minutes = Number(digits.slice(2));

  if (
    !Number.isInteger(hours) ||
    !Number.isInteger(minutes) ||
    hours < 0 ||
    hours > 23 ||
    minutes < 0 ||
    minutes > 59
  ) {
    throw new HttpError(400, "Informe um horário válido no formato HH:MM.");
  }

  return `${digits.slice(0, 2)}:${digits.slice(2)}`;
}

function ensureDelayToleranceMinutes(value) {
  const numericValue = Number(value);

  if (!Number.isFinite(numericValue)) {
    throw new HttpError(400, "Informe uma tolerância de atraso valida.");
  }

  const normalizedValue = Math.round(numericValue);

  if (normalizedValue < 0 || normalizedValue > 180) {
    throw new HttpError(400, "A tolerância de atraso deve ficar entre 0 e 180 minutos.");
  }

  return normalizedValue;
}

function ensureServiceDetails(payload) {
  const title = String(payload?.title ?? "").trim().replace(/\s+/g, " ").slice(0, 80);
  const price = normalizeServicePrice(payload?.price);
  const serviceDate = ensureServiceDate(payload?.serviceDate);
  const schedule = ensureSchedule(payload?.schedule);
  const delayToleranceMinutes = ensureDelayToleranceMinutes(payload?.delayToleranceMinutes);
  const locationMode = payload?.locationMode;
  const address = String(payload?.address ?? "").trim().slice(0, 220);
  const latitude = ensureCoordinate(payload?.latitude, "Latitude");
  const longitude = ensureCoordinate(payload?.longitude, "Longitude");
  const accuracy = ensureAccuracy(payload?.accuracy);
  const locationLabel = normalizeLocationLabel(payload?.locationLabel || address);

  if (title.length < 4) {
    throw new HttpError(400, "Informe um título para o acordo.");
  }

  assertNoExternalContact(title);

  if (locationMode !== "residence" && locationMode !== "street") {
    throw new HttpError(400, "Selecione um local válido para o atendimento.");
  }

  if (locationMode === "street" && !address) {
    throw new HttpError(400, "Informe o endereço ou ponto de encontro do serviço.");
  }

  return {
    title,
    price,
    serviceDate,
    schedule,
    delayToleranceMinutes,
    locationMode,
    address,
    latitude,
    longitude,
    accuracy,
    locationLabel,
  };
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

function ensureServiceReview(payload) {
  const rating = Math.round(Number(payload?.rating));
  const comment = String(payload?.comment ?? "").trim().slice(0, 500);

  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    throw new HttpError(400, "Selecione uma nota de 1 a 5 estrelas.");
  }

  if (comment.length < 8) {
    throw new HttpError(400, "Escreva uma breve avaliação sobre o serviço.");
  }

  return {
    rating,
    comment,
  };
}

function ensureDisputeReason(value) {
  const normalizedValue = String(value ?? "").trim().slice(0, 320);

  if (normalizedValue.length < 12) {
    throw new HttpError(400, "Explique em poucas palavras o motivo da disputa.");
  }

  return normalizedValue;
}

function ensureDisputeResolutionAction(value) {
  const normalizedValue = String(value ?? "").trim().toLowerCase();

  if (normalizedValue !== "continue" && normalizedValue !== "refund") {
    throw new HttpError(400, "Escolha uma ação valida para resolver a disputa.");
  }

  return normalizedValue;
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

function getChatAccent(type) {
  if (type === "Limpeza") {
    return "amber";
  }

  if (type === "Freelas") {
    return "emerald";
  }

  return "blue";
}

function shouldRevealExactServiceLocation(currentUserRole, status) {
  if (currentUserRole === "requester") {
    return true;
  }

  return currentUserRole === "worker" && ["confirmed", "completed"].includes(status);
}

function mapServicePin(row) {
  const maskedLocation = buildMaskedRequestLocation(row.id, row.latitude, row.longitude);

  return {
    id: row.id,
    type: row.category,
    requesterId: row.requester_user_id,
    requesterName: row.requester_name,
    requesterVerified: mapVerificationFlag(
      row.requester_cpf_verified_at,
      row.requester_cpf_digits
    ),
    description: row.description,
    latitude: maskedLocation.lat,
    longitude: maskedLocation.lng,
    maskedLatitude: maskedLocation.lat,
    maskedLongitude: maskedLocation.lng,
    maskedRadiusMeters: PUBLIC_REQUEST_MASK_RADIUS_METERS,
    exactLocationVisible: false,
    accuracy: null,
    locationLabel: null,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapServiceDispute(row) {
  const status = String(row?.dispute_status ?? "").trim().toLowerCase();

  if (!status) {
    return null;
  }

  return {
    status:
      status === "open" || status === "resolved" || status === "refunded" ? status : null,
    reason: row.dispute_reason ?? "",
    openedAt: row.disputed_at ?? null,
    openedByUserId: row.disputed_by_user_id ?? null,
    resolution: row.dispute_resolution ?? null,
    resolvedAt: row.dispute_resolved_at ?? null,
    adminNote: row.dispute_admin_note ?? null,
  };
}

function mapServiceTimelineEvent(row) {
  return {
    id: row.id,
    kind: row.event_kind,
    actorRole: row.actor_role,
    title: row.title,
    description: row.description,
    createdAt: row.created_at,
  };
}

function listServiceRequestTimeline(requestId) {
  return selectServiceRequestEventsStatement
    .all(requestId)
    .map(mapServiceTimelineEvent);
}

function hasServiceRequestEvent(requestId, kind) {
  return selectServiceRequestEventsStatement
    .all(requestId)
    .some((event) => event.event_kind === kind);
}

function createServiceRequestEvent(
  requestId,
  {
    actorUserId = null,
    actorRole = "system",
    kind,
    title,
    description,
    meta = {},
    createdAt = nowIso(),
  }
) {
  insertServiceRequestEventStatement.run(
    createId(),
    requestId,
    actorUserId,
    actorRole,
    kind,
    title,
    description,
    JSON.stringify(meta ?? {}),
    createdAt
  );
}

function maskServiceDetailsForViewer(details, currentUserRole, status) {
  if (!details) {
    return null;
  }

  if (shouldRevealExactServiceLocation(currentUserRole, status)) {
    return details;
  }

  return {
    ...details,
    address: "",
  };
}

function mapActiveServiceRequest(row, currentUserRole) {
  if (!row) {
    return null;
  }

  const exactLocationVisible = shouldRevealExactServiceLocation(currentUserRole, row.status);
  const maskedLocation = buildMaskedRequestLocation(row.id, row.latitude, row.longitude);

  return {
    id: row.id,
    type: row.category,
    description: row.description,
    requesterId: row.requester_user_id,
    requesterName: row.requester_name,
    requesterVerified: mapVerificationFlag(
      row.requester_cpf_verified_at,
      row.requester_cpf_digits
    ),
    workerId: row.worker_user_id ?? null,
    workerName: row.worker_name ?? null,
    workerVerified: mapVerificationFlag(row.worker_cpf_verified_at, row.worker_cpf_digits),
    acceptedAt: row.accepted_at ?? null,
    latitude: exactLocationVisible ? row.latitude : maskedLocation.lat,
    longitude: exactLocationVisible ? row.longitude : maskedLocation.lng,
    maskedLatitude: maskedLocation.lat,
    maskedLongitude: maskedLocation.lng,
    maskedRadiusMeters: PUBLIC_REQUEST_MASK_RADIUS_METERS,
    exactLocationVisible,
    accuracy: exactLocationVisible ? row.accuracy ?? null : null,
    locationLabel: exactLocationVisible ? row.location_label || null : null,
    status: row.status,
    currentUserRole,
    chatId: row.chat_id ?? null,
    payment:
      row.payment_amount_total_cents || row.payment_amount_subtotal_cents
        ? {
            subtotalCents: Number(row.payment_amount_subtotal_cents) || 0,
            feeCents: Number(row.payment_amount_fee_cents) || 0,
            totalCents: Number(row.payment_amount_total_cents) || 0,
            currency: row.payment_currency ?? "brl",
            providerStatus: row.asaas_payment_status ?? null,
            receivedAt: row.asaas_payment_received_at ?? null,
          }
        : null,
    dispute: mapServiceDispute(row),
    timeline: listServiceRequestTimeline(row.id),
    details: maskServiceDetailsForViewer(
      parseServiceDetails(row.service_details_json),
      currentUserRole,
      row.status
    ),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapChatMessage(row, currentUserId, otherParticipantSeenAt) {
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

function buildChatNotificationPreview(messagePayload) {
  if (messagePayload?.messageType === "image") {
    const caption = String(messagePayload.body ?? "").trim().replace(/\s+/g, " ");

    if (caption) {
      return `enviou uma imagem: ${caption.length > 48 ? `${caption.slice(0, 45)}...` : caption}`;
    }

    return "enviou uma imagem";
  }

  const normalized = String(messagePayload?.body ?? messagePayload ?? "").trim().replace(/\s+/g, " ");

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

function mapServiceChat(row, currentUserId) {
  const currentUserRole =
    row.requester_user_id === currentUserId ? "requester" : "worker";
  const isRequester = currentUserRole === "requester";
  const contactName = isRequester ? row.worker_name : row.requester_name;
  const contactAvatar = isRequester ? row.worker_avatar : row.requester_avatar;
  const contactLastActiveAt = isRequester
    ? row.worker_last_active_at
    : row.requester_last_active_at;
  const contactVerified = isRequester
    ? mapVerificationFlag(row.worker_cpf_verified_at, row.worker_cpf_digits)
    : mapVerificationFlag(row.requester_cpf_verified_at, row.requester_cpf_digits);
  const otherParticipantSeenAt = isRequester
    ? row.worker_last_seen_at
    : row.requester_last_seen_at;
  const currentUserSeenAt = isRequester
    ? row.requester_last_seen_at
    : row.worker_last_seen_at;
  const messageRows = selectChatMessagesByChatId.all(row.id);
  const messages = messageRows.map((messageRow) =>
    mapChatMessage(messageRow, currentUserId, otherParticipantSeenAt)
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
    contactUserId: isRequester ? row.worker_user_id : row.requester_user_id,
    updatedAt: row.updated_at,
    isOnline: mapOnlineFlag(contactLastActiveAt),
    isVerified: contactVerified,
    role: isRequester ? "Prestador(a)" : "Cliente",
    unread,
    accent: getChatAccent(row.service_category),
    messages,
    serviceRequestId: row.service_request_id,
    serviceType: row.service_category,
    servicePreview: row.service_description,
  };
}

function getRequesterActiveRequest(userId) {
  return selectActiveRequestByRequester.get(userId, ...LIVE_REQUEST_STATUSES);
}

function getWorkerActiveRequest(userId) {
  return selectActiveRequestByWorker.get(userId, ...LIVE_REQUEST_STATUSES);
}

function getAnyBlockingRequestForUser(userId) {
  return (
    selectBlockingRequestByRequester.get(userId, ...BLOCKING_REQUEST_STATUSES) ??
    selectBlockingRequestByWorker.get(userId, ...BLOCKING_REQUEST_STATUSES) ??
    null
  );
}

function getServiceRequestForUpdate(requestId) {
  const request = selectRequestById.get(requestId);

  if (!request) {
    throw new HttpError(404, "Pedido não encontrado.");
  }

  return request;
}

function getSearchingRequestCutoffIso() {
  return new Date(Date.now() - SEARCHING_REQUEST_TTL_MS).toISOString();
}

function expireOldSearchingServiceRequests() {
  expireOldSearchingServiceRequestsStatement.run(nowIso(), getSearchingRequestCutoffIso());
}

const staleServiceRequestPruneInterval = setInterval(() => {
  try {
    expireOldSearchingServiceRequests();
  } catch (error) {
    console.error("Falha ao expirar pedidos antigos do mapa.", error);
  }
}, 60_000);

staleServiceRequestPruneInterval.unref?.();

function pruneExpiredWorkerRequestBlocks() {
  deleteExpiredServiceRequestWorkerBlocksStatement.run(nowIso());
}

function isWorkerTemporarilyBlockedFromRequest(requestId, workerUserId) {
  const activeBlock = selectActiveWorkerBlockForRequestStatement.get(
    requestId,
    workerUserId,
    nowIso()
  );

  return Boolean(activeBlock);
}

function blockWorkerFromRequestForTenMinutes(request) {
  if (!request.worker_user_id) {
    return;
  }

  const timestamp = nowIso();
  const expiresAt = new Date(Date.now() + REQUEST_WORKER_DECLINE_BLOCK_MS).toISOString();

  upsertServiceRequestWorkerBlockStatement.run(
    request.id,
    request.worker_user_id,
    request.requester_user_id,
    timestamp,
    expiresAt
  );
}

function ensureServiceChatForRequest(requestRow) {
  const existingChat = selectServiceChatByRequestId.get(requestRow.id);

  if (existingChat) {
    return existingChat;
  }

  if (!requestRow.worker_user_id) {
    throw new HttpError(409, "Este pedido ainda não possui um(a) profissional confirmado(a).");
  }

  const timestamp = nowIso();
  const chatId = createId();

  insertServiceChatStatement.run(
    chatId,
    requestRow.id,
    requestRow.requester_user_id,
    requestRow.worker_user_id,
    null,
    null,
    timestamp,
    timestamp
  );

  return selectServiceChatByRequestId.get(requestRow.id);
}

function markServiceChatSeen(chatRow, userId) {
  const timestamp = nowIso();

  if (chatRow.requester_user_id === userId) {
    markRequesterChatSeenStatement.run(timestamp, chatRow.id);
    return;
  }

  if (chatRow.worker_user_id === userId) {
    markWorkerChatSeenStatement.run(timestamp, chatRow.id);
    return;
  }

  throw new HttpError(403, "Você não participa desta conversa.");
}

function getServiceChatForUser(userId, chatId) {
  const chatRow = selectServiceChatByIdForUser.get(chatId, userId, userId);

  if (!chatRow) {
    throw new HttpError(404, "Conversa não encontrada.");
  }

  return mapServiceChat(chatRow, userId);
}

export function listPublicServiceRequests(viewerUserId) {
  if (!isUserCpfVerified(viewerUserId)) {
    return [];
  }

  expireOldSearchingServiceRequests();
  pruneExpiredWorkerRequestBlocks();

  return selectPublicMapRequests
    .all(viewerUserId, getSearchingRequestCutoffIso(), viewerUserId, nowIso())
    .map(mapServicePin);
}

export function getActiveServiceRequestForUser(userId) {
  expireOldSearchingServiceRequests();

  const requesterRequest = getRequesterActiveRequest(userId);

  if (requesterRequest) {
    return mapActiveServiceRequest(requesterRequest, "requester");
  }

  const workerRequest = getWorkerActiveRequest(userId);

  if (workerRequest) {
    return mapActiveServiceRequest(workerRequest, "worker");
  }

  return null;
}

export function listCompletedServiceRequestsForUser(userId) {
  return selectCompletedRequestsByRequester
    .all(userId)
    .map((row) => mapActiveServiceRequest(row, "requester"));
}

export function getPendingClientReviewForWorker(userId) {
  const request = selectPendingClientReviewByWorker.get(userId, userId);
  return mapActiveServiceRequest(request, "worker");
}

export function listServiceChatsForUser(userId) {
  return selectServiceChatsByUser
    .all(userId, userId)
    .map((row) => mapServiceChat(row, userId));
}

export function createServiceRequestForUser(user, payload) {
  expireOldSearchingServiceRequests();
  ensureRequesterCanCreateServiceRequest(user);

  const existingRequest = getAnyBlockingRequestForUser(user.id);

  if (existingRequest) {
    throw new HttpError(
      409,
      "Finalize ou libere sua solicitação atual antes de abrir outra."
    );
  }

  const timestamp = nowIso();
  const requestId = createId();

  insertServiceRequest.run(
    requestId,
    user.id,
    ensurePinType(payload.type),
    ensureDescription(payload.description),
    ensureCoordinate(payload.latitude, "Latitude"),
    ensureCoordinate(payload.longitude, "Longitude"),
    ensureAccuracy(payload.accuracy),
    normalizeLocationLabel(payload.locationLabel),
    timestamp,
    timestamp
  );

  createServiceRequestEvent(requestId, {
    actorUserId: user.id,
    actorRole: "requester",
    kind: "request-created",
    title: "Pedido publicado no mapa",
    description: `Pedido de ${ensurePinType(payload.type).toLowerCase()} publicado para buscar profissionais.`,
  });

  return getActiveServiceRequestForUser(user.id);
}

export function startServiceRequestFromCommunityChatForUser(user, chatId) {
  expireOldSearchingServiceRequests();
  ensureRequesterCanCreateServiceRequest(user);

  const existingByOrigin = selectServiceRequestByOriginCommunityChatId.get(chatId);

  if (existingByOrigin) {
    if (existingByOrigin.requester_user_id !== user.id) {
      throw new HttpError(403, "Você não pode acessar este atendimento.");
    }

    const existingChat = ensureServiceChatForRequest(existingByOrigin);
    markServiceChatSeen(existingChat, user.id);

    return {
      request: getActiveServiceRequestForUser(user.id),
      chat: getServiceChatForUser(user.id, existingChat.id),
    };
  }

  const communityChat = selectCommunityOfferChatForServiceStart.get(chatId, user.id);

  if (!communityChat) {
    throw new HttpError(404, "Conversa de divulgação não encontrada.");
  }

  if (communityChat.post_author_user_id === user.id) {
    throw new HttpError(409, "O(a) prestador(a) não pode fechar serviço com a própria divulgação.");
  }

  const existingRequest = getAnyBlockingRequestForUser(user.id);

  if (existingRequest) {
    throw new HttpError(
      409,
      "Finalize ou cancele seu atendimento atual antes de fechar outro serviço."
    );
  }

  const messageRows = selectCommunityChatMessagesForServiceStart.all(chatId);

  if (messageRows.length === 0) {
    throw new HttpError(409, "Converse com o(a) prestador(a) antes de fechar o serviço.");
  }

  const timestamp = nowIso();
  const requestId = createId();
  const category = ensurePinType(communityChat.post_category);
  const latitude = Number.isFinite(Number(communityChat.post_latitude))
    ? Number(communityChat.post_latitude)
    : 0;
  const longitude = Number.isFinite(Number(communityChat.post_longitude))
    ? Number(communityChat.post_longitude)
    : 0;

  try {
    db.exec("BEGIN IMMEDIATE");

    insertServiceRequestFromCommunityChat.run(
      requestId,
      user.id,
      category,
      "Atendimento combinado no chat.",
      latitude,
      longitude,
      null,
      String(communityChat.contact_address ?? "").trim().slice(0, 160),
      communityChat.post_author_user_id,
      timestamp,
      chatId,
      timestamp,
      timestamp
    );

    insertServiceChatStatement.run(
      createId(),
      requestId,
      user.id,
      communityChat.post_author_user_id,
      timestamp,
      null,
      timestamp,
      timestamp
    );

    const serviceChat = selectServiceChatByRequestId.get(requestId);

    for (const message of messageRows) {
      insertServiceChatMessageStatement.run(
        createId(),
        serviceChat.id,
        message.sender_user_id,
        message.body,
        message.message_type ?? "text",
        message.image_url ?? null,
        message.created_at
      );
    }

    deleteCommunityPostChatByIdStatement.run(chatId);

    db.exec("COMMIT");
  } catch (error) {
    try {
      db.exec("ROLLBACK");
    } catch {
      // Ignore rollback errors; the original failure is more useful.
    }

    throw error;
  }

  createServiceRequestEvent(requestId, {
    actorUserId: user.id,
    actorRole: "requester",
    kind: "chat-opened",
    title: "Serviço fechado pelo chat",
    description: "O cliente iniciou o fechamento do serviço a partir da conversa.",
  });

  createUserNotification(
    communityChat.post_author_user_id,
    "service-details-sent",
    `${getNotificationFirstName(user.fullName, "Cliente")} quer fechar um serviço pelo chat.`,
    {
      title: "Novo acordo",
      avatar: user.avatar ?? null,
      path: "/app/chat",
    }
  );

  const serviceChat = selectServiceChatByRequestId.get(requestId);

  return {
    request: getActiveServiceRequestForUser(user.id),
    chat: getServiceChatForUser(user.id, serviceChat.id),
  };
}

export function takeServiceRequestForUser(userId, requestId) {
  expireOldSearchingServiceRequests();
  ensureWorkerCanTakeServiceRequest(userId);

  const existingRequest = getAnyBlockingRequestForUser(userId);

  if (existingRequest) {
    throw new HttpError(
      409,
      "Finalize ou libere sua solicitação atual antes de pegar outro pedido."
    );
  }

  const request = getServiceRequestForUpdate(requestId);

  if (request.requester_user_id === userId) {
    throw new HttpError(409, "Você não pode pegar a própria solicitação.");
  }

  if (isWorkerTemporarilyBlockedFromRequest(requestId, userId)) {
    throw new HttpError(
      403,
      "A cliente recusou seu interesse recentemente. Este pedido ficará oculto para você por alguns minutos."
    );
  }

  if (request.status !== "searching" || request.worker_user_id) {
    throw new HttpError(409, "Este pedido já foi assumido por outro(a) profissional.");
  }

  const timestamp = nowIso();
  const result = assignServiceRequestStatement.run(userId, timestamp, timestamp, requestId);

  if (result.changes === 0) {
    throw new HttpError(409, "Este pedido já foi assumido por outro(a) profissional.");
  }

  createServiceRequestEvent(requestId, {
    actorUserId: userId,
    actorRole: "worker",
    kind: "worker-assigned",
    title: "Profissional assumiu a solicitação",
    description: "Um(a) profissional assumiu o pedido e está aguardando o aceite da cliente.",
  });

  const assignedRequest = getServiceRequestForUpdate(requestId);
  createUserNotification(
    assignedRequest.requester_user_id,
    "service-interest",
    `${getNotificationFirstName(assignedRequest.worker_name, "Prestador(a)")} demonstrou interesse no seu pedido.`,
    {
      title: "Prestador(a) interessado(a)",
      avatar: assignedRequest.worker_avatar ?? null,
      path: "/app/orders",
    }
  );

  return getActiveServiceRequestForUser(userId);
}

export function acceptServiceRequestForUser(userId, requestId) {
  const request = getServiceRequestForUpdate(requestId);

  if (request.requester_user_id !== userId) {
    throw new HttpError(403, "Você não pode aceitar este(a) profissional.");
  }

  if (!request.worker_user_id) {
    throw new HttpError(409, "Ainda não existe um(a) profissional atribuído(a) a este pedido.");
  }

  if (!REQUESTER_ACCEPTABLE_STATUSES.has(request.status)) {
    throw new HttpError(409, "Este pedido não está pronto para abrir a conversa.");
  }

  const chat = ensureServiceChatForRequest(request);
  const isFirstAcceptance = request.status === "assigned";

  if (isFirstAcceptance) {
    acceptAssignedServiceRequestStatement.run(nowIso(), requestId, userId);

    createUserNotification(
      request.worker_user_id,
      "service-accepted",
      `${getNotificationFirstName(request.requester_name, "Cliente")} te aceitou para o serviço.`,
      {
        avatar: request.requester_avatar ?? null,
        path: "/app/chat",
      }
    );

    createServiceRequestEvent(requestId, {
      actorUserId: userId,
      actorRole: "requester",
      kind: "chat-opened",
      title: "Conversa liberada",
      description: "A cliente aceitou o(a) profissional e liberou a conversa do atendimento.",
    });
  }

  markServiceChatSeen(chat, userId);

  return {
    request: getActiveServiceRequestForUser(userId),
    chat: getServiceChatForUser(userId, chat.id),
  };
}

export function declineAssignedServiceRequestForUser(userId, requestId, options = {}) {
  const request = getServiceRequestForUpdate(requestId);

  if (request.requester_user_id !== userId) {
    throw new HttpError(403, "Você não pode recusar este(a) profissional.");
  }

  if (request.status !== "assigned") {
    throw new HttpError(409, "Este pedido não está mais aguardando seu aceite.");
  }

  const result = declineAssignedServiceRequestStatement.run(nowIso(), requestId, userId);

  if (result.changes === 0) {
    throw new HttpError(409, "Não foi possível recusar este(a) profissional agora.");
  }

  if (options?.blockWorkerForTenMinutes) {
    blockWorkerFromRequestForTenMinutes(request);
  }

  if (request.worker_user_id) {
    createUserNotification(
      request.worker_user_id,
      "requester-continued-search",
      options?.blockWorkerForTenMinutes
        ? "Cliente recusou esta solicitação. Ela ficará indisponível para você por alguns minutos."
        : "Cliente decidiu continuar procurando.",
      {
        avatar: request.requester_avatar ?? null,
        path: "/app",
      }
    );
  }

  return getActiveServiceRequestForUser(userId);
}

export function submitServiceRequestDetailsForUser(userId, requestId, payload) {
  const request = getServiceRequestForUpdate(requestId);

  if (request.requester_user_id !== userId) {
    throw new HttpError(403, "Você não pode alterar os detalhes deste pedido.");
  }

  if (!request.worker_user_id || !request.chat_id) {
    throw new HttpError(409, "Abra a conversa com o(a) profissional antes de continuar.");
  }

  if (!["chatting", "details", "waiting-worker"].includes(request.status)) {
    throw new HttpError(409, "Este pedido não aceita novos detalhes agora.");
  }

  const details = ensureServiceDetails(payload);

  updateServiceRequestDetailsStatement.run(
    JSON.stringify(details),
    details.latitude,
    details.longitude,
    details.accuracy,
    details.locationLabel,
    nowIso(),
    requestId,
    userId
  );

  createServiceRequestEvent(requestId, {
    actorUserId: userId,
    actorRole: "requester",
    kind: "details-submitted",
    title: "Detalhes enviados",
    description: `Valor ${details.price}, data ${details.serviceDate} e horário ${details.schedule} enviados para confirmação.`,
  });

  if (request.worker_user_id) {
    createUserNotification(
      request.worker_user_id,
      "service-details-sent",
      `${getNotificationFirstName(request.requester_name, "Cliente")} enviou valor, data e horário para o atendimento.`,
      {
        avatar: request.requester_avatar ?? null,
        path: "/app/chat",
      }
    );
  }

  return getActiveServiceRequestForUser(userId);
}

export function confirmServiceRequestPaymentForUser(userId, requestId) {
  const request = getServiceRequestForUpdate(requestId);

  if (request.worker_user_id !== userId) {
    throw new HttpError(403, "Você não pode confirmar está etapa.");
  }

  if (request.status !== "waiting-worker") {
    throw new HttpError(409, "Este pedido não está aguardando sua confirmação.");
  }

  if (!isPixWithdrawalReadyForUser(userId)) {
    throw new HttpError(
      409,
      "Cadastre sua chave Pix no perfil antes de liberar o pagamento."
    );
  }

  const result = confirmServiceRequestPaymentStatement.run(nowIso(), requestId, userId);

  if (result.changes === 0) {
    throw new HttpError(409, "Não foi possível liberar o pagamento agora.");
  }

  clearAsaasPaymentSessionForServiceRequest(requestId);

  createServiceRequestEvent(requestId, {
    actorUserId: userId,
    actorRole: "worker",
    kind: "payment-ready",
    title: "Pagamento liberado",
    description: "O(a) profissional confirmou os detalhes e liberou a etapa de pagamento protegido.",
  });

  createUserNotification(
    request.requester_user_id,
    "payment-ready",
    `${getNotificationFirstName(request.worker_name, "Profissional")} confirmou os detalhes. O Pix já pode ser pago.`,
    {
      avatar: request.worker_avatar ?? null,
      path: "/app/orders",
    }
  );

  return getActiveServiceRequestForUser(userId);
}

export async function markServiceRequestPaidForUser(userId, requestId) {
  const request = getServiceRequestForUpdate(requestId);

  if (request.requester_user_id !== userId) {
    throw new HttpError(403, "Você não pode confirmar este pagamento.");
  }

  if (!["payment", "confirmed"].includes(request.status)) {
    throw new HttpError(409, "Este pedido ainda não está pronto para verificar pagamento.");
  }

  await refreshAsaasPaymentForServiceRequest(userId, requestId);

  return {
    ok: true,
    request: getActiveServiceRequestForUser(userId),
  };
}

export function markServiceRequestWorkerArrivedForUser(userId, requestId) {
  const request = getServiceRequestForUpdate(requestId);

  if (request.requester_user_id !== userId) {
    throw new HttpError(403, "Você não pode registrar a chegada neste atendimento.");
  }

  if (request.status !== "confirmed") {
    throw new HttpError(409, "A chegada só pode ser registrada após o pagamento confirmado.");
  }

  if (!request.worker_user_id) {
    throw new HttpError(409, "Não existe um(a) prestador(a) vinculado(a) a este atendimento.");
  }

  if (hasServiceRequestEvent(requestId, "worker-arrived")) {
    return {
      ok: true,
      request: getActiveServiceRequestForUser(userId),
    };
  }

  const timestamp = nowIso();

  createServiceRequestEvent(requestId, {
    actorUserId: userId,
    actorRole: "requester",
    kind: "worker-arrived",
    title: "Prestador(a) chegou",
    description: "O(a) cliente confirmou a chegada do(a) prestador(a) ao local do atendimento.",
    createdAt: timestamp,
  });

  createUserNotification(
    request.worker_user_id,
    "service-arrival-confirmed",
    `${getNotificationFirstName(request.requester_name, "Cliente")} confirmou sua chegada ao atendimento.`,
    {
      avatar: request.requester_avatar ?? null,
      path: "/app",
    }
  );

  return {
    ok: true,
    request: getActiveServiceRequestForUser(userId),
  };
}

export function markServiceChatReadForUser(userId, chatId) {
  const chatRow = selectServiceChatByIdForUser.get(chatId, userId, userId);

  if (!chatRow) {
    throw new HttpError(404, "Conversa não encontrada.");
  }

  markServiceChatSeen(chatRow, userId);

  return getServiceChatForUser(userId, chatId);
}

export function archiveServiceChatForUser(userId, chatId) {
  const chatRow = selectServiceChatByIdForUser.get(chatId, userId, userId);

  if (!chatRow) {
    throw new HttpError(404, "Conversa não encontrada.");
  }

  const timestamp = nowIso();

  if (chatRow.requester_user_id === userId) {
    archiveRequesterServiceChatStatement.run(timestamp, chatId, userId);
    return { ok: true };
  }

  if (chatRow.worker_user_id === userId) {
    archiveWorkerServiceChatStatement.run(timestamp, chatId, userId);
    return { ok: true };
  }

  throw new HttpError(403, "Você não participa desta conversa.");
}

export function sendServiceChatMessageForUser(userId, chatId, payload) {
  const chatRow = selectServiceChatByIdForUser.get(chatId, userId, userId);

  if (!chatRow) {
    throw new HttpError(404, "Conversa não encontrada.");
  }

  const senderIsRequester = chatRow.requester_user_id === userId;
  const messagePayload = ensureChatMessagePayload(payload, {
    allowImage: senderIsRequester,
  });
  const timestamp = nowIso();

  insertServiceChatMessageStatement.run(
    createId(),
    chatId,
    userId,
    messagePayload.body,
    messagePayload.messageType,
    messagePayload.imageUrl,
    timestamp
  );
  touchAndUnarchiveServiceChatStatement.run(timestamp, chatId);
  markServiceChatSeen(chatRow, userId);

  const recipientUserId = senderIsRequester
    ? chatRow.worker_user_id
    : chatRow.requester_user_id;
  const senderName = senderIsRequester
    ? chatRow.requester_name
    : chatRow.worker_name;
  const senderAvatar = senderIsRequester
    ? chatRow.requester_avatar
    : chatRow.worker_avatar;

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

  return getServiceChatForUser(userId, chatId);
}

export async function cancelServiceRequestForUser(userId, requestId) {
  const request = getServiceRequestForUpdate(requestId);

  const timestamp = nowIso();

  if (request.requester_user_id === userId) {
    if (!CANCELLABLE_REQUEST_STATUSES.includes(request.status)) {
      throw new HttpError(409, "Este pedido já não está ativo no mapa.");
    }

    if (request.status === "payment" && request.asaas_payment_id) {
      await cancelAsaasPendingPaymentForServiceRequest(requestId);
    }

    cancelServiceRequestByRequesterStatement.run(timestamp, requestId, userId);
    createServiceRequestEvent(requestId, {
      actorUserId: userId,
      actorRole: "requester",
      kind: "request-cancelled",
      title: "Solicitação cancelada",
      description: "A cliente cancelou o atendimento antes da conclusão.",
    });
    return { ok: true };
  }

  if (request.worker_user_id === userId) {
    if (request.status !== "assigned") {
      throw new HttpError(409, "Não foi possível liberar este pedido agora.");
    }

    releaseServiceRequestByWorkerStatement.run(timestamp, requestId, userId);
    createServiceRequestEvent(requestId, {
      actorUserId: userId,
      actorRole: "worker",
      kind: "worker-released",
      title: "Profissional saiu do pedido",
      description: "O(a) profissional liberou a solicitação para o mapa novamente.",
    });
    return { ok: true };
  }

  throw new HttpError(403, "Você não pode alterar este pedido.");
}

export async function deleteServiceRequestForUser(userId, requestId) {
  const request = getServiceRequestForUpdate(requestId);

  if (request.requester_user_id !== userId) {
    throw new HttpError(403, "Você não pode excluir este pedido.");
  }

  if (!CANCELLABLE_REQUEST_STATUSES.includes(request.status)) {
    throw new HttpError(409, "Este pedido não pode mais ser apagado.");
  }

  if (request.status === "payment" && request.asaas_payment_id) {
    await cancelAsaasPendingPaymentForServiceRequest(requestId);
  }

  const result = deleteServiceRequestByRequesterStatement.run(requestId, userId);

  if (result.changes === 0) {
    throw new HttpError(409, "Não foi possível apagar este pedido agora.");
  }

  if (request.worker_user_id) {
    createUserNotification(
      request.worker_user_id,
      "service-cancelled",
      "A cliente cancelou a solicitação de serviço.",
      {
        avatar: request.requester_avatar ?? null,
        path: "/app",
      }
    );
  }

  return { ok: true };
}

export async function releaseServiceRequestPaymentForUser(userId, requestId, payload) {
  const request = getServiceRequestForUpdate(requestId);

  if (request.requester_user_id !== userId) {
    throw new HttpError(403, "Você não pode liberar este pagamento.");
  }

  if (request.status !== "confirmed") {
    throw new HttpError(409, "Este atendimento ainda não está pronto para liberar o pagamento.");
  }

  if (String(request.dispute_status ?? "").trim().toLowerCase() === "open") {
    throw new HttpError(
      409,
      "Existe uma disputa aberta neste atendimento. Resolva a disputa antes de liberar o pagamento."
    );
  }

  if (!request.worker_user_id) {
    throw new HttpError(409, "Não existe um(a) profissional vinculado(a) a este atendimento.");
  }

  if (!hasServiceRequestEvent(requestId, "worker-arrived")) {
    throw new HttpError(
      409,
      "Confirme a chegada do(a) prestador(a) antes de liberar o pagamento."
    );
  }

  const review = ensureServiceReview(payload);
  const timestamp = nowIso();
  let result = null;

  db.exec("BEGIN");

  try {
    insertServiceReviewStatement.run(
      createId(),
      requestId,
      userId,
      request.worker_user_id,
      review.rating,
      review.comment,
      timestamp
    );

    result = db
      .prepare(
        `
          UPDATE service_requests
          SET status = 'completed', updated_at = ?
          WHERE id = ? AND requester_user_id = ? AND status = 'confirmed'
        `
      )
      .run(timestamp, requestId, userId);

    if (result.changes === 0) {
      throw new HttpError(409, "Não foi possível liberar este pagamento agora.");
    }

    deleteServiceChatByRequestIdStatement.run(requestId);

    createServiceRequestEvent(requestId, {
      actorUserId: userId,
      actorRole: "requester",
      kind: "service-completed",
      title: "Serviço concluído",
      description: "A cliente confirmou a conclusão do atendimento e liberou o pagamento ao(à) profissional.",
    });

    createUserNotification(
      request.worker_user_id,
      "wallet-available",
      "Serviço concluído. O valor deste atendimento já está disponível para saque.",
      {
        avatar: request.requester_avatar ?? null,
        path: "/app/wallet",
      }
    );

    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");

    if (
      error instanceof Error &&
      /UNIQUE constraint failed: service_reviews\.service_request_id/.test(error.message)
    ) {
      throw new HttpError(409, "Este atendimento já recebeu avaliação.");
    }

    throw error;
  }

  return { ok: true };
}

export function reviewClientForCompletedServiceForUser(userId, requestId, payload) {
  const request = getServiceRequestForUpdate(requestId);

  if (request.worker_user_id !== userId) {
    throw new HttpError(403, "Você não pode avaliar este cliente.");
  }

  if (request.status !== "completed") {
    throw new HttpError(409, "Este atendimento ainda não foi concluído.");
  }

  if (selectServiceReviewByRequestTargetStatement.get(requestId, request.requester_user_id)) {
    throw new HttpError(409, "Este cliente já recebeu sua avaliação neste atendimento.");
  }

  const review = ensureServiceReview(payload);
  const timestamp = nowIso();

  insertServiceReviewStatement.run(
    createId(),
    requestId,
    userId,
    request.requester_user_id,
    review.rating,
    review.comment,
    timestamp
  );

  createServiceRequestEvent(requestId, {
    actorUserId: userId,
    actorRole: "worker",
    kind: "client-reviewed",
    title: "Cliente avaliado(a)",
    description: "O(a) prestador(a) registrou a avaliação do cliente.",
  });

  createUserNotification(
    request.requester_user_id,
    "service-completed",
    "O(a) prestador(a) avaliou seu perfil neste atendimento.",
    {
      avatar: request.worker_avatar ?? null,
      path: "/app/profile",
    }
  );

  return { ok: true };
}

export function openServiceRequestDisputeForUser(userId, requestId, payload) {
  const request = getServiceRequestForUpdate(requestId);

  if (request.requester_user_id !== userId && request.worker_user_id !== userId) {
    throw new HttpError(403, "Você não participa deste atendimento.");
  }

  if (!DISPUTABLE_REQUEST_STATUSES.has(request.status)) {
    throw new HttpError(409, "Este atendimento ainda não aceita disputa.");
  }

  if (String(request.dispute_status ?? "").trim().toLowerCase() === "open") {
    throw new HttpError(409, "Já existe uma disputa aberta para este atendimento.");
  }

  const reason = ensureDisputeReason(payload?.reason);
  const actorRole = request.requester_user_id === userId ? "requester" : "worker";
  const counterpartUserId =
    actorRole === "requester" ? request.worker_user_id ?? null : request.requester_user_id;
  const timestamp = nowIso();

  const result = openServiceRequestDisputeStatement.run(
    reason,
    userId,
    timestamp,
    timestamp,
    requestId
  );

  if (result.changes === 0) {
    throw new HttpError(409, "Não foi possível abrir a disputa agora.");
  }

  createServiceRequestEvent(requestId, {
    actorUserId: userId,
    actorRole,
    kind: "dispute-opened",
    title: "Disputa aberta",
    description: reason,
  });

  if (counterpartUserId) {
    createUserNotification(
      counterpartUserId,
      "dispute-opened",
      actorRole === "requester"
        ? "A cliente abriu uma disputa neste atendimento."
        : "O(a) profissional abriu uma disputa neste atendimento.",
      {
        avatar:
          actorRole === "requester"
            ? request.requester_avatar ?? null
            : request.worker_avatar ?? null,
        path: actorRole === "requester" ? "/app" : "/app/orders",
      }
    );
  }

  return getActiveServiceRequestForUser(userId);
}

export async function resolveServiceRequestDisputeForAdmin(adminUserId, requestId, payload) {
  const request = getServiceRequestForUpdate(requestId);
  const disputeStatus = String(request.dispute_status ?? "").trim().toLowerCase();

  if (disputeStatus !== "open") {
    throw new HttpError(409, "Este atendimento não possui disputa aberta.");
  }

  const action = ensureDisputeResolutionAction(payload?.action);
  const adminNote = String(payload?.adminNote ?? "").trim().slice(0, 400);
  const timestamp = nowIso();
  const refundAmountCents = Number(request.payment_amount_total_cents) || 0;

  if (action === "refund") {
    if (request.worker_withdrawal_id) {
      throw new HttpError(
        409,
        "O saque deste atendimento já foi iniciado. Finalize manualmente fora do fluxo automático."
      );
    }

    await refundAsaasPaymentForServiceRequest(requestId);

    resolveServiceRequestDisputeStatement.run(
      "refunded",
      "refund",
      timestamp,
      adminNote,
      "DONE",
      refundAmountCents,
      timestamp,
      "cancelled",
      timestamp,
      requestId
    );

    deleteServiceChatByRequestIdStatement.run(requestId);

    createServiceRequestEvent(requestId, {
      actorUserId: adminUserId,
      actorRole: "admin",
      kind: "dispute-resolved",
      title: "Disputa resolvida com reembolso",
      description: adminNote || "O admin aprovou o reembolso integral deste atendimento.",
    });

    createUserNotification(
      request.requester_user_id,
      "dispute-resolved",
      "Sua disputa foi aprovada e o reembolso do atendimento foi iniciado."
    );

    if (request.worker_user_id) {
      createUserNotification(
        request.worker_user_id,
        "dispute-resolved",
        "O atendimento foi encerrado pelo admin com reembolso para a cliente."
      );
    }

    return { ok: true, request: null };
  }

  const result = resolveServiceRequestDisputeStatement.run(
    "resolved",
    "continue",
    timestamp,
    adminNote,
    request.refund_status ?? null,
    request.refund_amount_cents ?? null,
    request.refunded_at ?? null,
    request.status,
    timestamp,
    requestId
  );

  if (result.changes === 0) {
    throw new HttpError(409, "Não foi possível resolver a disputa agora.");
  }

  createServiceRequestEvent(requestId, {
    actorUserId: adminUserId,
    actorRole: "admin",
    kind: "dispute-resolved",
    title: "Disputa encerrada",
    description:
      adminNote || "O admin encerrou a disputa e autorizou o fluxo normal do atendimento.",
  });

  createUserNotification(
    request.requester_user_id,
    "dispute-resolved",
    "A disputa foi analisada. O atendimento pode seguir normalmente."
  );

  if (request.worker_user_id) {
    createUserNotification(
      request.worker_user_id,
      "dispute-resolved",
      "A disputa foi analisada. O atendimento pode seguir normalmente."
    );
  }

  return { ok: true, request: getActiveServiceRequestForUser(request.requester_user_id) };
}

