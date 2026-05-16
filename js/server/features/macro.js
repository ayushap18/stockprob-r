import { clamp, latestReturn, round } from './math.js';

const SECTOR_ETFS = {
  technology: 'XLK',
  financials: 'XLF',
  healthcare: 'XLV',
  'consumer discretionary': 'XLY',
  'communication services': 'XLC',
  industrials: 'XLI',
  staples: 'XLP',
  energy: 'XLE',
  utilities: 'XLU',
  materials: 'XLB',
  'real estate': 'XLRE',
};

export function calculateMacroFeatures({ spyRows = [], qqqRows = [], vixRows = [], sectorRows = [], macro = {}, sector = 'technology' }) {
  const spy5 = latestReturn(spyRows, 5);
  const spy20 = latestReturn(spyRows, 20);
  const qqq5 = latestReturn(qqqRows, 5);
  const qqq20 = latestReturn(qqqRows, 20);
  const vixLevel = vixRows.at(-1)?.close ?? null;
  const vixChange = latestReturn(vixRows, 5);
  const sectorReturn20 = latestReturn(sectorRows, 20);
  const sectorVsSpy = (sectorReturn20 ?? 0) - (spy20 ?? 0);
  const ratesScore = clamp(0.5 - ((macro.treasury_10y_change ?? 0) / 0.015));
  const dollarScore = clamp(0.5 - ((macro.dollar_index_trend ?? 0) / 0.08));
  const curveScore = macro.yield_curve_spread === null || macro.yield_curve_spread === undefined ? 0.5 : clamp(macro.yield_curve_spread / 2 + 0.5);
  const riskOnScore = clamp(
    0.28 * ((spy20 ?? 0) / 0.08 + 0.5) +
      0.2 * ((qqq20 ?? 0) / 0.1 + 0.5) +
      0.18 * (1 - clamp(((vixLevel ?? 20) - 12) / 25)) +
      0.1 * (1 - clamp(((vixChange ?? 0) + 0.2) / 0.4)) +
      0.1 * clamp((sectorVsSpy ?? 0) / 0.08 + 0.5) +
      0.06 * ratesScore +
      0.04 * dollarScore +
      0.04 * curveScore
  );
  const regime = classifyMarketRegime({ spy20, qqq20, vixLevel, vixChange });
  const sectorMomentumRank = clamp((sectorVsSpy ?? 0) / 0.1 + 0.5);

  return {
    spy_5d_return: round(spy5, 6),
    spy_20d_return: round(spy20, 6),
    qqq_5d_return: round(qqq5, 6),
    qqq_20d_return: round(qqq20, 6),
    vix_level: round(vixLevel, 4),
    vix_change: round(vixChange, 6),
    fed_funds_rate: round(macro.fed_funds_rate, 4),
    treasury_10y: round(macro.treasury_10y, 4),
    treasury_2y: round(macro.treasury_2y, 4),
    yield_curve_spread: round(macro.yield_curve_spread, 4),
    treasury_10y_change: round(macro.treasury_10y_change, 6),
    cpi_yoy: round(macro.cpi_yoy, 6),
    unemployment_rate: round(macro.unemployment_rate, 4),
    unemployment_6m_change: round(macro.unemployment_6m_change, 4),
    dollar_index_trend: round(macro.dollar_index_trend, 6),
    fred_as_of: macro.fred_as_of ?? null,
    fred_pulled_at: macro.fred_pulled_at ?? null,
    sector_etf: SECTOR_ETFS[String(sector).toLowerCase()] ?? 'XLK',
    sector_etf_return: round(sectorReturn20, 6),
    sector_etf_momentum_rank: round(sectorMomentumRank, 4),
    risk_on_risk_off_score: round(riskOnScore, 4),
    market_regime: regime,
    macro_sector_score: round(riskOnScore, 4),
  };
}

function classifyMarketRegime({ spy20, qqq20, vixLevel, vixChange }) {
  if ((vixLevel ?? 0) >= 28 || (vixChange ?? 0) > 0.25) return 'volatile';
  if ((spy20 ?? 0) > 0.02 && (qqq20 ?? 0) > 0.02 && (vixLevel ?? 30) < 22) return 'bullish';
  if ((spy20 ?? 0) < -0.04 && (qqq20 ?? 0) < -0.04) return 'bearish';
  return 'sideways';
}
