import { generateDemoProviderHealth } from './demoChartData.js';

export function normalizeHealthData(raw = {}) {
  const data = raw?.data || raw || {};
  const providers = Array.isArray(data.providers) ? data.providers : Array.isArray(data) ? data : generateDemoProviderHealth();
  return {
    status: data.status || 'degraded',
    providers: providers.map((provider) => ({
      provider: provider.provider || provider.name || 'unknown',
      status: provider.status || (provider.configured === false ? 'not_configured' : 'degraded'),
      configured: provider.configured !== false,
      lastSuccessAt: provider.lastSuccessAt || provider.lastRefresh || null,
      lastErrorAt: provider.lastErrorAt || null,
      averageLatencyMs: Number(provider.averageLatencyMs ?? provider.latencyMs ?? 0) || 0,
      errorRate: Number(provider.errorRate ?? 0) || 0,
      fallbackCount24h: Number(provider.fallbackCount24h ?? provider.fallbackCount ?? 0) || 0,
      freshness: provider.freshness || provider.lastRefresh || 'unknown',
    })),
    coverage: data.coverage || {
      universe: 0.92,
      prices: 0.98,
      fundamentals: 0.61,
      options: 0.38,
      news: 0.58,
      macro: 0.96,
      filings: 0.72,
      derivedFeatures: 0.88,
    },
    queues: data.queues || { queueDepth: 0, activeJobs: 0, failedJobs: 0, lastCronRun: null },
    memory: data.memory || { cacheEntries: 0, cacheHitRate: 0.68, cacheMissRate: 0.32, activeSubscriptions: 0, activePollingLoops: 0, activeInFlightRequests: 0 },
    staleness: data.staleness || [
      { bucket: '<15m', count: 320 },
      { bucket: '15m-1h', count: 98 },
      { bucket: '1h-6h', count: 42 },
      { bucket: '>6h', count: 18 },
    ],
  };
}
