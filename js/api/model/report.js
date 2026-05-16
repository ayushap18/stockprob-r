import { modelReportFromOutcomes } from '../../server/models/evaluation.js';

export default async function handler(request, response) {
  if (request.method && !['GET', 'POST'].includes(request.method)) {
    return response.status(405).json({ error: 'method_not_allowed', message: 'Use GET or POST /api/model/report' });
  }

  try {
    response.setHeader?.('Cache-Control', 's-maxage=900, stale-while-revalidate=1800');
    const source = request.method === 'POST' ? request.body || {} : request.query || {};
    const horizon = normalizeHorizon(source.horizon || 5);
    const providedOutcomes = Array.isArray(source.outcomes) ? source.outcomes : null;
    const outcomes = providedOutcomes || demoOutcomes(horizon);
    const report = modelReportFromOutcomes({
      outcomes,
      horizon,
      modelVersion: source.model_version || source.modelVersion || 'stockprob-js-baseline-v1',
      dataMode: providedOutcomes ? 'provided-outcomes' : 'demo-outcomes',
    });

    return response.status(200).json(report);
  } catch (error) {
    return response.status(error.status || 500).json({
      error: error.code || 'model_report_failed',
      message: error.message || 'Model report failed',
    });
  }
}

function normalizeHorizon(input) {
  const horizon = Number(input);
  if (![5, 10, 20].includes(horizon)) throw Object.assign(new Error('horizon must be 5, 10, or 20'), { status: 400, code: 'invalid_horizon' });
  return horizon;
}

function demoOutcomes(horizon) {
  const tickers = ['MSFT', 'AAPL', 'NVDA', 'TSLA', 'AMZN', 'GOOGL', 'META', 'AVGO', 'JPM', 'XOM', 'LLY', 'COST'];
  return Array.from({ length: 120 }, (_, index) => {
    const cycle = Math.sin(index / 7) * 0.12 + Math.cos(index / 11) * 0.05;
    const probability = Math.max(0.08, Math.min(0.92, 0.52 + cycle + (index % 5 === 0 ? 0.12 : -0.03)));
    const realizedEdge = probability - 0.48 + Math.sin(index / 3) * 0.2;
    return {
      ticker: tickers[index % tickers.length],
      as_of_date: demoDate(index),
      horizon: `${horizon}d`,
      probability_outperform_spy: probability,
      actual_outperformed_spy: realizedEdge > 0.12,
      expected_excess_return: (probability - 0.5) * horizon * 0.004,
    };
  });
}

function demoDate(index) {
  const date = new Date('2025-01-02T00:00:00Z');
  date.setUTCDate(date.getUTCDate() + index);
  return date.toISOString().slice(0, 10);
}
