import { providerFail, providerOk } from './demoProvider.js';

export async function fetchPolygonOhlcv(symbol, { from = '2010-01-01', to = new Date().toISOString().slice(0, 10), limit = 520 } = {}) {
  const started = Date.now();
  if (!process.env.POLYGON_API_KEY) return providerFail(new Error('POLYGON_API_KEY not configured'), 'polygon', 0);
  try {
    const url = `https://api.polygon.io/v2/aggs/ticker/${encodeURIComponent(symbol)}/range/1/day/${from}/${to}?adjusted=true&sort=asc&limit=50000&apiKey=${process.env.POLYGON_API_KEY}`;
    const data = await fetchJson(url, 10_000);
    const rows = (data?.results || []).map((row) => ({
      date: new Date(row.t).toISOString().slice(0, 10),
      time: new Date(row.t).toISOString().slice(0, 10),
      open: row.o,
      high: row.h,
      low: row.l,
      close: row.c,
      volume: row.v,
    }));
    if (!rows.length) throw new Error('Polygon returned no rows');
    return providerOk(rows.slice(-limit), 'polygon', Date.now() - started);
  } catch (error) {
    return providerFail(error, 'polygon', Date.now() - started);
  }
}

export async function fetchPolygonQuote(symbol) {
  const started = Date.now();
  const bars = await fetchPolygonOhlcv(symbol, { limit: 8 });
  if (!bars.ok) return providerFail(new Error(bars.error), 'polygon', Date.now() - started);
  const last = bars.data.at(-1);
  const previous = bars.data.at(-2) || last;
  const change = last.close - previous.close;
  return providerOk({
    symbol,
    price: last.close,
    change,
    changePercent: previous.close ? (change / previous.close) * 100 : 0,
    volume: last.volume,
    bid: null,
    ask: null,
    marketState: 'unknown',
    asOf: new Date().toISOString(),
  }, 'polygon', Date.now() - started);
}

async function fetchJson(url, timeoutMs) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.json();
  } finally {
    clearTimeout(timeout);
  }
}
