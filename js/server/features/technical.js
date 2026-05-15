import {
  alignReturnsByDate,
  annualizedVolatility,
  clamp,
  cleanRows,
  correlation,
  covariance,
  finite,
  latestReturn,
  maxDrawdown,
  mean,
  movingAverage,
  returns,
  round,
  sampleStd,
  zScore,
} from './math.js';

export function calculateTechnicalFeatures({ stockRows, spyRows = [], sectorRows = [] }) {
  const rows = cleanRows(stockRows);
  const latest = rows.at(-1);
  const closes = rows.map((row) => row.close);
  const volumes = rows.map((row) => row.volume);
  const stockDailyReturns = returns(rows, 1);
  const paired = alignReturnsByDate(rows, spyRows, 1).slice(-252);
  const spyReturns = paired.map((item) => item.benchmark);
  const assetReturns = paired.map((item) => item.stock);
  const spyVariance = sampleStd(spyReturns) ** 2;
  const beta = finite(spyVariance) && spyVariance > 0 ? covariance(assetReturns, spyReturns) / spyVariance : null;
  const sectorStrength = latestReturn(rows, 20) - (latestReturn(sectorRows, 20) ?? 0);
  const drawdown = maxDrawdown(rows.slice(-252));
  const ma50 = movingAverage(rows, 50);
  const ma200 = movingAverage(rows, 200);
  const volatility20 = annualizedVolatility(stockDailyReturns.slice(-20));
  const volatility60 = annualizedVolatility(stockDailyReturns.slice(-60));
  const volumeZ = zScore(volumes.at(-1), volumes.slice(-60));
  const gap = latest && rows.length > 1 ? latest.open / rows.at(-2).close - 1 : null;
  const rsi14 = rsi(closes, 14);
  const macdData = macd(closes);
  const bollinger = bollingerBands(closes, 20);
  const atr14 = atr(rows, 14);
  const momentumScore = scoreMomentum({
    return_5d: latestReturn(rows, 5),
    return_20d: latestReturn(rows, 20),
    return_60d: latestReturn(rows, 60),
    price_vs_ma50: latest && ma50 ? latest.close / ma50 - 1 : null,
    price_vs_ma200: latest && ma200 ? latest.close / ma200 - 1 : null,
  });
  const meanReversionScore = scoreMeanReversion({ rsi_14: rsi14, bollinger_position: bollinger.position });

  return {
    current_price: round(latest?.close, 4),
    return_1d: round(latestReturn(rows, 1), 6),
    return_5d: round(latestReturn(rows, 5), 6),
    return_10d: round(latestReturn(rows, 10), 6),
    return_20d: round(latestReturn(rows, 20), 6),
    return_60d: round(latestReturn(rows, 60), 6),
    ma_10: round(movingAverage(rows, 10), 4),
    ma_20: round(movingAverage(rows, 20), 4),
    ma_50: round(ma50, 4),
    ma_100: round(movingAverage(rows, 100), 4),
    ma_200: round(ma200, 4),
    price_vs_ma50: round(latest && ma50 ? latest.close / ma50 - 1 : null, 6),
    price_vs_ma200: round(latest && ma200 ? latest.close / ma200 - 1 : null, 6),
    rsi_14: round(rsi14, 4),
    macd: round(macdData.macd, 6),
    macd_signal: round(macdData.signal, 6),
    macd_histogram: round(macdData.histogram, 6),
    bollinger_upper: round(bollinger.upper, 4),
    bollinger_middle: round(bollinger.middle, 4),
    bollinger_lower: round(bollinger.lower, 4),
    bollinger_position: round(bollinger.position, 4),
    atr_14: round(atr14, 4),
    volatility_20d: round(volatility20, 6),
    volatility_60d: round(volatility60, 6),
    volume_change: round(rows.length > 1 && rows.at(-2).volume > 0 ? latest.volume / rows.at(-2).volume - 1 : null, 6),
    volume_z_score: round(volumeZ, 4),
    gap_pct: round(gap, 6),
    drawdown: round(drawdown, 6),
    beta_vs_spy: round(beta, 4),
    correlation_vs_spy: round(correlation(assetReturns, spyReturns), 4),
    sector_relative_strength: round(sectorStrength, 6),
    momentum_score: round(momentumScore, 4),
    mean_reversion_score: round(meanReversionScore, 4),
  };
}

function rsi(closes, periods = 14) {
  if (closes.length <= periods) return null;
  const changes = [];
  for (let index = 1; index < closes.length; index += 1) changes.push(closes[index] - closes[index - 1]);
  const sample = changes.slice(-periods);
  const gains = sample.map((value) => Math.max(0, value));
  const losses = sample.map((value) => Math.max(0, -value));
  const avgGain = mean(gains);
  const avgLoss = mean(losses);
  if (!finite(avgLoss) || avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  return 100 - 100 / (1 + rs);
}

function ema(values, periods) {
  if (values.length < periods) return [];
  const multiplier = 2 / (periods + 1);
  const output = [mean(values.slice(0, periods))];
  for (let index = periods; index < values.length; index += 1) {
    output.push((values[index] - output.at(-1)) * multiplier + output.at(-1));
  }
  return output;
}

function macd(closes) {
  const ema12 = ema(closes, 12);
  const ema26 = ema(closes, 26);
  if (!ema12.length || !ema26.length) return { macd: null, signal: null, histogram: null };
  const offset = ema12.length - ema26.length;
  const macdLine = ema26.map((value, index) => ema12[index + offset] - value);
  const signalLine = ema(macdLine, 9);
  const currentMacd = macdLine.at(-1);
  const currentSignal = signalLine.at(-1);
  return { macd: currentMacd, signal: currentSignal, histogram: finite(currentMacd) && finite(currentSignal) ? currentMacd - currentSignal : null };
}

function bollingerBands(closes, periods = 20) {
  if (closes.length < periods) return { upper: null, middle: null, lower: null, position: null };
  const sample = closes.slice(-periods);
  const middle = mean(sample);
  const std = sampleStd(sample);
  const upper = middle + 2 * std;
  const lower = middle - 2 * std;
  const position = upper === lower ? 0.5 : (closes.at(-1) - lower) / (upper - lower);
  return { upper, middle, lower, position };
}

function atr(rows, periods = 14) {
  const clean = cleanRows(rows);
  if (clean.length <= periods) return null;
  const ranges = [];
  for (let index = 1; index < clean.length; index += 1) {
    const current = clean[index];
    const previous = clean[index - 1];
    ranges.push(Math.max(current.high - current.low, Math.abs(current.high - previous.close), Math.abs(current.low - previous.close)));
  }
  return mean(ranges.slice(-periods));
}

function scoreMomentum(values) {
  const weighted =
    0.2 * clamp((values.return_5d ?? 0) / 0.05 + 0.5) +
    0.25 * clamp((values.return_20d ?? 0) / 0.12 + 0.5) +
    0.2 * clamp((values.return_60d ?? 0) / 0.25 + 0.5) +
    0.15 * clamp((values.price_vs_ma50 ?? 0) / 0.08 + 0.5) +
    0.2 * clamp((values.price_vs_ma200 ?? 0) / 0.2 + 0.5);
  return clamp(weighted);
}

function scoreMeanReversion({ rsi_14, bollinger_position }) {
  const rsiScore = finite(rsi_14) ? 1 - Math.abs(rsi_14 - 50) / 50 : 0.5;
  const bandScore = finite(bollinger_position) ? 1 - Math.abs(bollinger_position - 0.5) : 0.5;
  return clamp((rsiScore + bandScore) / 2);
}
