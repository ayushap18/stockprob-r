import { returnSeries } from './returns.js';

export function SMA(values = [], window = 20) {
  return rolling(values, window, (sample) => mean(sample));
}

export function EMA(values = [], window = 20) {
  const alpha = 2 / (window + 1);
  let previous = null;
  return values.map((value) => {
    const current = Number(value);
    if (!Number.isFinite(current)) return previous;
    previous = previous === null ? current : alpha * current + (1 - alpha) * previous;
    return previous;
  });
}

export function RSI(values = [], window = 14) {
  const changes = values.slice(1).map((value, index) => Number(value) - Number(values[index]));
  return values.map((_, index) => {
    if (index < window) return null;
    const sample = changes.slice(index - window, index);
    const gains = sample.filter((value) => value > 0);
    const losses = sample.filter((value) => value < 0).map(Math.abs);
    const avgGain = mean(gains) || 0;
    const avgLoss = mean(losses) || 0;
    if (!avgLoss) return 100;
    return 100 - (100 / (1 + avgGain / avgLoss));
  });
}

export function ATR(rows = [], window = 14) {
  const trueRanges = rows.map((row, index) => {
    const previousClose = rows[index - 1]?.close ?? row.close;
    return Math.max(row.high - row.low, Math.abs(row.high - previousClose), Math.abs(row.low - previousClose));
  });
  return SMA(trueRanges, window);
}

export function MACD(values = [], fast = 12, slow = 26, signal = 9) {
  const fastEma = EMA(values, fast);
  const slowEma = EMA(values, slow);
  const macd = values.map((_, index) => {
    const fastValue = fastEma[index];
    const slowValue = slowEma[index];
    return finite(fastValue) && finite(slowValue) ? fastValue - slowValue : null;
  });
  const signalLine = EMA(macd, signal);
  const histogram = macd.map((value, index) => (finite(value) && finite(signalLine[index]) ? value - signalLine[index] : null));
  return { macd, signal: signalLine, histogram };
}

export function BollingerBands(values = [], window = 20, deviations = 2) {
  return values.map((_, index) => {
    if (index + 1 < window) return { middle: null, upper: null, lower: null };
    const sample = values.slice(index + 1 - window, index + 1).filter(finite).map(Number);
    if (sample.length < window) return { middle: null, upper: null, lower: null };
    const middle = mean(sample);
    const width = std(sample) * deviations;
    return { middle, upper: middle + width, lower: middle - width };
  });
}

export function volatilitySeries(rows = [], window = 20) {
  const returns = returnSeries(rows);
  const values = [null, ...returns];
  return values.map((_, index) => {
    if (index + 1 < window) return null;
    const sample = values.slice(index + 1 - window, index + 1).filter(finite).map(Number);
    return sample.length > 1 ? std(sample) * Math.sqrt(252) : null;
  });
}

export function realizedVolatility(rows = [], window = 20) {
  const returns = returnSeries(rows);
  const sample = returns.slice(-window);
  return sample.length > 1 ? std(sample) * Math.sqrt(252) : null;
}

export function indicatorRows(rows = []) {
  const normalizedRows = Array.isArray(rows) ? rows : [];
  const closes = normalizedRows.map((row) => Number(row.close));
  const sma20 = SMA(closes, 20);
  const sma50 = SMA(closes, 50);
  const sma200 = SMA(closes, 200);
  const ema20 = EMA(closes, 20);
  const ema50 = EMA(closes, 50);
  const rsi = RSI(closes, 14);
  const atr = ATR(normalizedRows, 14);
  const macd = MACD(closes);
  const bollinger = BollingerBands(closes, 20, 2);
  const volatility = volatilitySeries(normalizedRows, 20);
  return normalizedRows.map((row, index) => ({
    ...row,
    sma20: value(sma20[index]),
    sma50: value(sma50[index]),
    sma200: value(sma200[index]),
    ema20: value(ema20[index]),
    ema50: value(ema50[index]),
    rsi: value(rsi[index]),
    atr: value(atr[index]),
    macd: value(macd.macd[index]),
    macdSignal: value(macd.signal[index]),
    macdHistogram: value(macd.histogram[index]),
    bbMiddle: value(bollinger[index]?.middle),
    bbUpper: value(bollinger[index]?.upper),
    bbLower: value(bollinger[index]?.lower),
    volatility: value(volatility[index]),
  }));
}

export function betaToBenchmark(rows = [], benchmarkRows = [], window = 252) {
  const stock = returnSeries(rows).slice(-window);
  const bench = returnSeries(benchmarkRows).slice(-window);
  const n = Math.min(stock.length, bench.length);
  if (n < 2) return null;
  const x = stock.slice(-n);
  const y = bench.slice(-n);
  const yMean = mean(y);
  const variance = mean(y.map((value) => (value - yMean) ** 2));
  if (!variance) return null;
  const xMean = mean(x);
  return mean(x.map((value, index) => (value - xMean) * (y[index] - yMean))) / variance;
}

export function relativeStrength(rows = [], benchmarkRows = [], lookback = 20) {
  const last = rows.at(-1);
  const previous = rows.at(-1 - lookback);
  const benchLast = benchmarkRows.at(-1);
  const benchPrevious = benchmarkRows.at(-1 - lookback);
  if (!last || !previous || !benchLast || !benchPrevious) return null;
  return last.close / previous.close - 1 - (benchLast.close / benchPrevious.close - 1);
}

function rolling(values, window, reducer) {
  return values.map((_, index) => {
    if (index + 1 < window) return null;
    return reducer(values.slice(index + 1 - window, index + 1).filter(finite).map(Number));
  });
}

function mean(values) {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
}

function std(values) {
  const avg = mean(values);
  return avg === null ? null : Math.sqrt(mean(values.map((value) => (value - avg) ** 2)));
}

function finite(value) {
  return Number.isFinite(Number(value));
}

function value(input) {
  return finite(input) ? Number(input) : null;
}
