import pLimit from 'p-limit';
import {
  generateDemoBacktest,
  generateDemoFeatureImportance,
  generateDemoMacroRegime,
  generateDemoMonteCarlo,
  generateDemoPriceData,
  generateDemoProbabilityTrend,
  generateDemoProviderHealth,
  generateDemoRankings,
  generateDemoScores,
  generateDemoSpyComparison,
} from './demoChartData.js';
import {
  normalizeBacktest,
  normalizeFeatureAnalysis,
  normalizeMacro,
  normalizeMonteCarlo,
  normalizePrediction,
  normalizePriceHistory,
  normalizeProviderHealth,
  normalizeRankings,
} from './normalizeChartData.js';

const limit = pLimit(4);

export async function fetchPredictionDashboard(ticker) {
  return withFallback({
    source: '/api/outperform',
    task: async () => normalizePrediction(await json(`/api/outperform?ticker=${encodeURIComponent(ticker)}&horizon=5`)),
    fallback: () => {
      const scores = generateDemoScores(ticker);
      return {
        ticker,
        probability: 0.63,
        expectedReturn: 0.001,
        expectedExcessReturn: -0.01,
        riskScore: scores.risk,
        riskLabel: 'low',
        confidence: scores.confidence,
        signal: 'neutral',
        technicalScore: scores.technical,
        fundamentalScore: scores.fundamental,
        newsScore: scores.news,
        macroScore: scores.macro,
        alphaScore: scores.alpha,
        featureImportance: generateDemoFeatureImportance(ticker),
        features: {},
        providerStatus: {},
        warnings: ['Demo fallback prediction shown because backend prediction endpoint failed'],
      };
    },
  });
}

export async function fetchPriceHistory(ticker) {
  return withFallback({
    source: '/api/price',
    task: async () => normalizePriceHistory(await json(`/api/price?ticker=${encodeURIComponent(ticker)}&limit=520`)),
    fallback: () => generateDemoPriceData(ticker),
  });
}

export async function fetchSpyComparison(ticker) {
  const [stock, spy] = await Promise.all([fetchPriceHistory(ticker), fetchPriceHistory('SPY')]);
  if (!stock.isDemo && !spy.isDemo && stock.data.length && spy.data.length) {
    return { data: cumulativeCompare(stock.data, spy.data), isDemo: false, source: '/api/price', warnings: [...stock.warnings, ...spy.warnings] };
  }
  return { data: generateDemoSpyComparison(ticker), isDemo: true, source: 'deterministic-demo', warnings: ['SPY comparison uses deterministic fallback data'] };
}

export async function fetchMonteCarlo(ticker) {
  return withFallback({
    source: 'client-gbm',
    task: async () => normalizeMonteCarlo(generateDemoMonteCarlo(ticker)),
    fallback: () => generateDemoMonteCarlo(ticker),
  });
}

export async function fetchFeatureAnalysis(ticker) {
  const prediction = await fetchPredictionDashboard(ticker);
  return {
    data: prediction.data.featureImportance?.length ? prediction.data.featureImportance : generateDemoFeatureImportance(ticker),
    isDemo: prediction.isDemo || !prediction.data.featureImportance?.length,
    source: prediction.source,
    warnings: prediction.warnings,
  };
}

export async function fetchRankings() {
  return withFallback({
    source: '/api/rank',
    task: async () => normalizeRankings(await json('/api/rank?tickers=MSFT,AAPL,NVDA,AMZN,GOOGL,META,JPM,LLY,XOM,AVGO,COST,UNH&horizon=5')),
    fallback: generateDemoRankings,
  });
}

export async function fetchBacktest(ticker) {
  return withFallback({
    source: '/api/backtest',
    task: async () => normalizeBacktest(await json(`/api/backtest?universe=${encodeURIComponent([ticker, 'SPY', 'QQQ'].join(','))}&horizon=5`)),
    fallback: generateDemoBacktest,
  });
}

export async function fetchProviderHealth() {
  return withFallback({
    source: '/api/health',
    task: async () => normalizeProviderHealth(await json('/api/health')),
    fallback: generateDemoProviderHealth,
  });
}

export async function fetchMacroRegime() {
  return withFallback({
    source: 'macro-derived-demo',
    task: async () => normalizeMacro(generateDemoMacroRegime()),
    fallback: generateDemoMacroRegime,
  });
}

export async function loadAnalyticsBundle(ticker) {
  const [prediction, price, comparison, monteCarlo, features, rankings, backtest, providerHealth, macro] = await Promise.all([
    limit(() => fetchPredictionDashboard(ticker)),
    limit(() => fetchPriceHistory(ticker)),
    limit(() => fetchSpyComparison(ticker)),
    limit(() => fetchMonteCarlo(ticker)),
    limit(() => fetchFeatureAnalysis(ticker)),
    limit(fetchRankings),
    limit(() => fetchBacktest(ticker)),
    limit(fetchProviderHealth),
    limit(fetchMacroRegime),
  ]);
  return { prediction, price, comparison, monteCarlo, features, rankings, backtest, providerHealth, macro };
}

async function withFallback({ source, task, fallback }) {
  try {
    const data = await task();
    if (incomplete(data)) throw new Error('Incomplete chart payload');
    return { data, isDemo: false, source, warnings: [] };
  } catch (error) {
    return { data: fallback(), isDemo: true, source: 'deterministic-demo', warnings: [error.message || `${source} unavailable`] };
  }
}

async function json(url) {
  const response = await fetch(url);
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || payload.error) throw new Error(payload.message || payload.error || `HTTP ${response.status}`);
  return payload;
}

function incomplete(value) {
  if (Array.isArray(value)) return value.length === 0;
  return value === null || value === undefined || (typeof value === 'object' && !Object.keys(value).length);
}

function cumulativeCompare(stockRows, spyRows) {
  const spyByDate = new Map(spyRows.map((row) => [row.date, row]));
  let stockBase = null;
  let spyBase = null;
  return stockRows
    .map((row) => {
      const spy = spyByDate.get(row.date);
      if (!spy) return null;
      stockBase ??= row.close;
      spyBase ??= spy.close;
      const stockReturn = row.close / stockBase - 1;
      const spyReturn = spy.close / spyBase - 1;
      return { date: row.date, stockReturn, spyReturn, excessReturn: stockReturn - spyReturn };
    })
    .filter(Boolean);
}
