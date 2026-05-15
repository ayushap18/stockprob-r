import { clamp, finite, round } from './math.js';

export function calculateFundamentalFeatures(fundamentals = {}) {
  const growthScore = averageScores([
    scalePositive(fundamentals.revenue_growth_yoy, 0, 0.25),
    scalePositive(fundamentals.eps_growth_yoy, 0, 0.3),
    scalePositive(fundamentals.earnings_surprise, -0.05, 0.1),
    clamp((fundamentals.analyst_estimate_revision_score ?? 0) / 2 + 0.5),
  ]);
  const marginScore = averageScores([
    scalePositive(fundamentals.gross_margin, 0.2, 0.75),
    scalePositive(fundamentals.operating_margin, 0.05, 0.45),
    scalePositive(fundamentals.net_margin, 0.02, 0.35),
    scalePositive(fundamentals.free_cash_flow_margin, 0, 0.3),
  ]);
  const balanceSheetScore = averageScores([
    scaleInverse(fundamentals.debt_to_equity, 0, 2),
    scalePositive(fundamentals.current_ratio, 0.8, 2.5),
    scalePositive(fundamentals.return_on_equity, 0.05, 0.35),
    scalePositive(fundamentals.return_on_invested_capital, 0.04, 0.25),
  ]);
  const valuationScore = averageScores([
    scaleInverse(fundamentals.pe_ratio, 8, 60),
    scaleInverse(fundamentals.forward_pe_ratio, 8, 50),
    scaleInverse(fundamentals.peg_ratio, 0.5, 4),
    scaleInverse(fundamentals.price_to_sales, 1, 20),
    scaleInverse(fundamentals.price_to_book, 1, 18),
  ]);

  const fundamentalQualityScore = averageScores([
    growthScore * 1.15,
    marginScore * 1.1,
    balanceSheetScore,
    valuationScore * 0.8,
  ]);

  return {
    revenue_growth_yoy: nullable(fundamentals.revenue_growth_yoy),
    eps_growth_yoy: nullable(fundamentals.eps_growth_yoy),
    gross_margin: nullable(fundamentals.gross_margin),
    operating_margin: nullable(fundamentals.operating_margin),
    net_margin: nullable(fundamentals.net_margin),
    free_cash_flow_margin: nullable(fundamentals.free_cash_flow_margin),
    debt_to_equity: nullable(fundamentals.debt_to_equity),
    current_ratio: nullable(fundamentals.current_ratio),
    return_on_equity: nullable(fundamentals.return_on_equity),
    return_on_invested_capital: nullable(fundamentals.return_on_invested_capital),
    pe_ratio: nullable(fundamentals.pe_ratio),
    forward_pe_ratio: nullable(fundamentals.forward_pe_ratio),
    peg_ratio: nullable(fundamentals.peg_ratio),
    price_to_sales: nullable(fundamentals.price_to_sales),
    price_to_book: nullable(fundamentals.price_to_book),
    earnings_surprise: nullable(fundamentals.earnings_surprise),
    analyst_estimate_revision_score: nullable(fundamentals.analyst_estimate_revision_score),
    growth_score: round(growthScore, 4),
    margin_score: round(marginScore, 4),
    balance_sheet_score: round(balanceSheetScore, 4),
    valuation_score: round(valuationScore, 4),
    fundamental_quality_score: round(fundamentalQualityScore, 4),
  };
}

function averageScores(scores) {
  const sample = scores.filter(finite);
  if (!sample.length) return 0.5;
  return clamp(sample.reduce((total, value) => total + value, 0) / sample.length);
}

function scalePositive(value, low, high) {
  if (!finite(value)) return null;
  return clamp((Number(value) - low) / (high - low));
}

function scaleInverse(value, low, high) {
  if (!finite(value)) return null;
  return 1 - clamp((Number(value) - low) / (high - low));
}

function nullable(value) {
  return finite(value) ? Number(value) : null;
}
