import { normalizeHealthData } from './normalizeHealthData.js';

export async function fetchDataHealth() {
  const [system, providers, queues, memory, coverage] = await Promise.all([
    safeJson('/api/system/health'),
    safeJson('/api/system/providers'),
    safeJson('/api/system/queues'),
    safeJson('/api/system/memory'),
    safeJson('/api/universe/coverage'),
  ]);
  const merged = {
    ...(system.data || system || {}),
    providers: providers.data || providers.providers,
    queues: queues.data || queues,
    memory: memory.data || memory,
    coverage: coverage.data || coverage.coverage,
  };
  const demo = [system, providers, queues, memory, coverage].some((item) => item.__failed);
  return {
    ok: true,
    data: normalizeHealthData(merged),
    meta: {
      source: demo ? 'deterministic-demo' : 'system-api',
      isDemo: demo,
      stale: false,
      asOf: new Date().toISOString(),
      latencyMs: 0,
      warnings: demo ? ['One or more health endpoints are unavailable; safe demo status merged in'] : [],
    },
  };
}

async function safeJson(url) {
  try {
    const response = await fetch(url);
    const payload = await response.json().catch(() => ({}));
    if (!response.ok || payload?.error) throw new Error(payload?.error?.message || `HTTP ${response.status}`);
    return payload;
  } catch (error) {
    return { __failed: true, error: error.message };
  }
}
