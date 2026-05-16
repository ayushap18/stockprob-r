export function calculateDerivedFeatures({ symbol, prices = [], spy = [], news = [], filings = [], insiders = [], macro = {}, options = {} } = {}) {
  const last = prices.at(-1);
  const prev20 = prices.at(-21);
  const momentum20d = last && prev20 ? last.close / prev20.close - 1 : null;
  const returns20 = rollingReturns(prices).slice(-20);
  const spyReturns20 = rollingReturns(spy).slice(-20);
  return {
    symbol,
    insider_net_buy_value_30d: sum(insiders.map((row) => row.netValue30d)),
    insider_transaction_count_30d: insiders.length,
    filing_recency_days: filings.at(0)?.filed_at ? daysSince(filings.at(0).filed_at) : null,
    filing_risk_phrase_score: scoreRiskPhrases(filings.map((row) => row.text).join(' ')),
    news_sentiment_1d: average(news.filter((row) => daysSince(row.published_at) <= 1).map((row) => row.sentiment)),
    news_sentiment_7d: average(news.filter((row) => daysSince(row.published_at) <= 7).map((row) => row.sentiment)),
    news_volume_7d: news.filter((row) => daysSince(row.published_at) <= 7).length,
    earnings_proximity_days: null,
    momentum_20d: finite(momentum20d) ? momentum20d : null,
    volatility_20d: std(returns20) * Math.sqrt(252),
    beta_to_spy: beta(returns20, spyReturns20),
    relative_strength_vs_spy: finite(momentum20d) && spy.length > 21 ? momentum20d - (spy.at(-1).close / spy.at(-21).close - 1) : null,
    macro_regime_score: macro.macroScore ?? macro.macro_sector_score ?? null,
    options_implied_move: options.impliedMove ?? null,
    options_skew_score: options.skewScore ?? null,
  };
}

function rollingReturns(rows) {
  return rows.slice(1).map((row, index) => rows[index]?.close ? row.close / rows[index].close - 1 : null).filter(finite);
}

function beta(a, b) {
  if (a.length < 2 || b.length < 2) return null;
  const n = Math.min(a.length, b.length);
  const x = a.slice(-n);
  const y = b.slice(-n);
  const ym = average(y);
  const variance = average(y.map((value) => (value - ym) ** 2));
  if (!variance) return null;
  const xm = average(x);
  return average(x.map((value, index) => (value - xm) * (y[index] - ym))) / variance;
}

function scoreRiskPhrases(text) {
  if (!text) return 0;
  const matches = String(text).match(/\b(investigation|restatement|going concern|material weakness|subpoena|litigation)\b/gi) || [];
  return Math.min(1, matches.length / 8);
}

function daysSince(value) {
  if (!value) return Infinity;
  return Math.max(0, (Date.now() - new Date(value).getTime()) / 86_400_000);
}

function average(values) {
  const sample = values.filter(finite).map(Number);
  return sample.length ? sample.reduce((sum, value) => sum + value, 0) / sample.length : null;
}

function sum(values) {
  return values.filter(finite).map(Number).reduce((total, value) => total + value, 0);
}

function std(values) {
  const sample = values.filter(finite).map(Number);
  if (sample.length < 2) return null;
  const mean = average(sample);
  return Math.sqrt(average(sample.map((value) => (value - mean) ** 2)));
}

function finite(value) {
  return Number.isFinite(Number(value));
}
