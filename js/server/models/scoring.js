import { DEFAULT_ALPHA_WEIGHTS, MODEL_WEIGHTS } from '../config/scoring.js';
import { clamp, finite, round, sigmoid } from '../features/math.js';

export function calculateAlphaScore({ technical, fundamental, news, macro, risk, weights = DEFAULT_ALPHA_WEIGHTS }) {
  const volatilityScore = 1 - (risk.historical_volatility_risk ?? 0.5);
  const earningsScore = eventScore(news.event_tags);
  const score =
    weights.momentum * (technical.momentum_score ?? 0.5) +
    weights.news * (news.news_sentiment_score ?? 0.5) +
    weights.fundamental * (fundamental.fundamental_quality_score ?? 0.5) +
    weights.volatility * volatilityScore +
    weights.earnings * earningsScore +
    weights.macroSector * (macro.macro_sector_score ?? 0.5) -
    (risk.risk_score ?? 0.5) * 0.18;
  return round(clamp(score), 4);
}

export function logisticOutperformanceProbability({ technical, fundamental, news, macro, risk, alphaScore }) {
  const z =
    MODEL_WEIGHTS.intercept +
    MODEL_WEIGHTS.momentum_score * centered(technical.momentum_score) +
    MODEL_WEIGHTS.news_sentiment_score * centered(news.news_sentiment_score) +
    MODEL_WEIGHTS.fundamental_quality_score * centered(fundamental.fundamental_quality_score) +
    MODEL_WEIGHTS.macro_sector_score * centered(macro.macro_sector_score) +
    MODEL_WEIGHTS.mean_reversion_score * centered(technical.mean_reversion_score) +
    MODEL_WEIGHTS.risk_score * centered(risk.risk_score) +
    MODEL_WEIGHTS.beta_vs_spy * ((technical.beta_vs_spy ?? 1) - 1) +
    MODEL_WEIGHTS.volatility_20d * ((technical.volatility_20d ?? 0.25) - 0.25) +
    0.65 * centered(alphaScore);
  return round(clamp(sigmoid(z)), 4);
}

export function expectedReturns({ technical, macro, news, risk, probability, horizon }) {
  const momentumDrift = (technical.return_20d ?? 0) / 20;
  const spyDrift = (macro.spy_20d_return ?? 0) / 20;
  const sentimentDrift = ((news.news_sentiment_score ?? 0.5) - 0.5) * 0.004;
  const riskDrag = (risk.risk_score ?? 0.5) * 0.002;
  const expectedReturn = horizon * (0.35 * momentumDrift + 0.25 * spyDrift + sentimentDrift - riskDrag + (probability - 0.5) * 0.0015);
  const expectedSpyReturn = horizon * spyDrift;
  return {
    expected_return: round(expectedReturn, 6),
    expected_excess_return: round(expectedReturn - expectedSpyReturn, 6),
  };
}

export function confidenceScore({ providerStatus = {}, featureCompleteness, alphaScore, risk }) {
  const sourcePenalty = Object.values(providerStatus).filter((status) => ['failed', 'disconnected', 'degraded'].includes(status)).length * 0.05;
  const confidence = 0.35 + 0.35 * featureCompleteness + 0.2 * Math.abs((alphaScore ?? 0.5) - 0.5) * 2 - 0.1 * (risk.risk_score ?? 0.5) - sourcePenalty;
  return round(clamp(confidence), 4);
}

export function signalFor({ probability, expectedExcessReturn, riskScore, confidence }) {
  if (riskScore >= 0.72 && confidence < 0.58) return 'avoid';
  if (probability >= 0.62 && expectedExcessReturn > 0 && riskScore < 0.68) return confidence >= 0.62 ? 'bullish' : 'watchlist';
  if (probability <= 0.42 || expectedExcessReturn < -0.01) return riskScore > 0.6 ? 'avoid' : 'bearish';
  if (probability >= 0.55 && expectedExcessReturn > 0) return 'watchlist';
  return 'neutral';
}

export function topDrivers({ technical, fundamental, news, macro, risk, probability }) {
  const candidates = [
    [technical.momentum_score, 'Strong 20-day momentum'],
    [technical.volume_z_score > 0.8 ? 0.7 : 0.3, 'Above-average volume confirmation'],
    [fundamental.fundamental_quality_score, 'Strong fundamental quality score'],
    [news.news_sentiment_score, 'Positive recent news sentiment'],
    [macro.macro_sector_score, 'Supportive macro and sector context'],
    [1 - risk.risk_score, 'Moderate risk level'],
    [probability, 'Model probability favors outperformance versus SPY'],
  ];
  return candidates
    .filter(([score]) => finite(score))
    .sort((first, second) => second[0] - first[0])
    .slice(0, 5)
    .map(([, label]) => label);
}

export function featureImportance({ technical, fundamental, news, macro, risk }) {
  return [
    { feature: 'momentum_score', value: technical.momentum_score, importance: 0.25 },
    { feature: 'news_sentiment_score', value: news.news_sentiment_score, importance: 0.2 },
    { feature: 'fundamental_quality_score', value: fundamental.fundamental_quality_score, importance: 0.2 },
    { feature: 'risk_score', value: risk.risk_score, importance: 0.18 },
    { feature: 'macro_sector_score', value: macro.macro_sector_score, importance: 0.1 },
    { feature: 'mean_reversion_score', value: technical.mean_reversion_score, importance: 0.07 },
  ];
}

function centered(value) {
  return (finite(value) ? Number(value) : 0.5) - 0.5;
}

function eventScore(tags = []) {
  if (tags.includes('earnings_beat') || tags.includes('guidance_raise') || tags.includes('analyst_upgrade')) return 0.75;
  if (tags.includes('earnings_miss') || tags.includes('guidance_cut') || tags.includes('analyst_downgrade')) return 0.25;
  return 0.5;
}
