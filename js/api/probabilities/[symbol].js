import { predictOutperformance } from '../../server/models/predict.js';
import { ok, fail } from '../../src/lib/responseEnvelope.js';
import { normalizeHorizonDays, normalizeSymbol } from '../../src/lib/validation.js';

export default async function handler(request, response) {
  const started = Date.now();
  try {
    const symbol = normalizeSymbol(request.query?.symbol || request.query?.ticker || 'MSFT');
    const requested = normalizeHorizonDays(request.query?.horizonDays || request.query?.horizon, 5);
    const horizon = [5, 10, 20].includes(requested) ? requested : 5;
    const prediction = await predictOutperformance({ ticker: symbol, horizon });
    return response.status(200).json(ok({
      symbol,
      horizonDays: requested,
      probabilityOutperformSpy: prediction.probability_outperform_spy,
      probabilityProfit: Math.max(0, Math.min(1, prediction.probability_outperform_spy - 0.04)),
      probabilityLossGt10: prediction.monte_carlo?.prob_loss_gt_10pct ?? null,
      expectedReturn: prediction.expected_return,
      expectedExcessReturn: prediction.expected_excess_return,
      riskScore: prediction.risk_score,
      qualityScore: prediction.fundamental_score,
      momentumScore: prediction.technical_score,
      confidence: prediction.confidence,
      modelVersion: 'baseline-v1',
      raw: prediction,
    }, {
      source: prediction.provider_status?.market || 'cache',
      isDemo: false,
      latencyMs: Date.now() - started,
      warnings: prediction.warnings || [],
    }));
  } catch (error) {
    return response.status(error.status || 500).json(fail(error, { source: 'demo' }));
  }
}
