import { generateDemoSuggestions } from './demoSuggestionsData.js';

export async function fetchSimilarStocks(symbol = 'MSFT', controls = {}, base = {}) {
  try {
    const payload = await json(`/api/suggestions/similar/${encodeURIComponent(symbol)}?benchmark=${encodeURIComponent(controls.benchmark || 'SPY')}`);
    const rows = Array.isArray(payload?.data) ? payload.data : Array.isArray(payload?.suggestions) ? payload.suggestions : [];
    if (rows.length) return envelope(rows, { source: '/api/suggestions/similar', isDemo: false });
  } catch {
    // Safe deterministic fallback.
  }
  return envelope(generateDemoSuggestions(symbol, base), { source: 'deterministic-demo', isDemo: true, warnings: ['Suggestions API unavailable; deterministic peer suggestions shown'] });
}

export async function fetchPeerGroup(symbol = 'MSFT') {
  return fetchSimilarStocks(symbol);
}

export async function fetchAlternativeSuggestions(symbol = 'MSFT', controls = {}, base = {}) {
  return fetchSimilarStocks(symbol, controls, base);
}

function envelope(data, meta) {
  return { ok: true, data, meta: { stale: false, asOf: new Date().toISOString(), latencyMs: 0, warnings: [], ...meta } };
}

async function json(url) {
  const response = await fetch(url);
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || payload?.error) throw new Error(payload?.error?.message || `HTTP ${response.status}`);
  return payload;
}
