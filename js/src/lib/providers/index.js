import { createCache, TTL } from '../cache.js';
import { demoOhlcv, demoQuote } from './demoProvider.js';
import { fetchPolygonOhlcv, fetchPolygonQuote } from './polygonProvider.js';
import { fetchYfinanceOhlcv, fetchYfinanceQuote } from './yfinanceProvider.js';

const cache = createCache({ namespace: 'providers' });

export async function getQuote(symbol) {
  return cache.staleWhileRevalidate(`quote:${symbol}`, TTL.quotes, 5 * 60_000, async () => {
    const polygon = await fetchPolygonQuote(symbol);
    if (polygon.ok) return polygon;
    if (process.env.USE_YFINANCE !== 'false') {
      const yahoo = await fetchYfinanceQuote(symbol);
      if (yahoo.ok) return yahoo;
    }
    if (process.env.ENABLE_DEMO_FALLBACK !== 'false') return demoQuote(symbol);
    return polygon;
  }).then((entry) => ({ ...entry.value, cache: { source: entry.source, stale: entry.stale, warnings: entry.warnings } }));
}

export async function getOhlcv(symbol, options = {}) {
  return cache.staleWhileRevalidate(`ohlcv:${symbol}:${options.interval || '1d'}:${options.from || ''}:${options.to || ''}:${options.limit || 520}`, TTL.ohlcvDaily, 24 * 60 * 60_000, async () => {
    const polygon = await fetchPolygonOhlcv(symbol, options);
    if (polygon.ok) return polygon;
    if (process.env.USE_YFINANCE !== 'false') {
      const yahoo = await fetchYfinanceOhlcv(symbol, options);
      if (yahoo.ok) return yahoo;
    }
    if (process.env.ENABLE_DEMO_FALLBACK !== 'false') return demoOhlcv(symbol, options.limit);
    return polygon;
  }).then((entry) => ({ ...entry.value, cache: { source: entry.source, stale: entry.stale, warnings: entry.warnings } }));
}

export function providerReadiness() {
  const providers = [
    ['polygon', 'POLYGON_API_KEY'],
    ['fmp', 'FMP_API_KEY'],
    ['alpha_vantage', 'ALPHA_VANTAGE_API_KEY'],
    ['fred', 'FRED_API_KEY'],
    ['sec', 'SEC_USER_AGENT'],
    ['tradier', 'TRADIER_API_KEY'],
    ['redis', 'REDIS_URL'],
    ['postgres', 'DATABASE_URL'],
  ];
  return providers.map(([provider, env]) => ({
    provider,
    status: process.env[env] ? 'ok' : 'not_configured',
    lastSuccessAt: null,
    lastErrorAt: null,
    averageLatencyMs: process.env[env] ? 1 : null,
    errorRate: 0,
    fallbackCount24h: process.env[env] ? 0 : 1,
    configured: Boolean(process.env[env]),
  }));
}
