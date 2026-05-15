import { annualizedVolatility, clamp, correlation, maxDrawdown, mean, round, sampleStd } from '../features/math.js';

export function calculateBacktestMetrics({ trades, equityCurve, benchmarkReturns = [] }) {
  const returns = trades.map((trade) => trade.net_return);
  const wins = returns.filter((value) => value > 0);
  const losses = returns.filter((value) => value < 0);
  const avgReturn = mean(returns) ?? 0;
  const std = sampleStd(returns) ?? 0;
  const sharpe = std ? (avgReturn / std) * Math.sqrt(252 / Math.max(1, averageHoldingDays(trades))) : 0;
  const downside = sampleStd(returns.filter((value) => value < 0)) ?? 0;
  const sortino = downside ? (avgReturn / downside) * Math.sqrt(252 / Math.max(1, averageHoldingDays(trades))) : 0;
  const totalReturn = equityCurve.length ? equityCurve.at(-1).equity - 1 : 0;
  const years = Math.max(1 / 252, trades.length ? (trades.at(-1).exit_index - trades[0].entry_index) / 252 : 1 / 252);
  const cagr = (1 + totalReturn) ** (1 / years) - 1;
  const beta = benchmarkReturns.length && sampleStd(benchmarkReturns) ? correlation(returns.slice(-benchmarkReturns.length), benchmarkReturns) * ((sampleStd(returns) ?? 0) / sampleStd(benchmarkReturns)) : null;
  const benchmarkTotal = benchmarkReturns.reduce((equity, value) => equity * (1 + value), 1) - 1;

  return {
    cagr: round(cagr, 6),
    sharpe_ratio: round(sharpe, 6),
    sortino_ratio: round(sortino, 6),
    max_drawdown: round(maxDrawdown(equityCurve.map((point) => ({ date: point.date, close: point.equity }))), 6),
    win_rate: round(returns.length ? wins.length / returns.length : 0, 6),
    average_return_per_trade: round(avgReturn, 6),
    profit_factor: round(Math.abs(wins.reduce((total, value) => total + value, 0) / Math.min(-1e-9, losses.reduce((total, value) => total + value, 0))), 6),
    alpha_vs_spy: round(totalReturn - benchmarkTotal, 6),
    beta_vs_spy: round(beta, 6),
    information_ratio: round(sampleStd(returns.map((value, index) => value - (benchmarkReturns[index] ?? 0))) ? mean(returns.map((value, index) => value - (benchmarkReturns[index] ?? 0))) / sampleStd(returns.map((value, index) => value - (benchmarkReturns[index] ?? 0))) : 0, 6),
    turnover: round(trades.length / Math.max(1, equityCurve.length), 6),
    hit_rate_by_confidence_bucket: confidenceBuckets(trades),
    performance_by_market_regime: performanceByRegime(trades),
  };
}

function averageHoldingDays(trades) {
  return mean(trades.map((trade) => trade.exit_index - trade.entry_index)) ?? 1;
}

function confidenceBuckets(trades) {
  const buckets = { low: [], medium: [], high: [] };
  for (const trade of trades) {
    const confidence = trade.confidence ?? 0.5;
    const key = confidence < 0.45 ? 'low' : confidence < 0.65 ? 'medium' : 'high';
    buckets[key].push(trade.net_return > 0 ? 1 : 0);
  }
  return Object.fromEntries(Object.entries(buckets).map(([key, values]) => [key, round(values.length ? mean(values) : 0, 6)]));
}

function performanceByRegime(trades) {
  const grouped = {};
  for (const trade of trades) {
    const regime = trade.market_regime || 'unknown';
    grouped[regime] ||= [];
    grouped[regime].push(trade.net_return);
  }
  return Object.fromEntries(Object.entries(grouped).map(([key, values]) => [key, round(mean(values), 6)]));
}
