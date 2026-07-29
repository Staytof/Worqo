import { db } from "../server/db.mjs";
import {
  getPushNotificationStatusForUser,
  sendPushTestForUser,
} from "../server/push-notifications.mjs";

const email = String(process.env.PUSH_TEST_EMAIL ?? "").trim().toLowerCase();

if (!email) {
  throw new Error("Informe PUSH_TEST_EMAIL com o e-mail da conta que receberá o teste.");
}

const user = db
  .prepare(
    `
      SELECT id, email, full_name
      FROM users
      WHERE lower(email) = ? AND deleted_at IS NULL
      LIMIT 1
    `
  )
  .get(email);

if (!user) {
  throw new Error(`Nenhuma conta ativa encontrada para ${email}.`);
}

console.log("Conta:", user.email, "-", user.full_name);
console.log("Status antes do teste:");
console.dir(getPushNotificationStatusForUser(user.id), { depth: 6 });

const result = await sendPushTestForUser(user.id);

console.log("Resultado do envio:");
console.dir(result, { depth: 6 });
console.log("Status depois do teste:");
console.dir(getPushNotificationStatusForUser(user.id), { depth: 6 });

if (!result.ok) {
  process.exitCode = 1;
}
