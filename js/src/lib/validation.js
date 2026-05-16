export const SYMBOL_RE = /^[A-Z0-9.-]{1,12}$/;
export const INTERVALS = new Set(['1m', '5m', '15m', '1h', '1d', '1wk', '1mo']);

export function normalizeSymbol(input, fallback = null) {
  const symbol = String(input || fallback || '').trim().toUpperCase();
  if (!SYMBOL_RE.test(symbol)) throw safeError('INVALID_TICKER', 'Ticker must use letters, numbers, dot, or hyphen and be 1-12 characters.', 400);
  return symbol;
}

export function normalizeSymbols(input, fallback = ['MSFT']) {
  const raw = Array.isArray(input) ? input : String(input || fallback.join(',')).split(',');
  const symbols = [...new Set(raw.map((value) => String(value).trim().toUpperCase()).filter(Boolean))].slice(0, 50);
  if (!symbols.length) throw safeError('INVALID_TICKER', 'At least one ticker is required.', 400);
  return symbols.map((symbol) => normalizeSymbol(symbol));
}

export function normalizeInterval(input, fallback = '1d') {
  const interval = String(input || fallback);
  if (!INTERVALS.has(interval)) throw safeError('INVALID_INTERVAL', 'Unsupported interval. Use 1m, 5m, 15m, 1h, 1d, 1wk, or 1mo.', 400);
  return interval;
}

export function normalizeDate(input, fallback = null) {
  if (!input) return fallback;
  const value = String(input).slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || Number.isNaN(Date.parse(`${value}T00:00:00Z`))) {
    throw safeError('INVALID_DATE', 'Date must use YYYY-MM-DD.', 400);
  }
  return value;
}

export function normalizeHorizonDays(input, fallback = 5) {
  const value = Number(input || fallback);
  if (!Number.isInteger(value) || value < 1 || value > 365) throw safeError('INVALID_HORIZON', 'horizonDays must be an integer from 1 to 365.', 400);
  return value;
}

export function normalizeLimit(input, fallback = 260, max = 1500) {
  const value = Number(input || fallback);
  if (!Number.isFinite(value)) return fallback;
  return Math.min(max, Math.max(1, Math.floor(value)));
}

export function safeError(code, message, status = 500) {
  const error = new Error(message);
  error.code = code;
  error.status = status;
  return error;
}

export function sanitizeError(error) {
  return {
    code: error?.code || (error?.status === 400 ? 'BAD_REQUEST' : 'PROVIDER_ERROR'),
    message: error?.status === 500 || !error?.status ? 'Request failed safely. Try again later or use fallback data.' : error.message,
  };
}

export function requireCronSecret(request) {
  const configured = process.env.CRON_SECRET;
  if (!configured) return true;
  const header = request.headers?.authorization || request.headers?.Authorization || '';
  if (header === `Bearer ${configured}`) return true;
  throw safeError('UNAUTHORIZED', 'Missing or invalid cron authorization.', 401);
}
