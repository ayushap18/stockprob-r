export function volatility(returns = []) {
  return std(returns) * Math.sqrt(252);
}

export function maxDrawdown(values = []) {
  let peak = values[0] || 1;
  let drawdown = 0;
  for (const value of values.filter(finite).map(Number)) {
    peak = Math.max(peak, value);
    drawdown = Math.min(drawdown, peak ? value / peak - 1 : 0);
  }
  return drawdown;
}

export function downsideDeviation(returns = [], threshold = 0) {
  const downside = returns.filter((value) => finite(value) && Number(value) < threshold).map((value) => (Number(value) - threshold) ** 2);
  return downside.length ? Math.sqrt(mean(downside)) * Math.sqrt(252) : 0;
}

export function valueAtRisk(returns = [], percentile = 0.05) {
  const sorted = returns.filter(finite).map(Number).sort((a, b) => a - b);
  if (!sorted.length) return null;
  return sorted[Math.max(0, Math.min(sorted.length - 1, Math.floor(sorted.length * percentile)))];
}

export function expectedShortfall(returns = [], percentile = 0.05) {
  const varValue = valueAtRisk(returns, percentile);
  if (varValue === null) return null;
  const tail = returns.filter((value) => finite(value) && Number(value) <= varValue).map(Number);
  return tail.length ? mean(tail) : varValue;
}

export function sharpeLikeScore(returns = [], riskFreeDaily = 0) {
  const excess = returns.filter(finite).map((value) => Number(value) - riskFreeDaily);
  const sigma = std(excess);
  return sigma ? (mean(excess) / sigma) * Math.sqrt(252) : null;
}

function mean(values) {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
}

function std(values) {
  const sample = values.filter(finite).map(Number);
  const avg = mean(sample);
  return sample.length > 1 ? Math.sqrt(mean(sample.map((value) => (value - avg) ** 2))) : 0;
}

function finite(value) {
  return Number.isFinite(Number(value));
}
