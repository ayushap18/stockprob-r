import { buildDashboardSnapshot } from '../../../src/lib/buildDashboardSnapshot.js';
import { ok, fail } from '../../../src/lib/responseEnvelope.js';
import { normalizeHorizonDays, normalizeSymbol } from '../../../src/lib/validation.js';

export default async function handler(request, response) {
  try {
    const symbol = normalizeSymbol(request.query?.symbol || request.query?.ticker || 'MSFT');
    const horizonDays = normalizeHorizonDays(request.query?.horizonDays || request.query?.horizon, 5);
    const benchmarkSymbol = normalizeSymbol(request.query?.benchmark || 'SPY');
    const force = request.query?.force === '1' || request.query?.refresh === '1';
    const snapshot = await buildDashboardSnapshot(symbol, { horizonDays, benchmarkSymbol, force });
    return response.status(200).json(ok(snapshot.data, snapshot.meta));
  } catch (error) {
    return response.status(error.status || 500).json(fail(error, { source: 'demo' }));
  }
}
