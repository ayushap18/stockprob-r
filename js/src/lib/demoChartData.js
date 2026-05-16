import { addDays, formatISO, subDays } from 'date-fns';
import { runMonteCarloSimulation } from './monteCarlo.js';

export function generateDemoPriceData(ticker = 'MSFT') {
  const rng = seeded(ticker);
  let close = 120 + rng() * 260;
  const start = subDays(new Date('2026-05-16T00:00:00Z'), 260);
  return Array.from({ length: 220 }, (_, index) => {
    const date = addDays(start, index);
    const drift = 0.0005 + (rng() - 0.5) * 0.004;
    const wave = Math.sin(index / 13) * 0.008;
    const previous = close;
    close = Math.max(5, close * (1 + drift + wave));
    const open = previous * (1 + (rng() - 0.5) * 0.01);
    const high = Math.max(open, close) * (1 + rng() * 0.018);
    const low = Math.min(open, close) * (1 - rng() * 0.018);
    return {
      time: isoDate(date),
      date: isoDate(date),
      open: round(open),
      high: round(high),
      low: round(low),
      close: round(close),
      volume: Math.round(2_000_000 + rng() * 18_000_000),
    };
  });
}

export function generateDemoSpyComparison(ticker = 'MSFT') {
  const prices = generateDemoPriceData(ticker);
  const rng = seeded(`${ticker}-spy`);
  let spy = 1;
  let stock = 1;
  return prices.map((row, index) => {
    stock = index ? stock * (1 + (row.close / prices[index - 1].close - 1)) : 1;
    spy *= 1 + 0.00035 + (rng() - 0.5) * 0.012;
    return { date: row.date, stockReturn: stock - 1, spyReturn: spy - 1, excessReturn: stock - spy };
  });
}

export function generateDemoProbabilityTrend(ticker = 'MSFT') {
  const rng = seeded(`${ticker}-prob`);
  const start = subDays(new Date('2026-05-16T00:00:00Z'), 90);
  let probability = 0.52 + (rng() - 0.5) * 0.12;
  return Array.from({ length: 90 }, (_, index) => {
    probability = clamp(probability + (rng() - 0.5) * 0.035 + Math.sin(index / 9) * 0.006, 0.22, 0.82);
    const expectedReturn = (probability - 0.5) * 0.08 + (rng() - 0.5) * 0.01;
    return {
      date: isoDate(addDays(start, index)),
      probability: round(probability, 4),
      expectedReturn: round(expectedReturn, 4),
      expectedExcessReturn: round(expectedReturn - 0.004 - (rng() - 0.5) * 0.006, 4),
      risk: round(clamp(0.35 + (rng() - 0.5) * 0.15), 4),
      confidence: round(clamp(0.52 + (probability - 0.5) * 0.35 + (rng() - 0.5) * 0.12), 4),
    };
  });
}

export function generateDemoMonteCarlo(ticker = 'MSFT') {
  const prices = generateDemoPriceData(ticker);
  const startPrice = prices.at(-1)?.close || 100;
  const simulation = runMonteCarloSimulation({
    startPrice,
    expectedReturnAnnual: 0.09,
    volatilityAnnual: 0.24,
    days: 20,
    simulations: 1200,
    seed: `${ticker}-mc`,
  });
  return { ...simulation, probabilityOutperformSpy: 0.57 };
}

export function generateDemoFeatureImportance(ticker = 'MSFT') {
  const rng = seeded(`${ticker}-features`);
  return ['20D Momentum', 'News Sentiment', 'Macro Score', 'RSI 14', 'Beta vs SPY', 'Volume Z-score', 'Fundamental Quality', 'Drawdown', 'Expected Excess']
    .map((feature, index) => ({ feature, importance: round((0.16 - index * 0.012) * (0.8 + rng() * 0.45), 4), impact: round((rng() - 0.35) * 0.22, 4) }));
}

export function generateDemoScores(ticker = 'MSFT') {
  const rng = seeded(`${ticker}-scores`);
  return {
    technical: round(0.55 + rng() * 0.28, 4),
    fundamental: round(0.45 + rng() * 0.3, 4),
    news: round(0.42 + rng() * 0.38, 4),
    macro: round(0.5 + rng() * 0.32, 4),
    alpha: round(0.48 + rng() * 0.28, 4),
    risk: round(0.22 + rng() * 0.4, 4),
    confidence: round(0.46 + rng() * 0.32, 4),
  };
}

export function generateDemoRankings() {
  const sectors = ['Technology', 'Healthcare', 'Financials', 'Consumer', 'Energy', 'Industrials'];
  return ['MSFT', 'AAPL', 'NVDA', 'AMZN', 'GOOGL', 'META', 'JPM', 'LLY', 'XOM', 'AVGO', 'COST', 'UNH'].map((ticker, index) => {
    const rng = seeded(`rank-${ticker}`);
    return {
      rank: index + 1,
      ticker,
      sector: sectors[index % sectors.length],
      probability: round(0.42 + rng() * 0.34, 4),
      expectedReturn: round((rng() - 0.35) * 0.08, 4),
      expectedExcessReturn: round((rng() - 0.4) * 0.06, 4),
      alphaScore: round(0.38 + rng() * 0.42, 4),
      risk: round(0.18 + rng() * 0.58, 4),
      confidence: round(0.38 + rng() * 0.44, 4),
      providerStatus: rng() > 0.25 ? 'ok' : 'degraded',
    };
  });
}

export function generateDemoBacktest() {
  const start = subDays(new Date('2026-05-16T00:00:00Z'), 180);
  let strategy = 1;
  let spy = 1;
  const equity = Array.from({ length: 120 }, (_, index) => {
    strategy *= 1 + 0.0008 + Math.sin(index / 12) * 0.002 + (index % 17 === 0 ? -0.006 : 0.001);
    spy *= 1 + 0.00045 + Math.sin(index / 15) * 0.0015;
    return { date: isoDate(addDays(start, index)), strategy, spy, cumulativeReturn: strategy - 1 };
  });
  const drawdown = equity.map((row, index) => {
    const peak = Math.max(...equity.slice(0, index + 1).map((point) => point.strategy));
    return { date: row.date, drawdown: row.strategy / peak - 1 };
  });
  return {
    equity,
    drawdown,
    metrics: { cagr: 0.124, sharpeRatio: 1.08, sortinoRatio: 1.46, maxDrawdown: -0.089, winRate: 0.57, profitFactor: 1.31 },
    calibration: Array.from({ length: 8 }, (_, index) => ({ bucket: `${index * 10}-${index * 10 + 10}%`, predicted: index / 10 + 0.05, realized: clamp(index / 10 + 0.02 + Math.sin(index) * 0.04) })),
    confidenceBuckets: ['Low', 'Medium', 'High', 'Very High'].map((bucket, index) => ({ bucket, hitRate: 0.48 + index * 0.06, averageReturn: -0.002 + index * 0.006 })),
  };
}

export function generateDemoProviderHealth() {
  return [
    { provider: 'Bloomberg', status: 'disconnected', latencyMs: null, fallbackCount: 1, warningCount: 1, lastRefresh: null },
    { provider: 'YFinance/Yahoo', status: 'fallback', latencyMs: 420, fallbackCount: 0, warningCount: 1, lastRefresh: 'live' },
    { provider: 'Alpha Vantage', status: 'ok', latencyMs: 880, fallbackCount: 0, warningCount: 0, lastRefresh: 'live' },
    { provider: 'FMP', status: 'ok', latencyMs: 610, fallbackCount: 0, warningCount: 0, lastRefresh: 'live' },
    { provider: 'FRED', status: 'ok', latencyMs: 340, fallbackCount: 0, warningCount: 0, lastRefresh: 'daily' },
  ];
}

export function generateDemoMacroRegime() {
  const start = subDays(new Date('2026-05-16T00:00:00Z'), 180);
  return Array.from({ length: 40 }, (_, index) => ({
    date: isoDate(addDays(start, index * 4)),
    fedFunds: 3.7 + Math.sin(index / 8) * 0.12,
    treasury10y: 4.35 + Math.sin(index / 6) * 0.25,
    treasury2y: 3.95 + Math.cos(index / 7) * 0.18,
    cpiYoY: 0.034 + Math.sin(index / 10) * 0.006,
    unemployment: 4.1 + Math.cos(index / 11) * 0.18,
    macroScore: clamp(0.62 + Math.sin(index / 8) * 0.18),
    regime: index % 9 > 6 ? 'volatile' : 'bullish',
  }));
}

function seeded(seedText) {
  let hash = 2166136261;
  for (const char of String(seedText)) {
    hash ^= char.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return () => {
    hash += 0x6d2b79f5;
    let value = hash;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function isoDate(date) {
  return formatISO(date, { representation: 'date' });
}

function clamp(value, min = 0, max = 1) {
  return Math.min(max, Math.max(min, Number(value) || 0));
}

function round(value, decimals = 2) {
  const factor = 10 ** decimals;
  return Math.round(Number(value) * factor) / factor;
}
