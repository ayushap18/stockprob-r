export function runMonteCarloSimulation({
  startPrice = 100,
  expectedReturnAnnual = 0.08,
  volatilityAnnual = 0.22,
  days = 20,
  simulations = 1000,
  seed = 42,
} = {}) {
  const initial = positiveNumber(startPrice, 100);
  const horizon = Math.max(1, Math.min(252, Math.floor(Number(days) || 20)));
  const count = Math.max(10, Math.min(10000, Math.floor(Number(simulations) || 1000)));
  const drift = finite(expectedReturnAnnual) ? Number(expectedReturnAnnual) / 252 : 0;
  const vol = finite(volatilityAnnual) ? Math.max(0.001, Number(volatilityAnnual)) / Math.sqrt(252) : 0.22 / Math.sqrt(252);
  const rng = mulberry32(hashSeed(seed));
  const paths = Array.from({ length: count }, () => {
    const path = [initial];
    for (let day = 1; day <= horizon; day += 1) {
      const shock = normal(rng);
      const previous = path[day - 1];
      path.push(previous * Math.exp((drift - 0.5 * vol ** 2) + vol * shock));
    }
    return path;
  });
  const percentiles = Array.from({ length: horizon + 1 }, (_, day) => {
    const values = paths.map((path) => path[day]).sort((a, b) => a - b);
    return {
      day,
      p5: percentile(values, 0.05),
      p25: percentile(values, 0.25),
      p50: percentile(values, 0.5),
      p75: percentile(values, 0.75),
      p95: percentile(values, 0.95),
    };
  });
  const finalValues = paths.map((path) => path.at(-1));
  const finalReturns = finalValues.map((value) => value / initial - 1).sort((a, b) => a - b);
  const sortedValues = [...finalValues].sort((a, b) => a - b);
  const var5 = percentile(finalReturns, 0.05);
  const tail = finalReturns.filter((value) => value <= var5);
  const meanReturn = average(finalReturns);
  const medianReturn = percentile(finalReturns, 0.5);
  return {
    paths,
    percentiles,
    finalValues,
    finalReturns,
    summary: {
      meanFinalPrice: average(finalValues),
      medianFinalPrice: percentile(sortedValues, 0.5),
      p5FinalPrice: percentile(sortedValues, 0.05),
      p25FinalPrice: percentile(sortedValues, 0.25),
      p75FinalPrice: percentile(sortedValues, 0.75),
      p95FinalPrice: percentile(sortedValues, 0.95),
      probabilityProfit: finalReturns.filter((value) => value > 0).length / finalReturns.length,
      valueAtRisk5: var5,
      expectedShortfall5: tail.length ? average(tail) : var5,
      maxDrawdownEstimate: median(paths.map(maxDrawdown)),
      meanFinalReturn: meanReturn,
      medianFinalReturn: medianReturn,
    },
  };
}

export function downsamplePaths(paths = [], maxPaths = 120) {
  if (paths.length <= maxPaths) return paths;
  const step = Math.ceil(paths.length / maxPaths);
  return paths.filter((_, index) => index % step === 0).slice(0, maxPaths);
}

function normal(rng) {
  const first = Math.max(Number.EPSILON, rng());
  const second = Math.max(Number.EPSILON, rng());
  return Math.sqrt(-2 * Math.log(first)) * Math.cos(2 * Math.PI * second);
}

function mulberry32(seed) {
  let state = seed >>> 0;
  return () => {
    state += 0x6d2b79f5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function hashSeed(seed) {
  const text = String(seed);
  let hash = 2166136261;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function percentile(values, p) {
  if (!values.length) return null;
  const index = (values.length - 1) * p;
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  if (lower === upper) return values[lower];
  return values[lower] + (values[upper] - values[lower]) * (index - lower);
}

function median(values) {
  return percentile([...values].sort((a, b) => a - b), 0.5);
}

function average(values) {
  const sample = values.filter(finite);
  return sample.length ? sample.reduce((total, value) => total + Number(value), 0) / sample.length : null;
}

function maxDrawdown(path) {
  let peak = path[0] || 1;
  let drawdown = 0;
  for (const value of path) {
    peak = Math.max(peak, value);
    drawdown = Math.min(drawdown, value / peak - 1);
  }
  return drawdown;
}

function positiveNumber(value, fallback) {
  return finite(value) && Number(value) > 0 ? Number(value) : fallback;
}

function finite(value) {
  return value !== null && value !== undefined && value !== '' && Number.isFinite(Number(value));
}
