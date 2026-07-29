import { HttpError } from "./utils.mjs";

const buckets = new Map();

function nowMs() {
  return Date.now();
}

function toBucketKey(scope, key) {
  return `${scope}:${String(key ?? "").trim() || "unknown"}`;
}

function pruneExpiredBuckets(timestamp) {
  for (const [bucketKey, bucket] of buckets.entries()) {
    if (bucket.resetAt <= timestamp) {
      buckets.delete(bucketKey);
    }
  }
}

export function assertRateLimit(scope, key, { max, windowMs, message }) {
  const timestamp = nowMs();
  pruneExpiredBuckets(timestamp);

  const bucketKey = toBucketKey(scope, key);
  const currentBucket = buckets.get(bucketKey);

  if (!currentBucket || currentBucket.resetAt <= timestamp) {
    buckets.set(bucketKey, {
      count: 1,
      resetAt: timestamp + windowMs,
    });
    return;
  }

  if (currentBucket.count >= max) {
    throw new HttpError(429, message ?? "Muitas requisições em pouco tempo. Tente novamente.");
  }

  currentBucket.count += 1;
}


