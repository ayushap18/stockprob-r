import { runWalkForwardBacktest } from '../backtesting/backtest.js';
import { infrastructureReadiness } from '../config/infrastructure.js';
import { createCompositeDataClient } from '../data/clients.js';
import { cacheStats, providerSummary } from '../data/resilience.js';
import { rankUniverse } from '../models/predict.js';
import { queueWorkerPlan } from './jobs.js';

const DEFAULT_RANK_TICKERS = ['MSFT', 'AAPL', 'NVDA', 'TSLA', 'AMZN', 'GOOGL'];
const DEFAULT_BACKTEST_UNIVERSE = ['MSFT', 'AAPL', 'NVDA'];

export async function processQueueJob(job = {}) {
  const type = normalizeType(job.type);
  const payload = job.payload || {};
  const deps = job.deps || {};
  if (type === 'rank') return processRankJob(payload, deps);
  if (type === 'backtest') return processBacktestJob(payload, deps);
  if (type === 'provider-refresh') return processProviderRefreshJob(payload, deps);
  if (type === 'analysis') return processAnalysisJob(payload, deps);
  throw Object.assign(new Error(`Unsupported queue job type: ${type}`), { code: 'INVALID_JOB_TYPE' });
}

export async function processRankJob(payload = {}, deps = {}) {
  const tickers = normalizeTickers(payload.tickers || payload.ticker || DEFAULT_RANK_TICKERS).slice(0, positiveInteger(payload.limit, 50));
  if (!tickers.length) throw Object.assign(new Error('rank job requires at least one ticker'), { code: 'INVALID_TICKER' });
  const ranked = await rankUniverse({
    tickers,
    horizon: normalizeHorizon(payload.horizon),
    asOfDate: payload.as_of_date || payload.asOfDate,
    dataClient: deps.dataClient,
    marketDataByTicker: deps.marketDataByTicker || payload.marketDataByTicker || {},
  });
  return {
    type: 'rank',
    count: ranked.rankings.length,
    generated_at: new Date().toISOString(),
    payload: ranked,
  };
}

export async function processBacktestJob(payload = {}, deps = {}) {
  const universe = normalizeTickers(payload.universe || payload.tickers || DEFAULT_BACKTEST_UNIVERSE).slice(0, positiveInteger(payload.limit, 25));
  if (!universe.length) throw Object.assign(new Error('backtest job requires at least one ticker'), { code: 'INVALID_TICKER' });
  const priceHistoryByTicker = deps.priceHistoryByTicker || payload.priceHistoryByTicker || createDemoHistory(universe);
  const result = await runWalkForwardBacktest({
    universe,
    horizon: normalizeHorizon(payload.horizon),
    rebalance: payload.rebalance || 'weekly',
    priceHistoryByTicker,
    topN: positiveInteger(payload.top_n || payload.topN, 2),
    transactionCostBps: Number(payload.transaction_cost_bps ?? payload.transactionCostBps ?? 5),
    slippageBps: Number(payload.slippage_bps ?? payload.slippageBps ?? 5),
  });
  return {
    type: 'backtest',
    count: result.trades.length,
    generated_at: new Date().toISOString(),
    payload: {
      ...result,
      data_mode: deps.priceHistoryByTicker || payload.priceHistoryByTicker ? 'provided-history' : 'demo-history',
    },
  };
}

export async function processProviderRefreshJob(payload = {}, deps = {}) {
  const client = deps.dataClient || createCompositeDataClient();
  const providers = client.status();
  const infrastructure = infrastructureReadiness({ cacheStats: cacheStats() });
  return {
    type: 'provider-refresh',
    generated_at: new Date().toISOString(),
    payload: {
      ok: true,
      scope: payload.scope || 'all',
      providers,
      provider_summary: providerSummary(providers),
      infrastructure,
    },
  };
}

export async function processAnalysisJob(payload = {}, deps = {}) {
  const ticker = normalizeTickers(payload.ticker || payload.tickers)?.[0];
  if (!ticker) throw Object.assign(new Error('analysis job requires a ticker'), { code: 'INVALID_TICKER' });
  const ranked = await processRankJob({ ...payload, tickers: [ticker] }, deps);
  return {
    type: 'analysis',
    count: 1,
    generated_at: ranked.generated_at,
    payload: ranked.payload.rankings[0],
  };
}

export function workerReadiness({ env = process.env } = {}) {
  const redisConfigured = Boolean(env.REDIS_URL);
  return {
    mode: redisConfigured ? 'redis' : 'memory',
    status: redisConfigured ? 'ready_for_distributed_worker' : 'local_only',
    required_processes: redisConfigured ? ['stockprob-worker', 'stockprob-realtime'] : ['stockprob-worker:local'],
    queues: queueWorkerPlan().queues.map(({ name, concurrency, rate_limit_per_minute }) => ({ name, concurrency, rate_limit_per_minute })),
    notes: redisConfigured
      ? ['REDIS_URL configured; run npm run worker as a separate long-lived process.']
      : ['REDIS_URL missing; worker runs only against this process memory queue.'],
  };
}

function normalizeType(type) {
  return String(type || '').trim().toLowerCase();
}

function normalizeHorizon(horizon) {
  const value = Number(horizon || 5);
  if (![5, 10, 20].includes(value)) throw Object.assign(new Error('horizon must be 5, 10, or 20'), { code: 'INVALID_HORIZON' });
  return value;
}

function normalizeTickers(input) {
  const values = Array.isArray(input) ? input : String(input || '').split(',');
  return [...new Set(values.map((ticker) => String(ticker).trim().toUpperCase()).filter((ticker) => /^[A-Z][A-Z0-9.-]{0,14}$/.test(ticker)))];
}

function positiveInteger(value, fallback) {
  const numeric = Number(value);
  return Number.isFinite(numeric) && numeric > 0 ? Math.floor(numeric) : fallback;
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
