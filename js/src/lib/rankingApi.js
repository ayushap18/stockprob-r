import { generateDemoRankings } from './demoChartData.js';
import { normalizeRankingData } from './normalizeRankingData.js';

export async function fetchRankings({ query = '', base = 'MSFT' } = {}) {
  const params = new URLSearchParams({ tickers: 'MSFT,AAPL,NVDA,AMZN,GOOGL,META,JPM,LLY,XOM,AVGO,COST,UNH,BRK.B,V,MA,ORCL,AMD,CRM', horizon: '5' });
  if (query) params.set('q', query);
  const candidates = [`/api/rankings?${params}`, `/api/rank?${params}`];
  for (const url of candidates) {
    try {
      const payload = await json(url);
      const rows = normalizeRankingData(payload);
      if (rows.length) return envelope(rows, { source: url, isDemo: false, warnings: payload?.warnings || payload?.meta?.warnings || [] });
    } catch {
      // Try the next compatible endpoint.
    }
  }
  const rows = normalizeRankingData(generateDemoRankings()).map((row, index) => ({
    ...row,
    similarityScore: Math.max(0.2, 0.9 - index * 0.045),
    similarityReason: similarityReason(row, base, index),
  }));
  return envelope(rows, { source: 'deterministic-demo', isDemo: true, warnings: ['Rankings API unavailable; deterministic demo ranking shown'] });
}

export async function fetchSimilarStocks(symbol = 'MSFT') {
  const ranking = await fetchRankings({ base: symbol });
  const rows = ranking.data.filter((row) => row.symbol !== symbol).slice(0, 4).map((row, index) => ({
    ...row,
    similarityReason: row.similarityReason || similarityReason(row, symbol, index),
  }));
  return { ...ranking, data: rows };
}

function similarityReason(row, base, index) {
  const reasons = [
    'Same sector, stronger momentum',
    'Lower risk, similar expected return',
    `Higher confidence than ${base}`,
    'Similar volatility profile',
  ];
  return row.sector === 'Technology' ? reasons[index % reasons.length] : reasons[(index + 1) % reasons.length];
}

function envelope(data, meta) {
  return { ok: true, data, meta: { stale: false, asOf: new Date().toISOString(), latencyMs: 0, ...meta } };
}

async function json(url) {
  const response = await fetch(url);
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || payload?.error) throw new Error(payload?.error?.message || payload?.message || `HTTP ${response.status}`);
  return payload;
}
