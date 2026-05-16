import { sanitizeError } from './validation.js';

export function ok(data, meta = {}) {
  return {
    ok: true,
    data,
    meta: {
      source: meta.source || 'cache',
      isDemo: Boolean(meta.isDemo),
      asOf: meta.asOf || new Date().toISOString(),
      stale: Boolean(meta.stale),
      latencyMs: Math.max(0, Math.round(Number(meta.latencyMs || 0))),
      warnings: Array.isArray(meta.warnings) ? meta.warnings : [],
    },
  };
}

export function fail(error, meta = {}) {
  return {
    ok: false,
    error: sanitizeError(error),
    meta: {
      source: meta.source || 'demo',
      isDemo: Boolean(meta.isDemo),
      warnings: Array.isArray(meta.warnings) ? meta.warnings : [],
    },
  };
}

export function sendJson(response, status, payload) {
  response.setHeader?.('Content-Type', 'application/json');
  response.status(status).json(payload);
}

export function realtimeEnvelope(type, data, { symbol = null, source = 'cache', isDemo = false, warnings = [] } = {}) {
  return {
    type,
    symbol,
    timestamp: new Date().toISOString(),
    source,
    isDemo,
    data,
    warnings,
  };
}
