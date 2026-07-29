import fs from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";

const [, , dbPathArg, ...keepEmailArgs] = process.argv;

if (!dbPathArg || keepEmailArgs.length === 0) {
  console.error("Uso: node scripts/purge-users-keep-emails.mjs <db-path> <email-para-manter>...");
  process.exit(1);
}

const dbPath = path.resolve(dbPathArg);
const keepEmails = keepEmailArgs.map((email) => String(email).trim().toLowerCase()).filter(Boolean);

if (!fs.existsSync(dbPath)) {
  console.error(`Banco nao encontrado: ${dbPath}`);
  process.exit(1);
}

const backupStamp = new Date().toISOString().replace(/[:.]/g, "-");
const backupPath = dbPath.replace(/\.db$/i, `.pre-user-purge-${backupStamp}.backup.db`);

{
  const checkpointDb = new DatabaseSync(dbPath);
  checkpointDb.exec("PRAGMA wal_checkpoint(TRUNCATE)");
  checkpointDb.close();
}

fs.copyFileSync(dbPath, backupPath);

const db = new DatabaseSync(dbPath);

function tableExists(table) {
  return Boolean(
    db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?").get(table)
  );
}

function tableColumns(table) {
  if (!tableExists(table)) return new Set();
  return new Set(db.prepare(`PRAGMA table_info(${table})`).all().map((column) => column.name));
}

function deleteIfExists(table, clauses, ids) {
  if (!ids.length || !tableExists(table)) return 0;
  const columns = tableColumns(table);
  const validClauses = clauses.filter((clause) => columns.has(clause.column));
  if (!validClauses.length) return 0;

  const marks = ids.map(() => "?").join(", ");
  const where = validClauses.map((clause) => `${clause.column} IN (${marks})`).join(" OR ");
  const params = validClauses.flatMap(() => ids);
  return db.prepare(`DELETE FROM ${table} WHERE ${where}`).run(...params).changes;
}

const keepMarks = keepEmails.map(() => "?").join(", ");
const keepUsers = db
  .prepare(`SELECT id, email, full_name FROM users WHERE lower(email) IN (${keepMarks})`)
  .all(...keepEmails);
const foundEmails = new Set(keepUsers.map((user) => String(user.email).toLowerCase()));
const missing = keepEmails.filter((email) => !foundEmails.has(email));

if (missing.length) {
  console.error(`Operacao cancelada. Contas protegidas ausentes: ${missing.join(", ")}`);
  db.close();
  process.exit(1);
}

const targetUsers = db
  .prepare(`SELECT id, email, full_name FROM users WHERE lower(email) NOT IN (${keepMarks})`)
  .all(...keepEmails);
const targetIds = targetUsers.map((user) => user.id);

console.log("Backup criado em:", backupPath);
console.log("Contas preservadas:");
console.table(keepUsers);
console.log(`Usuarios que serao removidos: ${targetUsers.length}`);
console.table(targetUsers.map(({ id, email, full_name }) => ({ id, email, full_name })));

if (!targetIds.length) {
  console.log("Nada para apagar.");
  db.close();
  process.exit(0);
}

db.exec("PRAGMA foreign_keys = OFF");
db.exec("BEGIN");

try {
  const deleted = {};

  if (tableExists("oauth_login_states")) {
    deleted.oauth_login_states = db.prepare("DELETE FROM oauth_login_states").run().changes;
  }

  const tables = [
    ["verification_codes", ["user_id"]],
    ["sessions", ["user_id"]],
    ["user_notifications", ["user_id"]],
    ["user_push_devices", ["user_id"]],
    ["worker_withdrawals", ["user_id"]],
    ["service_reviews", ["reviewer_user_id", "target_user_id"]],
    ["community_post_chat_messages", ["sender_user_id"]],
    ["community_post_chats", ["post_author_user_id", "contact_user_id"]],
    ["community_posts", ["author_user_id"]],
    ["service_chat_messages", ["sender_user_id"]],
    ["service_chats", ["requester_user_id", "worker_user_id"]],
    ["service_request_worker_blocks", ["worker_user_id", "requester_user_id"]],
    ["service_request_events", ["actor_user_id"]],
    ["service_requests", ["requester_user_id", "worker_user_id"]],
    ["support_ticket_messages", ["sender_user_id"]],
    ["support_tickets", ["requester_user_id"]],
    ["client_error_reports", ["user_id"]],
  ];

  for (const [table, columns] of tables) {
    const changes = deleteIfExists(
      table,
      columns.map((column) => ({ column })),
      targetIds
    );
    if (changes) deleted[table] = changes;
  }

  const marks = targetIds.map(() => "?").join(", ");
  deleted.users = db.prepare(`DELETE FROM users WHERE id IN (${marks})`).run(...targetIds).changes;

  db.exec("COMMIT");

  const remaining = db
    .prepare("SELECT email, full_name, created_at FROM users ORDER BY lower(email)")
    .all();
  console.log("Remocoes:");
  console.table(deleted);
  console.log("Usuarios restantes:");
  console.table(remaining);
} catch (error) {
  db.exec("ROLLBACK");
  throw error;
} finally {
  db.close();
}
