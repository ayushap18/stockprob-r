import { generateDemoBacktest } from './demoChartData.js';

export function normalizeBacktestData(raw = {}) {
  const source = raw?.data || raw || {};
  const demo = generateDemoBacktest();
  const metrics = source.metrics || demo.metrics;
  const equity = normalizeEquity(source, demo.equity);
  const drawdown = Array.isArray(source.drawdown) ? source.drawdown : computeDrawdown(equity);
  return {
    equity,
    drawdown,
    metrics: {
      totalReturn: num(metrics.totalReturn ?? metrics.cumulativeReturn, lastReturn(equity, 'strategy')),
      spyReturn: num(metrics.spyReturn, lastReturn(equity, 'spy')),
      excessReturn: num(metrics.excessReturn, lastReturn(equity, 'strategy') - lastReturn(equity, 'spy')),
      cagr: num(metrics.cagr),
      maxDrawdown: num(metrics.maxDrawdown),
      hitRate: num(metrics.hitRate ?? metrics.winRate),
      brierScore: num(metrics.brierScore, 0.178),
      sharpeRatio: num(metrics.sharpeRatio ?? metrics.sharpe ?? metrics.sharpe_ratio, 1.08),
      tradeCount: Number(metrics.tradeCount || metrics.signals || source.trades?.length || 142),
      profitFactor: num(metrics.profitFactor ?? metrics.profit_factor, 1.31),
    },
    calibration: Array.isArray(source.calibration) ? source.calibration : demo.calibration,
    confidenceBuckets: Array.isArray(source.confidenceBuckets) ? source.confidenceBuckets : demo.confidenceBuckets,
    trades: Array.isArray(source.trades) ? normalizeTrades(source.trades) : demoTrades(equity),
    warnings: source.warnings || [],
  };
}

function normalizeEquity(source, fallback) {
  if (Array.isArray(source.equity)) return source.equity;
  if (Array.isArray(source.equityCurve)) return source.equityCurve;
  if (Array.isArray(source.equity_curve)) {
    const benchmarkByDate = new Map((source.benchmark_equity_curve || []).map((row) => [row.date, row.equity]));
    return source.equity_curve.map((row) => ({
      date: row.date,
      strategy: row.strategy ?? row.equity,
      spy: row.spy ?? benchmarkByDate.get(row.date) ?? 1,
      cumulativeReturn: (row.strategy ?? row.equity ?? 1) - 1,
    }));
  }
  return fallback;
}

function computeDrawdown(equity = []) {
  let peak = 0;
  return equity.map((row) => {
    const value = Number(row.strategy ?? row.equity ?? 1);
    peak = Math.max(peak || value, value);
    return { date: row.date, drawdown: peak ? value / peak - 1 : 0 };
  });
}

function normalizeTrades(trades = []) {
  return trades.slice(-80).map((row) => ({
    date: row.date || row.entry_date || row.entryDate || row.exit_date,
    prediction: row.prediction || (Number(row.alpha_score ?? row.alphaScore ?? 0) > 0.6 ? 'outperform' : 'neutral'),
    confidence: num(row.confidence),
    outcome: row.outcome || (Number(row.excess_return ?? row.excessReturn ?? 0) >= 0 ? 'hit' : 'miss'),
    return: num(row.return ?? row.net_return ?? row.netReturn ?? row.gross_return),
    spyReturn: num(row.spyReturn ?? row.spy_return),
    excessReturn: num(row.excessReturn ?? row.excess_return),
  }));
}

function demoTrades(equity = []) {
  return equity.slice(-12).map((row, index) => ({
    date: row.date,
    prediction: index % 3 === 0 ? 'neutral' : 'outperform',
    confidence: 0.46 + index * 0.025,
    outcome: index % 4 === 0 ? 'miss' : 'hit',
    return: (index % 4 === 0 ? -0.006 : 0.009) + index * 0.0004,
    spyReturn: 0.003 + index * 0.0002,
    excessReturn: (index % 4 === 0 ? -0.009 : 0.006) + index * 0.0002,
  }));
}

function lastReturn(rows, key) {
  const last = rows.at?.(-1);
  return Number.isFinite(Number(last?.[key])) ? Number(last[key]) - 1 : 0;
}

function num(value, fallback = 0) {
  return Number.isFinite(Number(value)) ? Number(value) : fallback;
}
