import { ok } from '../../../src/lib/responseEnvelope.js';

export default async function handler(request, response) {
  return response.status(200).json(ok([
    { name: 'Quotes', coverage: 0.9 },
    { name: 'OHLCV', coverage: 0.84 },
    { name: 'Probabilities', coverage: 0.78 },
    { name: 'Monte Carlo', coverage: 0.82 },
    { name: 'Backtests', coverage: 0.68 },
    { name: 'Macro', coverage: process.env.FRED_API_KEY ? 0.86 : 0.45 },
    { name: 'News', coverage: process.env.ALPHA_VANTAGE_API_KEY ? 0.78 : 0.38 },
  ], { source: 'cache', warnings: ['Coverage describes configured app surface, not prediction accuracy.'] }));
}
