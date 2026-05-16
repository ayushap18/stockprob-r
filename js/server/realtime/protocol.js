import crypto from 'node:crypto';

const SUPPORTED_HORIZONS = new Set([5, 10, 20]);

export function validateRealtimeRequest(input = {}) {
  const ticker = String(input.ticker || '').trim().toUpperCase();
  const horizon = Number(input.horizon || 5);
  if (!/^[A-Z][A-Z0-9.-]{0,14}$/.test(ticker)) throw new Error('ticker must be a valid listed US symbol');
  if (!SUPPORTED_HORIZONS.has(horizon)) throw new Error('horizon must be 5, 10, or 20 trading days');
  return { ticker, horizon };
}

export function validateRankRequest(input = {}) {
  const horizon = Number(input.horizon || 5);
  if (!SUPPORTED_HORIZONS.has(horizon)) throw new Error('horizon must be 5, 10, or 20 trading days');
  const tickers = Array.isArray(input.tickers)
    ? input.tickers.map((ticker) => String(ticker || '').trim().toUpperCase()).filter((ticker) => /^[A-Z][A-Z0-9.-]{0,14}$/.test(ticker))
    : [];
  if (!tickers.length) throw new Error('tickers must include at least one valid listed US symbol');
  return { horizon, tickers: [...new Set(tickers)].slice(0, 100), limit: clamp(input.limit, 1, 100, 25) };
}

export function validateUniverseSearch(input = {}) {
  return {
    q: String(input.q || input.query || '').trim(),
    limit: clamp(input.limit, 1, 100, 25),
    includeEtfs: input.include_etfs !== false && input.includeEtfs !== false,
  };
}

export function createRealtimeMessage(type, payload = {}, requestId) {
  return {
    id: crypto.randomUUID(),
    request_id: requestId || null,
    type,
    payload,
    timestamp: new Date().toISOString(),
  };
}

export function parseRealtimeEnvelope(raw) {
  const envelope = typeof raw === 'string' ? JSON.parse(raw) : raw;
  if (!envelope || typeof envelope !== 'object') throw new Error('message must be a JSON object');
  const type = String(envelope.type || 'analyze');
  return {
    type,
    requestId: envelope.request_id || envelope.id || crypto.randomUUID(),
    payload: envelope.payload && typeof envelope.payload === 'object' ? envelope.payload : envelope,
  };
}

function clamp(value, min, max, fallback) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.max(min, Math.min(max, Math.trunc(number)));
}
