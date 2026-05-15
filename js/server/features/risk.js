import { clamp, finite, latestReturn, maxDrawdown, round } from './math.js';

export function calculateRiskFeatures({ technical, news, macro, stockRows = [], earnings = {} }) {
  const volatilityRisk = clamp(((technical.volatility_20d ?? 0.25) - 0.1) / 0.6);
  const betaRisk = clamp(((technical.beta_vs_spy ?? 1) - 0.6) / 1.4);
  const drawdownRisk = clamp(Math.abs(technical.drawdown ?? maxDrawdown(stockRows)) / 0.45);
  const gapRisk = clamp(Math.abs(technical.gap_pct ?? 0) / 0.08);
  const newsRisk = clamp(news.negative_news_ratio ?? 0);
  const earningsRisk = earnings.earnings_in_window ? 0.8 : earnings.days_to_earnings && earnings.days_to_earnings < 20 ? 0.45 : 0.2;
  const liquidityRisk = liquidityRiskFromRows(stockRows);
  const sectorVolRisk = clamp(((macro.vix_level ?? 18) - 12) / 28);
  const marketRegimeRisk = { bullish: 0.15, sideways: 0.35, volatile: 0.75, bearish: 0.7 }[macro.market_regime] ?? 0.4;

  const riskScore =
    0.2 * volatilityRisk +
    0.15 * betaRisk +
    0.15 * drawdownRisk +
    0.1 * gapRisk +
    0.12 * newsRisk +
    0.12 * earningsRisk +
    0.06 * liquidityRisk +
    0.05 * sectorVolRisk +
    0.05 * marketRegimeRisk;

  return {
    historical_volatility_risk: round(volatilityRisk, 4),
    beta_risk: round(betaRisk, 4),
    max_drawdown_risk: round(drawdownRisk, 4),
    recent_gap_risk: round(gapRisk, 4),
    negative_news_risk: round(newsRisk, 4),
    earnings_event_risk: round(earningsRisk, 4),
    liquidity_risk: round(liquidityRisk, 4),
    sector_volatility_risk: round(sectorVolRisk, 4),
    market_regime_risk: round(marketRegimeRisk, 4),
    risk_score: round(clamp(riskScore), 4),
    risk_label: riskScore < 0.33 ? 'low' : riskScore < 0.66 ? 'medium' : 'high',
  };
}

function liquidityRiskFromRows(rows) {
  const recent = rows.slice(-20);
  const avgDollarVolume = recent.reduce((total, row) => total + (row.close || 0) * (row.volume || 0), 0) / Math.max(1, recent.length);
  if (!finite(avgDollarVolume)) return 0.5;
  if (avgDollarVolume > 100_000_000) return 0.1;
  if (avgDollarVolume > 20_000_000) return 0.3;
  if (avgDollarVolume > 5_000_000) return 0.55;
  return 0.85;
}
