export const TRADING_DAYS = 252;

export function cleanRows(rows = []) {
  return rows
    .filter((row) => row?.date && finite(row.close))
    .map((row) => ({
      date: row.date.slice(0, 10),
      open: finite(row.open) ? Number(row.open) : Number(row.close),
      high: finite(row.high) ? Number(row.high) : Number(row.close),
      low: finite(row.low) ? Number(row.low) : Number(row.close),
      close: Number(row.close),
      volume: finite(row.volume) ? Number(row.volume) : 0,
    }))
    .sort((first, second) => first.date.localeCompare(second.date));
}

export function finite(value) {
  return value !== null && value !== undefined && value !== '' && Number.isFinite(Number(value));
}

export function round(value, decimals = 4) {
  if (!finite(value)) return null;
  const factor = 10 ** decimals;
  return Math.round(Number(value) * factor) / factor;
}

export function clamp(value, min = 0, max = 1) {
  if (!finite(value)) return min;
  return Math.min(max, Math.max(min, Number(value)));
}

export function mean(values) {
  const sample = values.filter(finite).map(Number);
  if (!sample.length) return null;
  return sample.reduce((total, value) => total + value, 0) / sample.length;
}

export function median(values) {
  const sample = values.filter(finite).map(Number).sort((a, b) => a - b);
  if (!sample.length) return null;
  const middle = Math.floor(sample.length / 2);
  return sample.length % 2 ? sample[middle] : (sample[middle - 1] + sample[middle]) / 2;
}

export function sampleStd(values) {
  const sample = values.filter(finite).map(Number);
  if (sample.length < 2) return null;
  const avg = mean(sample);
  return Math.sqrt(sample.reduce((total, value) => total + (value - avg) ** 2, 0) / (sample.length - 1));
}

export function covariance(firstValues, secondValues) {
  const pairs = firstValues
    .map((first, index) => [Number(first), Number(secondValues[index])])
    .filter(([first, second]) => finite(first) && finite(second));
  if (pairs.length < 2) return null;
  const firstMean = mean(pairs.map(([first]) => first));
  const secondMean = mean(pairs.map(([, second]) => second));
  return pairs.reduce((total, [first, second]) => total + (first - firstMean) * (second - secondMean), 0) / (pairs.length - 1);
}

export function correlation(firstValues, secondValues) {
  const cov = covariance(firstValues, secondValues);
  const firstStd = sampleStd(firstValues);
  const secondStd = sampleStd(secondValues);
  if (!finite(cov) || !finite(firstStd) || !finite(secondStd) || firstStd === 0 || secondStd === 0) return null;
  return cov / (firstStd * secondStd);
}

export function returns(rows, periods = 1) {
  const clean = cleanRows(rows);
  const output = [];
  for (let index = periods; index < clean.length; index += 1) {
    const previous = clean[index - periods].close;
    const current = clean[index].close;
    output.push(previous > 0 ? current / previous - 1 : null);
  }
  return output.filter(finite);
}

export function latestReturn(rows, periods) {
  const clean = cleanRows(rows);
  if (clean.length <= periods) return null;
  const previous = clean.at(-(periods + 1)).close;
  const current = clean.at(-1).close;
  return previous > 0 ? current / previous - 1 : null;
}

export function movingAverage(rows, periods) {
  const clean = cleanRows(rows);
  if (clean.length < periods) return null;
  return mean(clean.slice(-periods).map((row) => row.close));
}

export function zScore(value, sample) {
  const avg = mean(sample);
  const std = sampleStd(sample);
  if (!finite(value) || !finite(avg) || !finite(std) || std === 0) return null;
  return (Number(value) - avg) / std;
}

export function maxDrawdown(rows) {
  const clean = cleanRows(rows);
  let peak = -Infinity;
  let maxDd = 0;
  for (const row of clean) {
    peak = Math.max(peak, row.close);
    if (peak > 0) maxDd = Math.min(maxDd, row.close / peak - 1);
  }
  return maxDd;
}

export function alignReturnsByDate(rows, benchmarkRows, periods = 1) {
  const stock = datedReturns(rows, periods);
  const benchmark = new Map(datedReturns(benchmarkRows, periods).map((item) => [item.date, item.return]));
  return stock
    .map((item) => ({ date: item.date, stock: item.return, benchmark: benchmark.get(item.date) }))
    .filter((item) => finite(item.stock) && finite(item.benchmark));
}

export function datedReturns(rows, periods = 1) {
  const clean = cleanRows(rows);
  const output = [];
  for (let index = periods; index < clean.length; index += 1) {
    const previous = clean[index - periods].close;
    const current = clean[index].close;
    output.push({ date: clean[index].date, return: previous > 0 ? current / previous - 1 : null });
  }
  return output.filter((item) => finite(item.return));
}

export function sigmoid(value) {
  return 1 / (1 + Math.exp(-value));
}

export function annualizedVolatility(periodReturns) {
  const std = sampleStd(periodReturns);
  return finite(std) ? std * Math.sqrt(TRADING_DAYS) : null;
}
