import { calculateDerivedFeatures } from '../../../src/lib/derivedFeatures.js';
import { getOhlcv } from '../../../src/lib/providers/index.js';
import { ok, fail } from '../../../src/lib/responseEnvelope.js';
import { normalizeSymbol } from '../../../src/lib/validation.js';

export default async function handler(request, response) {
  try {
    const symbol = normalizeSymbol(request.query?.symbol || request.query?.ticker);
    const [prices, spy] = await Promise.all([getOhlcv(symbol, { limit: 260 }), getOhlcv('SPY', { limit: 260 })]);
    const data = calculateDerivedFeatures({ symbol, prices: prices.data || [], spy: spy.data || [] });
    return response.status(200).json(ok(data, {
      source: prices.source,
      isDemo: prices.source === 'demo',
      stale: prices.cache?.stale,
      warnings: [...(prices.warnings || []), ...(spy.warnings || [])],
    }));
  } catch (error) {
    return response.status(error.status || 500).json(fail(error));
  }
}
