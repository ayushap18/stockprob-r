import { predictOutperformance } from '../server/models/predict.js';
import { parseOutperformancePayload } from '../server/routes/stockprob.js';
import { createStorageAdapter } from '../server/storage/store.js';

export default async function handler(request, response) {
  try {
    response.setHeader?.('Cache-Control', 's-maxage=300, stale-while-revalidate=900');
    const source = request.method === 'POST' ? request.body || {} : request.query || {};
    const parsed = parseOutperformancePayload({
      ...source,
      as_of_date: source.as_of_date || source.asOfDate,
    });

    const result = await predictOutperformance({
      ticker: parsed.ticker,
      horizon: parsed.horizon,
      asOfDate: parsed.as_of_date || new Date().toISOString().slice(0, 10),
      riskTolerance: parsed.risk_tolerance,
      dataClient: request.dataClient,
    });
    const storage = request.storage || createStorageAdapter();
    await storage.savePrediction({
      ticker: result.ticker,
      horizon: result.horizon,
      as_of_date: result.as_of_date,
      probability_outperform_spy: result.probability_outperform_spy,
      expected_return: result.expected_return,
      expected_excess_return: result.expected_excess_return,
      risk_score: result.risk_score,
      confidence: result.confidence,
      signal: result.signal,
      payload: result,
    }).catch(() => null);
    response.status(200).json(result);
  } catch (error) {
    response.status(error.status || 500).json({
      error: error.status ? error.message : 'Internal server error',
      details: error.details || undefined,
    });
  }
}
