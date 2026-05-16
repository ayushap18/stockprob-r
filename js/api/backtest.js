import { runWalkForwardBacktest } from '../server/backtesting/backtest.js';
import { createJobQueue, summarizeJob } from '../server/queue/jobs.js';
import { createStorageAdapter } from '../server/storage/store.js';

const DEFAULT_UNIVERSE = ['MSFT', 'AAPL', 'NVDA'];

export default async function handler(request, response) {
  if (request.method && !['GET', 'POST'].includes(request.method)) {
    return response.status(405).json({ error: 'method_not_allowed', message: 'Use GET or POST /api/backtest' });
  }

  const queue = request.queue || createJobQueue();
  let job = null;
  try {
    response.setHeader?.('Cache-Control', 's-maxage=900, stale-while-revalidate=1800');
    const source = request.method === 'POST' ? request.body || {} : request.query || {};
    const horizon = Number(source.horizon || 5);
    if (![5, 10, 20].includes(horizon)) return response.status(400).json({ error: 'horizon must be 5, 10, or 20' });

    const universe = normalizeTickers(source.universe || source.tickers || DEFAULT_UNIVERSE).slice(0, 8);
    job = await queue.enqueue('backtest', {
      universe,
      horizon,
      rebalance: source.rebalance || 'weekly',
      top_n: Number(source.top_n || source.topN || 2),
    });
    job = await queue.start(job);

    const priceHistoryByTicker = source.priceHistoryByTicker || request.priceHistoryByTicker || createDemoHistory(universe);
    const result = await runWalkForwardBacktest({
      universe,
      horizon,
      rebalance: source.rebalance || 'weekly',
      priceHistoryByTicker,
      topN: Number(source.top_n || source.topN || 2),
      transactionCostBps: Number(source.transaction_cost_bps || 5),
      slippageBps: Number(source.slippage_bps || 5),
    });

    const payload = {
      ...result,
      generated_at: new Date().toISOString(),
      data_mode: source.priceHistoryByTicker || request.priceHistoryByTicker ? 'provided-history' : 'demo-history',
      warnings: [...(result.warnings || []), 'Demo backtest endpoint uses generated history unless caller provides priceHistoryByTicker'],
    };
    job = await queue.complete(job, {
      trades: payload.trades?.length || 0,
      sharpe_ratio: payload.metrics?.sharpe_ratio ?? null,
      cagr: payload.metrics?.cagr ?? null,
    });
    payload.queue_job = summarizeJob(job);
    const storage = request.storage || createStorageAdapter();
    await storage.saveBacktest({
      universe,
      horizon: payload.horizon,
      rebalance: payload.rebalance,
      top_n: payload.top_n,
      data_mode: payload.data_mode,
      metrics: payload.metrics,
      payload,
    }).catch(() => null);

    return response.status(200).json(payload);
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

function createDemoHistory(universe) {
  const history = { SPY: series(420, 0.18, 0.9) };
  for (const [index, ticker] of universe.entries()) {
    history[ticker] = series(100 + index * 36, 0.2 + index * 0.05, 1.2 + index * 0.2);
  }
  return history;
}

function series(startPrice, drift, wave) {
  const start = new Date('2025-01-02T00:00:00Z');
  return Array.from({ length: 280 }, (_, index) => {
    const date = new Date(start);
    date.setUTCDate(start.getUTCDate() + index);
    const close = startPrice + index * drift + Math.sin(index / (8 + wave)) * wave;
    return {
      date: date.toISOString().slice(0, 10),
      open: close * 0.995,
      high: close * 1.012,
      low: close * 0.988,
      close,
      volume: 1_000_000 + index * 1_000,
    };
  });
}
