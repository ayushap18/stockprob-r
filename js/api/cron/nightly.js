import { createJobQueue, summarizeJob } from '../../server/queue/jobs.js';

const DEFAULT_TICKERS = ['MSFT', 'AAPL', 'NVDA', 'TSLA', 'AMZN', 'GOOGL', 'META', 'AVGO'];

export default async function handler(request, response) {
  if (request.method && !['GET', 'POST'].includes(request.method)) {
    return response.status(405).json({ error: 'method_not_allowed', message: 'Use GET or POST /api/cron/nightly' });
  }

  const env = request.env || process.env;
  if (!authorized(request, env)) return response.status(401).json({ error: 'unauthorized', message: 'Missing or invalid cron bearer token' });

  try {
    response.setHeader?.('Cache-Control', 'no-store');
    const source = request.method === 'POST' ? request.body || {} : request.query || {};
    const horizon = normalizeHorizon(source.horizon || 5);
    const tickers = normalizeTickers(source.tickers || source.ticker || DEFAULT_TICKERS).slice(0, 100);
    if (!tickers.length) return response.status(400).json({ error: 'tickers are required' });

    const queue = request.queue || createJobQueue({ env });
    const jobs = [];
    jobs.push(
      await queue.enqueue(
        'provider-refresh',
        { scope: source.scope || 'nightly', as_of_date: source.as_of_date || source.asOfDate || today() },
        { priority: 3, maxAttempts: 3 }
      )
    );
    jobs.push(
      await queue.enqueue(
        'rank',
        { tickers, horizon, as_of_date: source.as_of_date || source.asOfDate || today(), source: 'nightly-cron' },
        { priority: 4, maxAttempts: 3 }
      )
    );
    jobs.push(
      await queue.enqueue(
        'backtest',
        { universe: tickers.slice(0, 25), horizon, rebalance: source.rebalance || 'weekly', top_n: Number(source.top_n || source.topN || 5), source: 'nightly-cron' },
        { priority: 6, maxAttempts: 2 }
      )
    );

    return response.status(200).json({
      ok: true,
      scheduled_at: new Date().toISOString(),
      horizon: `${horizon}d`,
      tickers,
      queue_mode: queue.kind,
      enqueued: jobs.map(summarizeJob),
      warnings: env.CRON_SECRET ? [] : ['CRON_SECRET is not configured; endpoint allows local/dev requests only'],
    });
  } catch (error) {
    return response.status(error.status || 500).json({
      error: error.code || 'cron_failed',
      message: error.message || 'Nightly cron failed',
    });
  }
}

function authorized(request, env) {
  if (!env.CRON_SECRET) return true;
  const header = request.headers?.authorization || request.headers?.Authorization || '';
  return header === `Bearer ${env.CRON_SECRET}`;
}

function normalizeHorizon(input) {
  const horizon = Number(input);
  if (![5, 10, 20].includes(horizon)) throw Object.assign(new Error('horizon must be 5, 10, or 20'), { status: 400, code: 'invalid_horizon' });
  return horizon;
}

function normalizeTickers(input) {
  const values = Array.isArray(input) ? input : String(input || '').split(',');
  return [...new Set(values.map((ticker) => String(ticker).trim().toUpperCase()).filter((ticker) => /^[A-Z][A-Z0-9.-]{0,14}$/.test(ticker)))];
}

function today() {
  return new Date().toISOString().slice(0, 10);
}
