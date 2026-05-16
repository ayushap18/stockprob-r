import { getOhlcv } from '../../../src/lib/providers/index.js';
import { ok, fail } from '../../../src/lib/responseEnvelope.js';
import { normalizeDate, normalizeInterval, normalizeLimit, normalizeSymbol } from '../../../src/lib/validation.js';

export default async function handler(request, response) {
  const started = Date.now();
  try {
    const symbol = normalizeSymbol(request.query?.symbol || request.query?.ticker);
    const interval = normalizeInterval(request.query?.interval, '1d');
    const from = normalizeDate(request.query?.from, null);
    const to = normalizeDate(request.query?.to, new Date().toISOString().slice(0, 10));
    const limit = normalizeLimit(request.query?.limit, 520);
    const result = await getOhlcv(symbol, { interval, from, to, limit });
    return response.status(200).json(ok(result.data, {
      source: result.source,
      isDemo: result.source === 'demo',
      stale: result.cache?.stale,
      latencyMs: Date.now() - started || result.latencyMs,
      warnings: [...(result.warnings || []), ...(result.cache?.warnings || [])],
    }));
  } catch (error) {
    return response.status(error.status || 500).json(fail(error, { source: 'demo' }));
  }
}
