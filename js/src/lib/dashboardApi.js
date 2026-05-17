import { dedupeRequest } from './requestDeduper.js';
import { generateDemoDashboardData } from './demoDashboardData.js';
import { normalizeDashboardData } from './normalizeDashboardData.js';

export async function fetchDashboardSnapshot(symbol = 'MSFT', options = {}) {
  const ticker = normalizeTicker(symbol);
  const query = dashboardQuery(options);
  return dedupeRequest(`dashboard:${ticker}:${query}`, async (signal) => {
    const payload = await json(`/api/dashboard/${encodeURIComponent(ticker)}/snapshot${query ? `?${query}` : ''}`, { signal });
    return envelope(payload, ticker);
  }).catch((error) => fallback(ticker, error.message));
}

export async function fetchDashboardCharts(symbol = 'MSFT') {
  const ticker = normalizeTicker(symbol);
  return json(`/api/dashboard/${encodeURIComponent(ticker)}/charts`).then((payload) => envelope(payload, ticker)).catch((error) => fallback(ticker, error.message));
}

export async function fetchDashboardSystemState() {
  return json('/api/dashboard/system').catch(() => ({ ok: false, data: {}, meta: { source: 'demo', isDemo: true, warnings: ['Dashboard system endpoint unavailable'] } }));
}

export async function refreshDashboardSymbol(symbol = 'MSFT', options = {}) {
  const ticker = normalizeTicker(symbol);
  const query = dashboardQuery({ ...options, refresh: true });
  return json(`/api/dashboard/${encodeURIComponent(ticker)}/refresh${query ? `?${query}` : ''}`, { method: 'POST' }).then((payload) => envelope(payload, ticker)).catch((error) => fallback(ticker, error.message));
}

function envelope(payload, ticker) {
  if (!payload?.ok) throw new Error(payload?.error?.message || 'Dashboard unavailable');
  return { ok: true, data: normalizeDashboardData(payload.data, ticker), meta: payload.meta || {} };
}

function fallback(ticker, warning) {
  return {
    ok: true,
    data: normalizeDashboardData(generateDemoDashboardData(ticker), ticker),
    meta: { source: 'demo', isDemo: true, stale: false, asOf: new Date().toISOString(), latencyMs: 0, warnings: [warning || 'Using deterministic dashboard fallback data'] },
  };
}

async function json(url, options = {}) {
  const response = await fetch(url, options);
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || payload.ok === false) throw new Error(payload.error?.message || payload.message || `HTTP ${response.status}`);
  return payload;
}

function normalizeTicker(symbol) {
  return String(symbol || 'MSFT').trim().toUpperCase().replace(/[^A-Z0-9.-]/g, '').slice(0, 12) || 'MSFT';
}

function dashboardQuery(options = {}) {
  const params = new URLSearchParams();
  if (options.horizonDays) params.set('horizonDays', String(options.horizonDays));
  if (options.benchmark) params.set('benchmark', String(options.benchmark));
  if (options.refresh || options.force) params.set('refresh', '1');
  return params.toString();
}
