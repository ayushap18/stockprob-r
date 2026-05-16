import { predictOutperformance } from '../../server/models/predict.js';
import { realtimeEnvelope } from '../../src/lib/responseEnvelope.js';
import { normalizeHorizonDays, normalizeSymbols } from '../../src/lib/validation.js';

export default async function handler(request, response) {
  const symbols = normalizeSymbols(request.query?.symbols || request.query?.symbol || request.query?.ticker, ['MSFT']);
  const horizonDays = normalizeHorizonDays(request.query?.horizonDays || request.query?.horizon, 5);
  response.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
  response.setHeader('Cache-Control', 'no-cache, no-transform');
  response.setHeader('Connection', 'keep-alive');
  for (const symbol of symbols.slice(0, 8)) {
    try {
      const prediction = await predictOutperformance({ ticker: symbol, horizon: [5, 10, 20].includes(horizonDays) ? horizonDays : 5 });
      response.write(`event: probability.update\n`);
      response.write(`data: ${JSON.stringify(realtimeEnvelope('probability.update', {
        symbol,
        horizonDays,
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
      }, { symbol, source: prediction.provider_status?.market || 'cache', isDemo: false, warnings: prediction.warnings || [] }))}\n\n`);
    } catch (error) {
      response.write(`event: error\n`);
      response.write(`data: ${JSON.stringify(realtimeEnvelope('error', { code: error.code || 'PROVIDER_ERROR', message: error.message }, { symbol, source: 'demo', isDemo: true }))}\n\n`);
    }
  }
  response.end();
}
