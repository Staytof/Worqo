import fs from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";

const [, , dbPathArg, adminEmailArg] = process.argv;

if (!dbPathArg || !adminEmailArg) {
  console.error("Uso: node scripts/cleanup-admin-only-users.mjs <db-path> <admin-email>");
  process.exit(1);
}

const dbPath = path.resolve(dbPathArg);
const adminEmail = String(adminEmailArg).trim().toLowerCase();

if (!fs.existsSync(dbPath)) {
  console.error(`Banco nao encontrado: ${dbPath}`);
  process.exit(1);
}

const backupStamp = new Date().toISOString().replace(/[:.]/g, "-");
const backupPath = dbPath.replace(/\.db$/i, `.pre-admin-only-${backupStamp}.backup.db`);

{
  const checkpointDb = new DatabaseSync(dbPath);
  checkpointDb.exec("PRAGMA wal_checkpoint(TRUNCATE)");
  checkpointDb.close();
}

fs.copyFileSync(dbPath, backupPath);

const db = new DatabaseSync(dbPath);
const admin = db
  .prepare("SELECT id, email, full_name FROM users WHERE lower(email) = ?")
  .get(adminEmail);

if (!admin) {
  console.error(`Administrador nao encontrado: ${adminEmail}`);
  process.exit(1);
}

db.exec("PRAGMA foreign_keys = ON");
db.exec("BEGIN");

try {
  db.prepare("DELETE FROM oauth_login_states").run();
  db.prepare("DELETE FROM verification_codes WHERE user_id <> ?").run(admin.id);
  db.prepare("DELETE FROM sessions WHERE user_id <> ?").run(admin.id);
  db.prepare("DELETE FROM user_notifications WHERE user_id <> ?").run(admin.id);
  db.prepare("DELETE FROM user_push_devices WHERE user_id <> ?").run(admin.id);
  db.prepare("DELETE FROM worker_withdrawals WHERE user_id <> ?").run(admin.id);
  db.prepare("DELETE FROM service_reviews WHERE reviewer_user_id <> ? OR target_user_id <> ?").run(
    admin.id,
    admin.id
  );
  db.prepare("DELETE FROM community_post_chat_messages WHERE sender_user_id <> ?").run(admin.id);
  db.prepare(
    "DELETE FROM community_post_chats WHERE post_author_user_id <> ? OR contact_user_id <> ?"
  ).run(admin.id, admin.id);
  db.prepare("DELETE FROM community_posts WHERE author_user_id <> ?").run(admin.id);
  db.prepare("DELETE FROM service_chat_messages WHERE sender_user_id <> ?").run(admin.id);
  db.prepare("DELETE FROM service_chats WHERE requester_user_id <> ? OR worker_user_id <> ?").run(
    admin.id,
    admin.id
  );
  db.prepare(
    "DELETE FROM service_request_worker_blocks WHERE worker_user_id <> ? OR requester_user_id <> ?"
  ).run(admin.id, admin.id);
  db.prepare(
    "DELETE FROM service_request_events WHERE actor_user_id IS NOT NULL AND actor_user_id <> ?"
  ).run(admin.id);
  db.prepare(
    "DELETE FROM service_requests WHERE requester_user_id <> ? OR (worker_user_id IS NOT NULL AND worker_user_id <> ?)"
  ).run(admin.id, admin.id);
  db.prepare("DELETE FROM support_ticket_messages WHERE sender_user_id <> ?").run(admin.id);
  db.prepare("DELETE FROM support_tickets WHERE requester_user_id <> ?").run(admin.id);
  db.prepare("DELETE FROM client_error_reports WHERE user_id IS NOT NULL AND user_id <> ?").run(
    admin.id
  );

  const deletedUsers = db.prepare("DELETE FROM users WHERE id <> ?").run(admin.id).changes;
  const users = db.prepare("SELECT id, email, full_name FROM users ORDER BY created_at").all();
  const counts = {
    communityPosts: db.prepare("SELECT COUNT(*) AS total FROM community_posts").get().total,
    communityPostChats: db.prepare("SELECT COUNT(*) AS total FROM community_post_chats").get().total,
    communityPostMessages: db
      .prepare("SELECT COUNT(*) AS total FROM community_post_chat_messages")
      .get().total,
    sessions: db.prepare("SELECT COUNT(*) AS total FROM sessions").get().total,
    serviceRequests: db.prepare("SELECT COUNT(*) AS total FROM service_requests").get().total,
    serviceChats: db.prepare("SELECT COUNT(*) AS total FROM service_chats").get().total,
    serviceChatMessages: db.prepare("SELECT COUNT(*) AS total FROM service_chat_messages").get().total,
    notifications: db.prepare("SELECT COUNT(*) AS total FROM user_notifications").get().total,
    pushDevices: db.prepare("SELECT COUNT(*) AS total FROM user_push_devices").get().total,
    reviews: db.prepare("SELECT COUNT(*) AS total FROM service_reviews").get().total,
    withdrawals: db.prepare("SELECT COUNT(*) AS total FROM worker_withdrawals").get().total,
    verificationCodes: db.prepare("SELECT COUNT(*) AS total FROM verification_codes").get().total,
    timelineEvents: db.prepare("SELECT COUNT(*) AS total FROM service_request_events").get().total,
    supportTickets: db.prepare("SELECT COUNT(*) AS total FROM support_tickets").get().total,
    supportMessages: db.prepare("SELECT COUNT(*) AS total FROM support_ticket_messages").get().total,
    clientErrorReports: db.prepare("SELECT COUNT(*) AS total FROM client_error_reports").get().total,
  };

  db.exec("COMMIT");

  console.log(
    JSON.stringify(
      {
        dbPath,
        backupPath,
        admin,
        deletedUsers,
        counts,
        users,
      },
      null,
      2
    )
  );
} catch (error) {
  db.exec("ROLLBACK");
  throw error;
} finally {
  db.close();
}
