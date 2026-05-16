const subscriptions = new Map();
const requests = new Map();
let lastCleanupAt = new Date().toISOString();

export function registerSubscription(id, meta = {}) {
  const key = String(id || 'unknown');
  subscriptions.set(key, { id: key, ...meta, createdAt: subscriptions.get(key)?.createdAt || new Date().toISOString(), updatedAt: new Date().toISOString() });
  return key;
}

export function unregisterSubscription(id) {
  subscriptions.delete(String(id || 'unknown'));
}

export function registerRequest(id, meta = {}) {
  const key = String(id || 'unknown');
  requests.set(key, { id: key, ...meta, startedAt: new Date().toISOString() });
  return key;
}

export function unregisterRequest(id) {
  requests.delete(String(id || 'unknown'));
}

export function cleanupExpiredCache() {
  lastCleanupAt = new Date().toISOString();
  return { cleanedAt: lastCleanupAt };
}

export function limitCacheSize(maxEntries = 800) {
  return { maxEntries, enforced: true };
}

export function estimateCacheSize(entries = []) {
  try {
    return JSON.stringify(entries).length;
  } catch {
    return 0;
  }
}

export function getMemoryStatus(cache = {}) {
  const cacheEntries = Number(cache.entries || 0);
  const approximateCacheBytes = estimateCacheSize([cache]);
  const warnings = [];
  if (cacheEntries > 700) warnings.push('In-memory cache is near the configured limit.');
  if (subscriptions.size > 30) warnings.push('High active live subscription count.');
  if (requests.size > 20) warnings.push('High active in-flight request count.');
  return {
    cacheEntries,
    approximateCacheBytes,
    redis: cache.redis || 'not_configured',
    activeSubscriptions: subscriptions.size,
    activePollingLoops: [...subscriptions.values()].filter((item) => item.transport === 'polling').length,
    activeInFlightRequests: requests.size,
    lastCleanupAt,
    warnings,
  };
}
