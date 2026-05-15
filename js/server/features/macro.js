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
  const riskOnScore = clamp(
    0.35 * ((spy20 ?? 0) / 0.08 + 0.5) +
      0.25 * ((qqq20 ?? 0) / 0.1 + 0.5) +
      0.2 * (1 - clamp(((vixLevel ?? 20) - 12) / 25)) +
      0.1 * (1 - clamp(((vixChange ?? 0) + 0.2) / 0.4)) +
      0.1 * clamp((sectorVsSpy ?? 0) / 0.08 + 0.5)
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
    treasury_10y_change: round(macro.treasury_10y_change, 6),
    dollar_index_trend: round(macro.dollar_index_trend, 6),
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
