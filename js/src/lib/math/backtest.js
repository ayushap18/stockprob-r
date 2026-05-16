import { maxDrawdown } from './risk.js';

export function walkForwardBacktest(rows = []) {
  return computeStrategyEquityCurve(rows);
}

export function computeHitRate(outcomes = []) {
  const sample = outcomes.filter((row) => typeof row.hit === 'boolean');
  return sample.length ? sample.filter((row) => row.hit).length / sample.length : null;
}

export function computeBrierScore(outcomes = []) {
  const sample = outcomes.filter((row) => Number.isFinite(Number(row.probability)) && Number.isFinite(Number(row.outcome)));
  return sample.length ? sample.reduce((sum, row) => sum + (Number(row.probability) - Number(row.outcome)) ** 2, 0) / sample.length : null;
}

export function computeCalibrationBins(outcomes = [], bins = 10) {
  return Array.from({ length: bins }, (_, index) => {
    const lower = index / bins;
    const upper = (index + 1) / bins;
    const sample = outcomes.filter((row) => row.probability >= lower && row.probability < upper);
    const realized = sample.length ? sample.reduce((sum, row) => sum + Number(row.outcome || 0), 0) / sample.length : null;
    return { bucket: `${Math.round(lower * 100)}-${Math.round(upper * 100)}%`, predicted: (lower + upper) / 2, realized, count: sample.length };
  });
}

export function computeStrategyEquityCurve(returns = []) {
  let equity = 1;
  return returns.map((row) => {
    equity *= 1 + Number(row.return || row.strategyReturn || 0);
    return { date: row.date, strategy: equity };
  });
}

export function computeDrawdownSeries(equity = []) {
  return equity.map((row, index) => ({ date: row.date, drawdown: maxDrawdown(equity.slice(0, index + 1).map((point) => point.strategy || point.equity || 1)) }));
}
