import { calculateDerivedFeatures } from './derivedFeatures.js';
import { generateDemoDashboardData } from './demoDashboardData.js';
import { generateDemoProbabilityTrend } from './demoChartData.js';
import { getMemoryStatus } from './memoryManager.js';
import { downsamplePaths, runMonteCarloSimulation } from './monteCarlo.js';
import { cacheStats } from './cache.js';
import { getQueueStatus } from './jobs.js';
import { getOhlcv, getQuote, providerReadiness } from './providers/index.js';

export async function buildDashboardSnapshot(symbol = 'MSFT', { horizonDays = 5, benchmarkSymbol = 'SPY', force = false } = {}) {
  const started = Date.now();
  const ticker = String(symbol || 'MSFT').toUpperCase();
  const benchmarkTicker = String(benchmarkSymbol || 'SPY').toUpperCase();
  const demo = generateDemoDashboardData(ticker);
  const warnings = [];
  const [quote, prices, spy, queue] = await Promise.all([
    getQuote(ticker, { force }).catch((error) => ({ ...demoProvider(demo.quote), warnings: [error.message] })),
    getOhlcv(ticker, { limit: 1500, force }).catch((error) => ({ ...demoProvider(demo.candles), warnings: [error.message] })),
    getOhlcv(benchmarkTicker, { limit: 1500, force }).catch((error) => ({ ...demoProvider(demo.candles), warnings: [error.message] })),
    getQueueStatus().catch(() => ({ queueDepth: 0, activeJobs: 0 })),
  ]);
  warnings.push(...(quote.warnings || []), ...(prices.warnings || []), ...(spy.warnings || []));
  const candles = Array.isArray(prices.data) && prices.data.length ? prices.data : demo.candles;
  const spyRows = Array.isArray(spy.data) && spy.data.length ? spy.data : demo.candles;
  const benchmark = cumulativeCompare(candles, spyRows);
  const derived = calculateDerivedFeatures({ symbol: ticker, prices: candles, spy: spyRows, macro: demo.macro.at(-1) || {} });
  const probabilityHistory = generateDemoProbabilityTrend(ticker);
  const probability = probabilityFromDerived(derived, demo.probabilities.probabilityOutperformSpy);
  const expectedReturn = expectedReturnFromCandles(candles, horizonDays);
  const latest = candles.at(-1);
  const simulation = runMonteCarloSimulation({
    startPrice: latest?.close || demo.quote.price,
    expectedReturnAnnual: expectedReturn * (252 / horizonDays),
    volatilityAnnual: derived.volatility_20d || 0.24,
    days: horizonDays,
    simulations: 1200,
    seed: `${ticker}:${horizonDays}:${latest?.date || ''}`,
  });
  const providerHealth = providerReadiness();
  const systemHealth = {
    status: providerHealth.some((provider) => provider.configured) ? 'ok' : 'degraded',
    db: process.env.DATABASE_URL ? 'ok' : 'unknown',
    redis: process.env.REDIS_URL ? 'ok' : 'unknown',
    queueDepth: queue.queueDepth || 0,
    lastCronRun: null,
    activeJobs: queue.activeJobs || 0,
    errorCount24h: 0,
  };
  const memoryHealth = getMemoryStatus(cacheStats());
  return {
    data: {
      ...demo,
      symbol: ticker,
      quote: quote.data || demo.quote,
      candles,
      benchmark: benchmark.length ? benchmark : demo.benchmark,
      probabilities: {
        ...demo.probabilities,
        horizonDays,
        probabilityOutperformSpy: probability,
        probabilityProfit: simulation.summary.probabilityProfit,
        probabilityLossGt10: simulation.finalReturns.filter((value) => value < -0.1).length / simulation.finalReturns.length,
        expectedReturn,
        expectedExcessReturn: expectedReturn - 0.0015 * horizonDays,
        riskScore: clamp((derived.volatility_20d || 0.22) + Math.max(0, -(derived.relative_strength_vs_spy || 0))),
        qualityScore: demo.scores.fundamental,
        momentumScore: clamp(0.5 + (derived.momentum_20d || 0) * 3),
        confidence: clamp(0.62 - warnings.length * 0.025 - (quote.source === 'demo' ? 0.15 : 0)),
        modelVersion: 'connected-baseline-v1',
      },
      probabilityHistory,
      expectedReturns: probabilityHistory,
      monteCarlo: { ...simulation, paths: downsamplePaths(simulation.paths, 120), probabilityOutperformSpy: probability },
      technicals: derived,
      features: featureRows(derived, demo.features),
      providerHealth,
      systemHealth,
      memoryHealth,
    },
    meta: {
      source: quote.source || prices.source || 'cache',
      isDemo: quote.source === 'demo' && prices.source === 'demo',
      stale: Boolean(quote.cache?.stale || prices.cache?.stale),
      asOf: quote.data?.asOf || new Date().toISOString(),
      latencyMs: Date.now() - started,
      warnings: [...new Set(warnings.filter(Boolean))],
    },
  };
}

function cumulativeCompare(stockRows, spyRows) {
  const spyByDate = new Map(spyRows.map((row) => [row.date || row.time, row]));
  let stockBase = null;
  let spyBase = null;
  return stockRows.map((row) => {
    const spy = spyByDate.get(row.date || row.time);
    if (!spy) return null;
    stockBase ??= row.close;
    spyBase ??= spy.close;
    const stockReturn = stockBase ? row.close / stockBase - 1 : 0;
    const spyReturn = spyBase ? spy.close / spyBase - 1 : 0;
    return { date: row.date || row.time, stockReturn, spyReturn, excessReturn: stockReturn - spyReturn };
  }).filter(Boolean);
}

function probabilityFromDerived(features, fallback) {
  return clamp((fallback || 0.5) + (features.relative_strength_vs_spy || 0) * 1.6 + (features.momentum_20d || 0) * 0.9 - Math.max(0, (features.volatility_20d || 0.2) - 0.35) * 0.25);
}

function expectedReturnFromCandles(candles, horizonDays) {
  const last = candles.at(-1);
  const previous = candles.at(-1 - Math.min(horizonDays, candles.length - 1));
  return last && previous ? (last.close / previous.close - 1) * 0.45 : 0;
}

function featureRows(features, fallback) {
  return [
    ['20D Momentum', features.momentum_20d],
    ['Volatility 20D', -features.volatility_20d],
    ['Beta to SPY', features.beta_to_spy],
    ['Relative Strength', features.relative_strength_vs_spy],
    ['Macro Regime', features.macro_regime_score],
    ['Filing Risk', -features.filing_risk_phrase_score],
  ].map(([feature, impact], index) => ({ feature, impact: Number(impact || 0), importance: Math.max(0.02, Math.abs(Number(impact || 0)) || fallback[index]?.importance || 0.04) }));
}

function demoProvider(data) {
  return { ok: true, data, source: 'demo', latencyMs: 0, warnings: ['Deterministic demo fallback used.'], error: null };
}

function clamp(value) {
  return Math.min(1, Math.max(0, Number(value) || 0));
}
