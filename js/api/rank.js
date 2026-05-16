import { rankUniverse } from '../server/models/predict.js';
import { createJobQueue, summarizeJob } from '../server/queue/jobs.js';

const DEFAULT_TICKERS = ['MSFT', 'AAPL', 'NVDA', 'TSLA', 'AMZN', 'GOOGL'];

export default async function handler(request, response) {
  if (request.method && !['GET', 'POST'].includes(request.method)) {
    return response.status(405).json({ error: 'method_not_allowed', message: 'Use GET or POST /api/rank' });
  }

  const queue = request.queue || createJobQueue();
  let job = null;
  try {
    response.setHeader?.('Cache-Control', 's-maxage=300, stale-while-revalidate=900');
    const source = request.method === 'POST' ? request.body || {} : request.query || {};
    const horizon = Number(source.horizon || 5);
    if (![5, 10, 20].includes(horizon)) return response.status(400).json({ error: 'horizon must be 5, 10, or 20' });

    const tickers = normalizeTickers(source.tickers || source.ticker || DEFAULT_TICKERS);
    if (!tickers.length) return response.status(400).json({ error: 'tickers are required' });

    const selectedTickers = tickers.slice(0, 12);
    job = await queue.enqueue('rank', {
      tickers: selectedTickers,
      horizon,
      as_of_date: source.as_of_date || source.asOfDate || null,
    });
    job = await queue.start(job);

    const ranked = await rankUniverse({
      tickers: selectedTickers,
      horizon,
      asOfDate: source.as_of_date || source.asOfDate,
      dataClient: request.dataClient,
      marketDataByTicker: request.marketDataByTicker || {},
    });
    job = await queue.complete(job, { count: ranked.rankings.length });

    return response.status(200).json({
      ...ranked,
      count: ranked.rankings.length,
      queue_job: summarizeJob(job),
      generated_at: new Date().toISOString(),
      warnings: ['Rankings are probabilistic and depend on provider availability'],
    });
  } catch (error) {
    if (job) await queue.fail(job, error).catch(() => null);
    return response.status(error.status || 500).json({
      error: error.status ? error.message : 'Internal server error',
      details: error.details || undefined,
    });
  }
}

function normalizeTickers(input) {
  const values = Array.isArray(input) ? input : String(input || '').split(',');
  return [...new Set(values.map((ticker) => String(ticker).trim().toUpperCase()).filter((ticker) => /^[A-Z][A-Z0-9.-]{0,14}$/.test(ticker)))];
}
