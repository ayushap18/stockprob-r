import { generateDemoBacktest } from './demoChartData.js';
import { normalizeBacktestData } from './normalizeBacktestData.js';

export async function fetchBacktestReport(symbol = 'MSFT', options = {}) {
  const params = new URLSearchParams({
    universe: [symbol, 'SPY', 'QQQ'].join(','),
    horizon: String(options.horizon || 5),
  });
  try {
    const payload = await json(`/api/backtest?${params}`);
    return envelope(normalizeBacktestData(payload), { source: '/api/backtest', isDemo: false, warnings: payload?.warnings || [] });
  } catch (error) {
    return envelope(normalizeBacktestData(generateDemoBacktest()), { source: 'deterministic-demo', isDemo: true, warnings: [error.message || 'Backtest API unavailable; demo validation shown'] });
  }
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
