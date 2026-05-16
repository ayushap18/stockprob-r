const memoryCache = new Map();

export async function safeProviderCall({ name, task, fallback, retries = 1 }) {
  let lastError;
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      const value = await task();
      return { status: isEmpty(value) ? 'degraded' : 'ok', value, warning: null };
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

export async function cachedFetchJson(url, { ttlMs = 300_000, timeoutMs = 10_000, retries = 1 } = {}) {
  const cached = memoryCache.get(url);
  if (cached && Date.now() - cached.storedAt < ttlMs) return cached.value;

  let lastError;
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(url, { signal: controller.signal, headers: { 'User-Agent': 'StockProb-R/1.0' } });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const value = await response.json();
      memoryCache.set(url, { value, storedAt: Date.now() });
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

export async function cachedFetchText(url, { ttlMs = 3_600_000, timeoutMs = 10_000, retries = 1 } = {}) {
  const cached = memoryCache.get(url);
  if (cached && Date.now() - cached.storedAt < ttlMs) return cached.value;

  let lastError;
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(url, { signal: controller.signal, headers: { 'User-Agent': 'StockProb-R/1.0' } });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const value = await response.text();
      memoryCache.set(url, { value, storedAt: Date.now() });
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
  if (values.includes('degraded') || values.includes('disconnected')) return 'degraded';
  return 'ok';
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isEmpty(value) {
  if (Array.isArray(value)) return value.length === 0;
  if (value && typeof value === 'object') return Object.keys(value).length === 0;
  return value === null || value === undefined;
}
