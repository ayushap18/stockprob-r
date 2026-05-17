import { generateDemoDashboardData } from './demoDashboardData.js';
import { normalizeBacktest, normalizeMacro, normalizeMonteCarlo, normalizePriceHistory, normalizeProviderHealth, normalizeRankings } from './normalizeChartData.js';

export function normalizeDashboardData(raw = {}, symbol = 'MSFT') {
  const demo = generateDemoDashboardData(symbol);
  const data = raw?.data || raw || {};
  const probabilities = data.probabilities || {};
  return {
    symbol: text(data.symbol, demo.symbol),
    quote: { ...demo.quote, ...(data.quote || {}) },
    company: { ...demo.company, ...(typeof data.company === 'object' ? data.company : { name: data.company }) },
    candles: normalizePriceHistory(data.candles || data.price || demo.candles),
    benchmark: Array.isArray(data.benchmark) ? data.benchmark : demo.benchmark,
    probabilities: {
      ...demo.probabilities,
      ...probabilities,
      probabilityOutperformSpy: clamp(probabilities.probabilityOutperformSpy ?? probabilities.probability_outperform_spy ?? demo.probabilities.probabilityOutperformSpy),
      expectedReturn: number(probabilities.expectedReturn ?? probabilities.expected_return ?? demo.probabilities.expectedReturn),
      expectedExcessReturn: number(probabilities.expectedExcessReturn ?? probabilities.expected_excess_return ?? demo.probabilities.expectedExcessReturn),
      riskScore: clamp(probabilities.riskScore ?? probabilities.risk_score ?? demo.probabilities.riskScore),
      confidence: clamp(probabilities.confidence ?? demo.probabilities.confidence),
    },
    probabilityHistory: Array.isArray(data.probabilityHistory) ? data.probabilityHistory : demo.probabilityHistory,
    expectedReturns: Array.isArray(data.expectedReturns) ? data.expectedReturns : demo.expectedReturns,
    scores: { ...demo.scores, ...(data.scores || {}) },
    monteCarlo: normalizeMonteCarlo(data.monteCarlo || demo.monteCarlo),
    features: Array.isArray(data.features) ? data.features : demo.features,
    fundamentals: { ...demo.fundamentals, ...(data.fundamentals || {}) },
    technicals: { ...demo.technicals, ...(data.technicals || {}) },
    news: Array.isArray(data.news) ? data.news : demo.news,
    sentiment: Array.isArray(data.sentiment) ? data.sentiment : demo.sentiment,
    filings: Array.isArray(data.filings) ? data.filings : demo.filings,
    insiders: Array.isArray(data.insiders) ? data.insiders : demo.insiders,
    macro: normalizeMacro(data.macro || demo.macro),
    rankings: normalizeRankings(data.rankings || demo.rankings),
    backtest: normalizeBacktest(data.backtest || demo.backtest),
    providerHealth: normalizeProviderHealth(data.providerHealth || demo.providerHealth),
    systemHealth: { ...demo.systemHealth, ...(data.systemHealth || {}) },
    memoryHealth: { ...demo.memoryHealth, ...(data.memoryHealth || {}) },
  };
}

export function mergeDashboardPatch(snapshot, message) {
  if (!message?.type) return snapshot;
  if (message.type === 'dashboard.patch') return normalizeDashboardData({ ...snapshot, ...message.data }, snapshot?.symbol);
  if (message.type === 'quote.update') return { ...snapshot, quote: { ...snapshot.quote, ...message.data } };
  if (message.type === 'probability.update') return { ...snapshot, probabilities: { ...snapshot.probabilities, ...message.data } };
  if (message.type === 'provider.health') return { ...snapshot, providerHealth: normalizeProviderHealth(message.data) };
  if (message.type === 'system.health') return { ...snapshot, systemHealth: { ...snapshot.systemHealth, ...message.data } };
  if (message.type === 'memory.health') return { ...snapshot, memoryHealth: { ...snapshot.memoryHealth, ...message.data } };
  return snapshot;
}

function text(value, fallback) {
  return value === null || value === undefined || value === '' ? fallback : String(value);
}

function number(value) {
  return Number.isFinite(Number(value)) ? Number(value) : 0;
}

function clamp(value) {
  return Math.min(1, Math.max(0, number(value)));
}
