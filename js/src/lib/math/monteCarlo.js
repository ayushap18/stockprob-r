export { downsamplePaths, runMonteCarloSimulation } from '../monteCarlo.js';

export function geometricBrownianMotion({ startPrice, expectedReturnAnnual, volatilityAnnual, days, simulations, seed } = {}) {
  return runMonteCarloSimulation({ startPrice, expectedReturnAnnual, volatilityAnnual, days, simulations, seed });
}

export function seededRandom(seed = 1) {
  let state = hashSeed(seed);
  return () => {
    state += 0x6d2b79f5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

export function percentile(values = [], p = 0.5) {
  const sorted = values.filter((value) => Number.isFinite(Number(value))).map(Number).sort((a, b) => a - b);
  if (!sorted.length) return null;
  const index = (sorted.length - 1) * p;
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  return lower === upper ? sorted[lower] : sorted[lower] + (sorted[upper] - sorted[lower]) * (index - lower);
}

export function summarizeSimulation(simulation = {}) {
  return simulation.summary || {};
}

function hashSeed(seed) {
  let hash = 2166136261;
  for (const char of String(seed)) {
    hash ^= char.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}
