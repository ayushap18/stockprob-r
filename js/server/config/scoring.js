export const DEFAULT_ALPHA_WEIGHTS = {
  momentum: 0.25,
  news: 0.2,
  fundamental: 0.2,
  volatility: 0.15,
  earnings: 0.1,
  macroSector: 0.1,
};

export const MODEL_WEIGHTS = {
  intercept: -0.12,
  momentum_score: 1.05,
  news_sentiment_score: 0.8,
  fundamental_quality_score: 0.7,
  macro_sector_score: 0.45,
  mean_reversion_score: 0.22,
  risk_score: -0.95,
  beta_vs_spy: -0.08,
  volatility_20d: -0.22,
};
