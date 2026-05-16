export function probabilityOutperformSpy(stockReturns = [], spyReturns = []) {
  const n = Math.min(stockReturns.length, spyReturns.length);
  if (!n) return 0.5;
  let wins = 0;
  for (let index = 0; index < n; index += 1) {
    if (Number(stockReturns.at(-1 - index)) > Number(spyReturns.at(-1 - index))) wins += 1;
  }
  return wins / n;
}

export function probabilityProfit(returns = []) {
  const sample = returns.filter(finite).map(Number);
  return sample.length ? sample.filter((value) => value > 0).length / sample.length : 0.5;
}

export function probabilityLossGreaterThanThreshold(returns = [], threshold = 0.1) {
  const sample = returns.filter(finite).map(Number);
  return sample.length ? sample.filter((value) => value < -Math.abs(threshold)).length / sample.length : 0;
}

export function probabilityGainGreaterThanThreshold(returns = [], threshold = 0.2) {
  const sample = returns.filter(finite).map(Number);
  return sample.length ? sample.filter((value) => value > Math.abs(threshold)).length / sample.length : 0;
}

export function logisticProbabilityTransform(score, midpoint = 0.5, steepness = 6) {
  const x = Number(score) - midpoint;
  return 1 / (1 + Math.exp(-steepness * x));
}

export function confidenceScore({ sampleSize = 0, stale = false, providerWarnings = 0, isDemo = false, calibrationError = 0.03 } = {}) {
  let score = 0.45 + Math.min(0.25, Number(sampleSize) / 4000);
  if (stale) score -= 0.1;
  if (isDemo) score -= 0.18;
  score -= Math.min(0.18, Number(providerWarnings) * 0.035);
  score -= Math.min(0.16, Number(calibrationError) * 2);
  return clamp(score, 0.05, 0.95);
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, Number(value) || 0));
}

function finite(value) {
  return Number.isFinite(Number(value));
}
