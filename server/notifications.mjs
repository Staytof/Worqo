import { db } from "./db.mjs";
import { createId, nowIso } from "./security.mjs";
import {
  buildStoredNotificationPayload,
  queuePushNotificationForUser,
} from "./push-notifications.mjs";

const insertUserNotificationStatement = db.prepare(
  `
    INSERT OR IGNORE INTO user_notifications (
      id,
      user_id,
      kind,
      message,
      meta_json,
      created_at,
      consumed_at
    ) VALUES (?, ?, ?, ?, ?, ?, NULL)
  `
);

const countPendingNotificationsByUserStatement = db.prepare(
  `
    SELECT COUNT(*) AS total
    FROM user_notifications
    WHERE user_id = ? AND consumed_at IS NULL
  `
);

const selectRecentUnreadReminderStatement = db.prepare(
  `
    SELECT id
    FROM user_notifications
    WHERE user_id = ?
      AND kind = 'notifications-reminder'
      AND consumed_at IS NULL
      AND created_at >= ?
    ORDER BY created_at DESC
    LIMIT 1
  `
);

const selectPendingNotificationsByUserStatement = db.prepare(
  `
    SELECT *
    FROM user_notifications
    WHERE user_id = ? AND consumed_at IS NULL
    ORDER BY created_at ASC
    LIMIT 10
  `
);

const consumeNotificationStatement = db.prepare(
  `
    UPDATE user_notifications
    SET consumed_at = ?
    WHERE id = ? AND consumed_at IS NULL
  `
);

function mapNotification(row) {
  let meta = {};

  try {
    const parsed = JSON.parse(row.meta_json ?? "{}");
    meta = parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    meta = {};
  }

  return {
    ...buildStoredNotificationPayload(row.id, row.kind, row.message, meta, row.created_at),
    ...(meta ?? {}),
  };
}

function maybeCreateUnreadReminder(userId) {
  const pendingCount = Number(countPendingNotificationsByUserStatement.get(userId)?.total ?? 0);

  if (pendingCount < 15) {
    return;
  }

  const recentCutoff = new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString();
  const recentReminder = selectRecentUnreadReminderStatement.get(userId, recentCutoff);

  if (recentReminder) {
    return;
  }

  createUserNotification(
    userId,
    "notifications-reminder",
    pendingCount === 15
      ? "Você já tem 15 notificações pendentes no Worko."
      : `Você tem ${pendingCount} notificações pendentes no Worko.`,
    {
      title: "Notificações pendentes",
      unreadCount: pendingCount,
    },
    {
      skipUnreadReminder: true,
    }
  );
}

export function createUserNotification(userId, kind, message, meta = {}, options = {}) {
  const timestamp = nowIso();
  const normalizedMeta =
    meta && typeof meta === "object" && !Array.isArray(meta) ? meta : {};
  const notificationId =
    typeof options.id === "string" && options.id.trim() ? options.id.trim() : createId();

  const result = insertUserNotificationStatement.run(
    notificationId,
    userId,
    kind,
    message,
    JSON.stringify(normalizedMeta),
    timestamp
  );

  if (result.changes === 0) {
    return {
      created: false,
      id: notificationId,
    };
  }

  queuePushNotificationForUser(
    userId,
    buildStoredNotificationPayload(notificationId, kind, message, normalizedMeta, timestamp)
  );

  if (!options.skipUnreadReminder && kind !== "notifications-reminder") {
    maybeCreateUnreadReminder(userId);
  }

  return {
    created: true,
    id: notificationId,
  };
}

export function consumePendingNotificationsForUser(userId) {
  const notifications = selectPendingNotificationsByUserStatement.all(userId);

  if (notifications.length === 0) {
    return [];
  }

  const consumedAt = nowIso();

  for (const notification of notifications) {
    consumeNotificationStatement.run(consumedAt, notification.id);
  }

  return notifications.map(mapNotification);
}

