const memory = new Map();
const inFlight = new Map();

export const TTL = {
  quotes: 15_000,
  quotesAfterHours: 60_000,
  ohlcvDaily: 3 * 60 * 60_000,
  ohlcvIntraday: 60_000,
  fundamentals: 18 * 60 * 60_000,
  earnings: 12 * 60 * 60_000,
  news: 30 * 60_000,
  fredMacro: 18 * 60 * 60_000,
  filings: 3 * 60 * 60_000,
  probabilities: 60_000,
  providerHealth: 60_000,
};

export function createCache({ namespace = 'stockprob' } = {}) {
  return {
    async get(key) {
      return getCache(`${namespace}:${key}`);
    },
    async set(key, value, ttlMs = 60_000, meta = {}) {
      return setCache(`${namespace}:${key}`, value, ttlMs, meta);
    },
    async getOrSet(key, ttlMs, producer, options = {}) {
      return getOrSet(`${namespace}:${key}`, ttlMs, producer, options);
    },
    async staleWhileRevalidate(key, ttlMs, staleMs, producer) {
      return staleWhileRevalidate(`${namespace}:${key}`, ttlMs, staleMs, producer);
    },
    status() {
      return {
        kind: process.env.REDIS_URL ? 'redis-configured-memory-adapter' : 'memory',
        redis: process.env.REDIS_URL ? 'configured' : 'not_configured',
        entries: memory.size,
      };
    },
  };
}

export async function getCache(key) {
  const entry = memory.get(key);
  if (!entry) return null;
  const ageMs = Date.now() - entry.storedAt;
  return { ...entry, ageMs, fresh: ageMs <= entry.ttlMs, stale: ageMs > entry.ttlMs };
}

export async function setCache(key, value, ttlMs = 60_000, meta = {}) {
  const entry = { value: stripSecrets(value), ttlMs, storedAt: Date.now(), meta };
  memory.set(key, entry);
  trimMemory();
  return entry;
}

export async function getOrSet(key, ttlMs, producer, { timeoutMs = 12_000 } = {}) {
  const cached = await getCache(key);
  if (cached?.fresh) return { value: cached.value, source: 'cache', stale: false, warnings: cached.meta?.warnings || [] };
  const value = await coalesce(key, () => withTimeout(producer(), timeoutMs));
  await setCache(key, value, ttlMs);
  return { value, source: 'provider', stale: false, warnings: [] };
}

export async function staleWhileRevalidate(key, ttlMs, staleMs, producer) {
  const cached = await getCache(key);
  if (cached?.fresh) return { value: cached.value, source: 'cache', stale: false, warnings: cached.meta?.warnings || [] };
  if (cached && cached.ageMs <= staleMs) {
    coalesce(`refresh:${key}`, async () => {
      const value = await producer();
      await setCache(key, value, ttlMs);
      return value;
    }).catch(() => null);
    return { value: cached.value, source: 'cache', stale: true, warnings: ['Returned stale cache while refreshing in background'] };
  }
  const value = await coalesce(key, producer);
  await setCache(key, value, ttlMs);
  return { value, source: 'provider', stale: false, warnings: [] };
}

export function cacheStats() {
  return { entries: memory.size, redis: process.env.REDIS_URL ? 'configured' : 'not_configured' };
}

async function coalesce(key, task) {
  if (inFlight.has(key)) return inFlight.get(key);
  const promise = Promise.resolve().then(task);
  inFlight.set(key, promise);
  try {
    return await promise;
  } finally {
    inFlight.delete(key);
  }
}

function withTimeout(promise, timeoutMs) {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error('Provider timeout')), timeoutMs)),
  ]);
}

function stripSecrets(value) {
  return JSON.parse(JSON.stringify(value, (key, nested) => (/key|token|secret|password/i.test(key) ? undefined : nested)));
}

function trimMemory(max = 800) {
  while (memory.size > max) memory.delete(memory.keys().next().value);
}
