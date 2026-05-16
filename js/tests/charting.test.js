import test from 'node:test';
import assert from 'node:assert/strict';
import { generateDemoPriceData, generateDemoRankings } from '../src/lib/demoChartData.js';
import { runMonteCarloSimulation } from '../src/lib/monteCarlo.js';
import { normalizePriceHistory, normalizePrediction } from '../src/lib/normalizeChartData.js';

test('demo price data is deterministic for a ticker', () => {
  const first = generateDemoPriceData('MSFT');
  const second = generateDemoPriceData('MSFT');
  assert.deepEqual(first, second);
  assert.equal(first.length > 100, true);
  assert.equal(first.every((row) => row.time && row.high >= row.low && row.close > 0), true);
});

test('demo rankings include stable numeric chart fields', () => {
  const rows = generateDemoRankings();
  assert.equal(rows.length >= 10, true);
  assert.equal(rows.every((row) => Number.isFinite(row.probability) && Number.isFinite(row.expectedReturn)), true);
});

test('monte carlo simulation is deterministic for same seed', () => {
  const first = runMonteCarloSimulation({ startPrice: 100, days: 5, simulations: 50, seed: 'AAPL' });
  const second = runMonteCarloSimulation({ startPrice: 100, days: 5, simulations: 50, seed: 'AAPL' });
  assert.deepEqual(first.percentiles, second.percentiles);
  assert.equal(first.paths.length, 50);
  assert.equal(first.percentiles.length, 6);
  assert.equal(Number.isFinite(first.summary.valueAtRisk5), true);
});

test('chart normalizers never throw on messy payloads', () => {
  assert.deepEqual(normalizePriceHistory({ rows: [{ date: '2026-01-01', close: '10' }, { bad: true }] }), [
    { time: '2026-01-01', date: '2026-01-01', open: 10, high: 10, low: 10, close: 10, volume: null },
  ]);
  const prediction = normalizePrediction({ ticker: 'AAPL', probability_outperform_spy: '0.61', features: null, warnings: 'bad' });
  assert.equal(prediction.ticker, 'AAPL');
  assert.equal(prediction.probability, 0.61);
  assert.deepEqual(prediction.warnings, []);
});
