import assert from 'node:assert/strict';
import test from 'node:test';
import dashboardHandler from '../api/dashboard/[symbol]/snapshot.js';
import memoryHandler from '../api/system/memory.js';
import { confidenceScore, probabilityProfit } from '../src/lib/math/probabilities.js';
import { maxDrawdown, valueAtRisk } from '../src/lib/math/risk.js';
import { normalizeDashboardData } from '../src/lib/normalizeDashboardData.js';

test('dashboard snapshot endpoint returns one normalized connected envelope without provider keys', async () => {
  const previous = process.env.USE_YFINANCE;
  process.env.USE_YFINANCE = 'false';
  const response = await invoke(dashboardHandler, { query: { symbol: 'MSFT', horizonDays: '5' } });
  process.env.USE_YFINANCE = previous;
  assert.equal(response.statusCode, 200);
  assert.equal(response.payload.ok, true);
  assert.equal(response.payload.data.symbol, 'MSFT');
  assert.ok(Array.isArray(response.payload.data.candles));
  assert.ok(response.payload.data.candles.length > 20);
  assert.ok(Array.isArray(response.payload.data.benchmark));
  assert.ok(response.payload.data.probabilities.probabilityOutperformSpy >= 0);
  assert.ok(response.payload.data.monteCarlo.summary.probabilityProfit >= 0);
  assert.ok(response.payload.data.systemHealth);
  assert.ok(response.payload.data.memoryHealth);
  assert.ok(response.payload.meta.source);
});

test('memory endpoint returns bounded cache and subscription status envelope', async () => {
  const response = await invoke(memoryHandler, { query: {} });
  assert.equal(response.statusCode, 200);
  assert.equal(response.payload.ok, true);
  assert.ok(Number.isFinite(response.payload.data.cacheEntries));
  assert.ok(Number.isFinite(response.payload.data.activeSubscriptions));
});

test('normalizeDashboardData tolerates partial backend data', () => {
  const normalized = normalizeDashboardData({ symbol: 'AAPL', probabilities: { probabilityOutperformSpy: 0.61 } }, 'AAPL');
  assert.equal(normalized.symbol, 'AAPL');
  assert.equal(normalized.probabilities.probabilityOutperformSpy, 0.61);
  assert.ok(normalized.candles.length > 0);
  assert.ok(normalized.providerHealth.length > 0);
});

test('math probability and risk helpers return bounded values', () => {
  assert.equal(probabilityProfit([-0.1, 0.02, 0.03]), 2 / 3);
  assert.equal(valueAtRisk([-0.1, -0.05, 0.02, 0.04], 0.05), -0.1);
  assert.ok(maxDrawdown([1, 1.1, 0.9, 1.2]) < 0);
  assert.ok(confidenceScore({ sampleSize: 500, isDemo: true }) > 0);
  assert.ok(confidenceScore({ sampleSize: 500, isDemo: true }) < 1);
});

async function invoke(handler, request) {
  const output = { statusCode: 200, payload: null, headers: {} };
  const response = {
    setHeader(name, value) {
      output.headers[name] = value;
      return this;
    },
    status(code) {
      output.statusCode = code;
      return this;
    },
    json(payload) {
      output.payload = payload;
      return this;
    },
  };
  await handler({ method: 'GET', headers: {}, ...request }, response);
  return output;
}
