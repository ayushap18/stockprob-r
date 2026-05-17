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
  demoAnchorDate,
} from './demoChartData.js';

const PROFILES = {
  AAPL: { name: 'Apple Inc.', sector: 'Technology', industry: 'Consumer Electronics', exchange: 'NASDAQ' },
  MSFT: { name: 'Microsoft Corporation', sector: 'Technology', industry: 'Software - Infrastructure', exchange: 'NASDAQ' },
  NVDA: { name: 'NVIDIA Corporation', sector: 'Technology', industry: 'Semiconductors', exchange: 'NASDAQ' },
  TSLA: { name: 'Tesla, Inc.', sector: 'Consumer Cyclical', industry: 'Auto Manufacturers', exchange: 'NASDAQ' },
};

export function generateDemoDashboardData(symbol = 'MSFT') {
  const ticker = String(symbol || 'MSFT').toUpperCase();
  const candles = generateDemoPriceData(ticker);
  const last = candles.at(-1);
  const prev = candles.at(-2) || last;
  const scores = generateDemoScores(ticker);
  const probabilityHistory = generateDemoProbabilityTrend(ticker);
  const profile = PROFILES[ticker] || { name: `${ticker} Corporation`, sector: 'Unknown', industry: 'US listed security', exchange: 'US' };
  return {
    symbol: ticker,
    company: profile,
    quote: {
      symbol: ticker,
      price: last.close,
      change: last.close - prev.close,
      changePercent: prev.close ? ((last.close - prev.close) / prev.close) * 100 : 0,
      volume: last.volume,
      marketState: marketState(),
      asOf: new Date().toISOString(),
    },
    candles,
    benchmark: generateDemoSpyComparison(ticker),
    probabilities: {
      symbol: ticker,
      horizonDays: 5,
      probabilityOutperformSpy: probabilityHistory.at(-1)?.probability ?? 0.58,
      probabilityProfit: 0.54,
      probabilityLossGt10: 0.12,
      expectedReturn: probabilityHistory.at(-1)?.expectedReturn ?? 0.01,
      expectedExcessReturn: probabilityHistory.at(-1)?.expectedExcessReturn ?? 0.004,
      riskScore: scores.risk,
      qualityScore: scores.fundamental,
      momentumScore: scores.technical,
      confidence: scores.confidence,
      modelVersion: 'demo-baseline-v1',
    },
    probabilityHistory,
    expectedReturns: probabilityHistory,
    scores,
    monteCarlo: generateDemoMonteCarlo(ticker),
    features: generateDemoFeatureImportance(ticker),
    fundamentals: { revenueGrowth: 0.08, epsGrowth: 0.06, grossMargin: 0.58, roe: 0.24, roic: 0.18, debtToEquity: 0.42 },
    technicals: { momentum_20d: 0.04, volatility_20d: 0.22, beta_to_spy: 1.02, relative_strength_vs_spy: 0.018 },
    news: demoNews(ticker),
    sentiment: probabilityHistory.slice(-30).map((row) => ({ date: row.date, sentiment: row.probability - 0.5, volume: 2 })),
    filings: [{ type: '10-Q', filedAt: isoOffsetDate(-21), filingRecencyDays: 21, riskPhraseScore: 0.08 }],
    insiders: [{ direction: 'neutral', transactionCount30d: 0, netBuyValue30d: 0 }],
    macro: generateDemoMacroRegime(),
    rankings: generateDemoRankings(),
    backtest: generateDemoBacktest(),
    providerHealth: generateDemoProviderHealth(),
    systemHealth: { status: 'degraded', db: 'unknown', redis: 'unknown', queueDepth: 0, activeJobs: 0, errorCount24h: 0 },
    memoryHealth: { cacheEntries: 0, activeSubscriptions: 0, activePollingLoops: 0, activeInFlightRequests: 0, warnings: [] },
  };
}

function demoNews(symbol) {
  return [
    { title: `${symbol} fallback news score uses deterministic neutral baseline`, source: 'demo', sentiment: 0, publishedAt: isoOffsetDateTime(0), eventType: 'provider_fallback' },
    { title: `${symbol} model includes price, benchmark, macro and risk features`, source: 'demo', sentiment: 0.2, publishedAt: isoOffsetDateTime(-1), eventType: 'model_context' },
  ];
}

function isoOffsetDate(offsetDays) {
  const date = demoAnchorDate();
  date.setUTCDate(date.getUTCDate() + offsetDays);
  return date.toISOString().slice(0, 10);
}

function isoOffsetDateTime(offsetDays) {
  const date = demoAnchorDate();
  date.setUTCDate(date.getUTCDate() + offsetDays);
  return date.toISOString();
}

function marketState() {
  const now = new Date();
  const day = now.getUTCDay();
  const minutes = now.getUTCHours() * 60 + now.getUTCMinutes();
  if (day === 0 || day === 6) return 'closed';
  if (minutes >= 13 * 60 + 30 && minutes <= 20 * 60) return 'open';
  if (minutes < 13 * 60 + 30) return 'pre';
  return 'post';
}
