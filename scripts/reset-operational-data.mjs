import { DatabaseSync } from "node:sqlite";

const dbPath = process.argv[2] || "server/data/auth.db";
const db = new DatabaseSync(dbPath);

const tablesToClear = [
  "service_chat_messages",
  "service_chats",
  "service_reviews",
  "user_notifications",
  "service_request_events",
  "asaas_webhook_events",
  "worker_withdrawals",
  "service_requests",
];

const tablesToReport = [
  "service_requests",
  "service_chats",
  "service_chat_messages",
  "service_reviews",
  "user_notifications",
  "service_request_events",
  "asaas_webhook_events",
  "worker_withdrawals",
  "users",
  "sessions",
];

db.exec("PRAGMA foreign_keys = OFF;");
db.exec("BEGIN TRANSACTION;");

for (const table of tablesToClear) {
  db.exec(`DELETE FROM ${table};`);
}

db.exec("COMMIT;");
db.exec("PRAGMA foreign_keys = ON;");

for (const table of tablesToReport) {
  const row = db.prepare(`SELECT COUNT(*) AS total FROM ${table}`).get();
  console.log(`${table}: ${row.total}`);
}
