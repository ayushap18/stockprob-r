import { buildDashboardSnapshot } from '../../../src/lib/buildDashboardSnapshot.js';
import { ok, fail } from '../../../src/lib/responseEnvelope.js';
import { normalizeHorizonDays, normalizeLimit, normalizeSymbol } from '../../../src/lib/validation.js';

export default async function handler(request, response) {
  try {
    const symbol = normalizeSymbol(request.query?.symbol || request.query?.ticker || 'MSFT');
    const horizonDays = normalizeHorizonDays(request.query?.horizonDays || request.query?.days, 30);
    const simulations = normalizeLimit(request.query?.simulations, 1200, 10000);
    const snapshot = await buildDashboardSnapshot(symbol, { horizonDays, simulations });
    return response.status(200).json(ok(snapshot.data.monteCarlo, { ...snapshot.meta, source: 'model' }));
  } catch (error) {
    return response.status(error.status || 500).json(fail(error));
  }
}
