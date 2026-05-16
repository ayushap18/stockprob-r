import { providerFail, providerOk } from './demoProvider.js';

const YAHOO_WARNING = 'Yahoo/yfinance fallback is unofficial and intended for development/prototyping only.';

export async function fetchYahooOhlcv(symbol, { interval = '1d', from, to, limit = 520 } = {}) {
  const started = Date.now();
  try {
    const encoded = symbol === '^VIX' ? '%5EVIX' : encodeURIComponent(symbol);
    const end = to ? unix(to, 1) : Math.floor((Date.now() + 86_400_000) / 1000);
    const start = from ? unix(from, 0) : end - 86_400 * Math.max(limit * 2, 400);
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encoded}?period1=${start}&period2=${end}&interval=${encodeURIComponent(interval)}&events=history&includeAdjustedClose=true`;
    const data = await fetchJson(url, 9000);
    const result = data?.chart?.result?.[0];
    const quote = result?.indicators?.quote?.[0] || {};
    const adjusted = result?.indicators?.adjclose?.[0]?.adjclose || [];
    const rows = (result?.timestamp || []).map((timestamp, index) => ({
      date: new Date(timestamp * 1000).toISOString().slice(0, 10),
      time: new Date(timestamp * 1000).toISOString().slice(0, 10),
      open: number(quote.open?.[index], quote.close?.[index]),
      high: number(quote.high?.[index], quote.close?.[index]),
      low: number(quote.low?.[index], quote.close?.[index]),
      close: number(adjusted[index], quote.close?.[index]),
      volume: number(quote.volume?.[index], 0),
    })).filter((row) => Number.isFinite(row.close));
    if (!rows.length) throw new Error('Yahoo chart returned no rows');
    return providerOk(rows.slice(-limit), 'yfinance', Date.now() - started, [YAHOO_WARNING]);
  } catch (error) {
    return providerFail(error, 'yfinance', Date.now() - started, [YAHOO_WARNING]);
  }
}

export async function fetchYahooQuote(symbol) {
  const started = Date.now();
  try {
    const rows = await fetchYahooOhlcv(symbol, { interval: '1d', limit: 8 });
    if (!rows.ok) throw new Error(rows.error);
    const last = rows.data.at(-1);
    const previous = rows.data.at(-2) || last;
    const change = last.close - previous.close;
    return providerOk({
      symbol,
      price: last.close,
      change,
      changePercent: previous.close ? (change / previous.close) * 100 : 0,
      volume: last.volume,
      bid: Number((last.close - 0.01).toFixed(2)),
      ask: Number((last.close + 0.01).toFixed(2)),
      marketState: marketState(),
    }, 'yfinance', Date.now() - started, [YAHOO_WARNING]);
  } catch (error) {
    return providerFail(error, 'yfinance', Date.now() - started, [YAHOO_WARNING]);
  }
}

export async function fetchYahooOptions(symbol) {
  return providerFail(new Error(`Options fallback for ${symbol} is not enabled in this build.`), 'yfinance', 0, [YAHOO_WARNING]);
}

function unix(date, addDays) {
  return Math.floor((new Date(`${date}T00:00:00Z`).getTime() + addDays * 86_400_000) / 1000);
}

async function fetchJson(url, timeoutMs) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { signal: controller.signal, headers: { 'User-Agent': 'StockProb-R/1.0' } });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.json();
  } finally {
    clearTimeout(timeout);
  }
}

function number(value, fallback = null) {
  return Number.isFinite(Number(value)) ? Number(value) : fallback;
}

function marketState() {
  const now = new Date();
  const day = now.getUTCDay();
  const minutes = now.getUTCHours() * 60 + now.getUTCMinutes();
  if (day === 0 || day === 6) return 'closed';
  if (minutes >= 13 * 60 + 30 && minutes <= 20 * 60) return 'open';
  if (minutes < 13 * 60 + 30) return 'pre';
  return 'post';
}
