export function classifyMacroRegime({ fedFundsTrend = 0, cpiYoY = 0, unemploymentTrend = 0, yieldCurve = 0 } = {}) {
  if (yieldCurve < -0.5 && unemploymentTrend > 0) return 'recession risk';
  if (cpiYoY > 0.04 && fedFundsTrend > 0) return 'high inflation';
  if (fedFundsTrend > 0.05) return 'tightening';
  if (fedFundsTrend < -0.05) return 'loosening';
  return 'neutral';
}

export function yieldCurveSpread(treasury10y, treasury2y) {
  return Number.isFinite(Number(treasury10y)) && Number.isFinite(Number(treasury2y)) ? Number(treasury10y) - Number(treasury2y) : null;
}

export function inflationTrendScore(values = []) {
  return trendScore(values, true);
}

export function rateRegimeScore(values = []) {
  return trendScore(values, false);
}

export function unemploymentTrendScore(values = []) {
  return trendScore(values, true);
}

function trendScore(values, lowerIsBetter) {
  const sample = values.filter((value) => Number.isFinite(Number(value))).map(Number);
  if (sample.length < 2) return 0.5;
  const trend = sample.at(-1) - sample[0];
  return Math.min(1, Math.max(0, 0.5 + (lowerIsBetter ? -trend : trend)));
}
