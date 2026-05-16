export function technicalScore(features = {}) {
  return score([features.momentum_20d, -features.volatility_20d, features.relative_strength_vs_spy], [0.45, 0.2, 0.35]);
}

export function fundamentalScore(features = {}) {
  return score([features.revenueGrowth, features.epsGrowth, features.roe, -features.debtToEquity], [0.25, 0.25, 0.3, 0.2]);
}

export function sentimentScore(features = {}) {
  return clamp(0.5 + Number(features.news_sentiment_7d || 0) * 0.35 + Math.min(0.12, Number(features.news_volume_7d || 0) / 100));
}

export function macroScore(features = {}) {
  return clamp(features.macro_regime_score ?? 0.5);
}

export function riskScore(features = {}) {
  return clamp(0.2 + Number(features.volatility_20d || 0) * 0.8 + Math.max(0, Number(features.filing_risk_phrase_score || 0)) * 0.3);
}

export function qualityScore(features = {}) {
  return clamp((fundamentalScore(features) + (1 - riskScore(features))) / 2);
}

export function momentumScore(features = {}) {
  return clamp(0.5 + Number(features.momentum_20d || 0) * 3 + Number(features.relative_strength_vs_spy || 0) * 2);
}

export function compositeAlphaScore(features = {}, weights = {}) {
  const w = { momentum: 0.25, news: 0.2, fundamental: 0.2, volatility: 0.15, earnings: 0.1, macro: 0.1, ...weights };
  return clamp(
    w.momentum * momentumScore(features)
      + w.news * sentimentScore(features)
      + w.fundamental * fundamentalScore(features)
      + w.volatility * (1 - riskScore(features))
      + w.earnings * 0.5
      + w.macro * macroScore(features)
      - Math.max(0, riskScore(features) - 0.65) * 0.2,
  );
}

function score(values, weights) {
  return clamp(values.reduce((sum, value, index) => sum + normalized(value) * weights[index], 0));
}

function normalized(value) {
  if (!Number.isFinite(Number(value))) return 0.5;
  return clamp(0.5 + Number(value));
}

function clamp(value) {
  return Math.min(1, Math.max(0, Number(value) || 0));
}
