import { predictOutperformance } from '../server/models/predict.js';

export default async function handler(request, response) {
  try {
    const source = request.method === 'POST' ? request.body || {} : request.query || {};
    const ticker = String(source.ticker || '').trim().toUpperCase();
    const horizon = Number(source.horizon || 5);
    const asOfDate = source.as_of_date || source.asOfDate || new Date().toISOString().slice(0, 10);

    if (!ticker) {
      response.status(400).json({ error: 'ticker is required' });
      return;
    }
    if (![5, 10, 20].includes(horizon)) {
      response.status(400).json({ error: 'horizon must be 5, 10, or 20' });
      return;
    }

    const result = await predictOutperformance({ ticker, horizon, asOfDate });
    response.status(200).json(result);
  } catch (error) {
    response.status(error.status || 500).json({ error: error.status ? error.message : 'Internal server error' });
  }
}
