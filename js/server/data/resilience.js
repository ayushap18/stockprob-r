const memoryCache = new Map();
const inFlight = new Map();
const DEFAULT_MAX_CACHE_ENTRIES = 500;

export async function safeProviderCall({ name, task, fallback, retries = 1 }) {
  let lastError;
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      const value = await task();
      const empty = isEmpty(value);
      return { status: empty ? 'degraded' : 'ok', value, warning: empty ? `${name} returned no data` : null };
    } catch (error) {
      lastError = error;
    }
  }
  return {
    status: 'failed',
    value: fallback,
    warning: `${name} failed: ${lastError?.message || 'unknown provider error'}`,
  };
}

export async function cachedFetchJson(url, { ttlMs = 300_000, timeoutMs = 10_000, retries = 1, maxEntries = DEFAULT_MAX_CACHE_ENTRIES } = {}) {
  const cached = readCache(url, ttlMs);
  if (cached) return cached.value;
  if (inFlight.has(url)) return inFlight.get(url);

  const request = (async () => {
    let lastError;
    for (let attempt = 0; attempt <= retries; attempt += 1) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), timeoutMs);
      try {
        const response = await fetch(url, { signal: controller.signal, headers: { 'User-Agent': 'StockProb-R/1.0' } });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const value = await response.json();
        writeCache(url, value, maxEntries);
        return value;
      } catch (error) {
        lastError = error;
        if (attempt < retries) await delay(150 * (attempt + 1));
      } finally {
        clearTimeout(timeout);
      }
    }
    throw lastError;
  })();
  inFlight.set(url, request);
  try {
    return await request;
  } finally {
    inFlight.delete(url);
  }
}

export async function cachedFetchText(url, { ttlMs = 3_600_000, timeoutMs = 10_000, retries = 1, maxEntries = DEFAULT_MAX_CACHE_ENTRIES } = {}) {
  const cached = readCache(url, ttlMs);
  if (cached) return cached.value;

  let lastError;
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(url, { signal: controller.signal, headers: { 'User-Agent': 'StockProb-R/1.0' } });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const value = await response.text();
      writeCache(url, value, maxEntries);
      return value;
    } catch (error) {
      lastError = error;
      if (attempt < retries) await delay(150 * (attempt + 1));
    } finally {
      clearTimeout(timeout);
    }
  }
  throw lastError;
}

export function providerSummary(statuses = {}) {
  const values = Object.values(statuses);
  if (values.includes('failed')) return 'degraded';
  if (values.includes('degraded') || values.includes('disconnected') || values.includes('fallback')) return 'degraded';
  return 'ok';
}

export function cacheStats() {
  return {
    entries: memoryCache.size,
    oldest_stored_at: Math.min(...[...memoryCache.values()].map((entry) => entry.storedAt), Date.now()),
    newest_stored_at: Math.max(...[...memoryCache.values()].map((entry) => entry.storedAt), 0),
  };
}

export function clearCache() {
  memoryCache.clear();
}

function readCache(url, ttlMs) {
  const cached = memoryCache.get(url);
  if (!cached) return null;
  if (Date.now() - cached.storedAt >= ttlMs) {
    memoryCache.delete(url);
    return null;
  }
  memoryCache.delete(url);
  memoryCache.set(url, cached);
  return cached;
}

function writeCache(url, value, maxEntries) {
  const limit = Math.max(1, Number(maxEntries) || DEFAULT_MAX_CACHE_ENTRIES);
  memoryCache.set(url, { value, storedAt: Date.now() });
  while (memoryCache.size > limit) {
    const oldestKey = memoryCache.keys().next().value;
    memoryCache.delete(oldestKey);
  }
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isEmpty(value) {
  if (Array.isArray(value)) return value.length === 0;
  if (value && typeof value === 'object') return Object.keys(value).length === 0;
  return value === null || value === undefined;
}
