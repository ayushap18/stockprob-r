import { getQuote } from '../../../src/lib/providers/index.js';
import { ok, fail } from '../../../src/lib/responseEnvelope.js';
import { normalizeSymbol } from '../../../src/lib/validation.js';

export default async function handler(request, response) {
  const started = Date.now();
  try {
    const symbol = normalizeSymbol(request.query?.symbol || request.query?.ticker);
    const force = request.query?.force === '1' || request.query?.refresh === '1';
    const result = await getQuote(symbol, { force });
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
