import { db } from "../server/db.mjs";
import { formatCpf } from "../server/cpf-utils.mjs";
import { createId, createPasswordHash, nowIso } from "../server/security.mjs";

const reviewEmail = (process.env.PLAY_REVIEW_EMAIL || "play-review@worqo.app")
  .trim()
  .toLowerCase();

const reviewCpfDigits = "11144477735";
const professionalCpfDigits = "52998224725";
const demoProfessionalEmail = "demo-profissional@worqo.app";
const demoProfessionalPhone = "review:demo-profissional";

const seedIds = {
  communityPost: "play-review-demo-community-post",
  communityChat: "play-review-demo-community-chat",
  serviceRequest: "play-review-demo-service-request",
};

const timestamp = nowIso();

function requireReviewUser() {
  const user = db.prepare("SELECT * FROM users WHERE email = ?").get(reviewEmail);

  if (!user) {
    throw new Error(
      `Conta de revisão não encontrada (${reviewEmail}). Rode scripts/ensure-play-review-user.mjs primeiro.`
    );
  }

  return user;
}

function upsertDemoProfessional() {
  const existingUser = db
    .prepare("SELECT * FROM users WHERE email = ?")
    .get(demoProfessionalEmail);

  if (existingUser) {
    db.prepare(
      `
        UPDATE users
        SET
          full_name = 'Ana Souza Profissional',
          phone = ?,
          birth_date = '1988-04-12',
          avatar = NULL,
          headline = 'Limpeza residencial e organização',
          bio = 'Perfil demonstrativo para revisão do Google Play. Ofereço serviços locais pelo mural do Worko.',
          professions_json = '["Limpeza residencial","Organização"]',
          skills_json = '["Limpeza pós-obra","Faxina leve","Organização"]',
          availability_note = 'Disponível hoje para demonstração.',
          cpf = ?,
          cpf_digits = ?,
          cpf_verified_at = ?,
          cpf_verified_name = 'Ana Souza Profissional',
          cpf_verification_provider = 'play-review-demo',
          cpf_verification_checked_at = ?,
          terms_accepted_at = COALESCE(terms_accepted_at, ?),
          privacy_accepted_at = COALESCE(privacy_accepted_at, ?),
          legal_version = '2026-06-18',
          address = 'Suzano, SP',
          verified_channel = 'email',
          email_verified_at = COALESCE(email_verified_at, ?),
          phone_verified_at = NULL,
          profile_setup_completed_at = COALESCE(profile_setup_completed_at, ?),
          last_active_at = ?,
          suspended_at = NULL,
          suspension_reason = NULL,
          deleted_at = NULL,
          deletion_requested_at = NULL,
          updated_at = ?
        WHERE id = ?
      `
    ).run(
      demoProfessionalPhone,
      formatCpf(professionalCpfDigits),
      professionalCpfDigits,
      timestamp,
      timestamp,
      timestamp,
      timestamp,
      timestamp,
      timestamp,
      timestamp,
      timestamp,
      existingUser.id
    );

    return existingUser.id;
  }

  const userId = createId();

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
        headline,
        bio,
        professions_json,
        skills_json,
        availability_note,
        cpf,
        cpf_digits,
        cpf_verified_at,
        cpf_verified_name,
        cpf_verification_provider,
        cpf_verification_checked_at,
        terms_accepted_at,
        privacy_accepted_at,
        legal_version,
        address,
        verified_channel,
        email_verified_at,
        phone_verified_at,
        profile_setup_completed_at,
        last_active_at,
        auth_provider,
        created_at,
        updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, NULL, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'email', ?, NULL, ?, ?, 'password', ?, ?)
    `
  ).run(
    userId,
    "Ana Souza Profissional",
    demoProfessionalEmail,
    demoProfessionalPhone,
    "1988-04-12",
    createPasswordHash("DemoProfissional#2026!"),
    "Limpeza residencial e organização",
    "Perfil demonstrativo para revisão do Google Play. Ofereço serviços locais pelo mural do Worko.",
    JSON.stringify(["Limpeza residencial", "Organização"]),
    JSON.stringify(["Limpeza pós-obra", "Faxina leve", "Organização"]),
    "Disponível hoje para demonstração.",
    formatCpf(professionalCpfDigits),
    professionalCpfDigits,
    timestamp,
    "Ana Souza Profissional",
    "play-review-demo",
    timestamp,
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

  return userId;
}

function verifyReviewUser(userId) {
  db.prepare(
    `
      UPDATE users
      SET
        cpf = ?,
        cpf_digits = ?,
        cpf_verified_at = ?,
        cpf_verified_name = COALESCE(NULLIF(cpf_verified_name, ''), full_name),
        cpf_verification_provider = 'play-review-demo',
        cpf_verification_checked_at = ?,
        terms_accepted_at = COALESCE(terms_accepted_at, ?),
        privacy_accepted_at = COALESCE(privacy_accepted_at, ?),
        legal_version = COALESCE(legal_version, '2026-06-18'),
        profile_setup_completed_at = COALESCE(profile_setup_completed_at, ?),
        last_active_at = ?,
        suspended_at = NULL,
        suspension_reason = NULL,
        deleted_at = NULL,
        deletion_requested_at = NULL,
        updated_at = ?
      WHERE id = ?
    `
  ).run(
    formatCpf(reviewCpfDigits),
    reviewCpfDigits,
    timestamp,
    timestamp,
    timestamp,
    timestamp,
    timestamp,
    timestamp,
    timestamp,
    userId
  );
}

function clearDemoContent() {
  db.prepare("DELETE FROM service_requests WHERE id = ?").run(seedIds.serviceRequest);
  db.prepare("DELETE FROM community_posts WHERE id = ?").run(seedIds.communityPost);
}

function createCommunityDemo(reviewUserId, professionalUserId) {
  db.prepare(
    `
      INSERT INTO community_posts (
        id,
        author_user_id,
        post_type,
        category,
        content,
        created_at,
        updated_at
      ) VALUES (?, ?, 'offer', 'Limpeza', ?, ?, ?)
    `
  ).run(
    seedIds.communityPost,
    professionalUserId,
    "Ofereço limpeza residencial hoje em Suzano. Atendimento combinado pelo chat do Worko.",
    timestamp,
    timestamp
  );

  db.prepare(
    `
      INSERT INTO community_post_chats (
        id,
        post_id,
        post_author_user_id,
        contact_user_id,
        post_author_last_seen_at,
        contact_last_seen_at,
        created_at,
        updated_at
      ) VALUES (?, ?, ?, ?, NULL, NULL, ?, ?)
    `
  ).run(
    seedIds.communityChat,
    seedIds.communityPost,
    professionalUserId,
    reviewUserId,
    timestamp,
    timestamp
  );

  const messages = [
    {
      senderId: professionalUserId,
      body: "Olá! Sou a Ana, profissional de limpeza. Posso atender hoje à tarde pelo Worko.",
    },
    {
      senderId: reviewUserId,
      body: "Perfeito, preciso de uma limpeza rápida em apartamento pequeno. Podemos combinar pelo app?",
    },
    {
      senderId: professionalUserId,
      body: "Sim. Combinamos por aqui e você acompanha a conversa pelo chat do mural.",
    },
  ];

  for (const message of messages) {
    db.prepare(
      `
        INSERT INTO community_post_chat_messages (
          id,
          chat_id,
          sender_user_id,
          body,
          created_at
        ) VALUES (?, ?, ?, ?, ?)
      `
    ).run(createId(), seedIds.communityChat, message.senderId, message.body, timestamp);
  }
}

function createServiceRequestDemo(reviewUserId) {
  db.prepare(
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
      ) VALUES (?, ?, 'Limpeza', ?, -23.5428, -46.3100, 30, 'Suzano, SP', NULL, NULL, NULL, 'searching', ?, ?)
    `
  ).run(
    seedIds.serviceRequest,
    reviewUserId,
    "Preciso de limpeza residencial de demonstração para avaliação do app.",
    timestamp,
    timestamp
  );

  db.prepare(
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
      ) VALUES (?, ?, ?, 'requester', 'request-created', 'Pedido publicado no mapa', ?, '{}', ?)
    `
  ).run(
    createId(),
    seedIds.serviceRequest,
    reviewUserId,
    "Pedido de limpeza criado para demonstrar o fluxo de solicitação na revisão do Google Play.",
    timestamp
  );
}

db.exec("BEGIN");

try {
  const reviewUser = requireReviewUser();
  const professionalUserId = upsertDemoProfessional();

  verifyReviewUser(reviewUser.id);
  clearDemoContent();
  createCommunityDemo(reviewUser.id, professionalUserId);
  createServiceRequestDemo(reviewUser.id);

  db.exec("COMMIT");

  console.log("Demo de revisão preparada com sucesso.");
  console.log(`Conta tester: ${reviewEmail}`);
  console.log("CPF tester: verificado");
  console.log(`Post do mural: ${seedIds.communityPost}`);
  console.log(`Chat do mural: ${seedIds.communityChat}`);
  console.log(`Pedido de serviço: ${seedIds.serviceRequest}`);
} catch (error) {
  db.exec("ROLLBACK");
  throw error;
}
