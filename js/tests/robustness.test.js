import test from 'node:test';
import assert from 'node:assert/strict';
import healthHandler from '../api/health.js';
import outperformHandler from '../api/outperform.js';
import { predictOutperformance } from '../server/models/predict.js';
import { safeProviderCall } from '../server/data/resilience.js';

function mockResponse() {
  return {
    statusCode: 200,
    body: null,
    headers: {},
    status(code) {
      this.statusCode = code;
      return this;
    },
    setHeader(name, value) {
      this.headers[name] = value;
      return this;
    },
    json(payload) {
      this.body = payload;
      return this;
    },
  };
}

test('safeProviderCall converts provider exceptions into degraded results', async () => {
  const result = await safeProviderCall({
    name: 'news',
    fallback: [],
    task: async () => {
      throw new Error('provider timeout');
    },
  });

  assert.equal(result.status, 'failed');
  assert.deepEqual(result.value, []);
  assert.match(result.warning, /news failed/);
});

test('predictOutperformance fails clearly when market history is insufficient', async () => {
  await assert.rejects(
    () =>
      predictOutperformance({
        ticker: 'AAPL',
        horizon: 5,
        marketData: {
          stockRows: [],
          spyRows: [],
          providerStatus: { bloomberg: 'disconnected', market: 'failed' },
        },
      }),
    /Insufficient market history/
  );
});

test('health endpoint reports service and provider status', async () => {
  const response = mockResponse();
  await healthHandler({ method: 'GET' }, response);

  assert.equal(response.statusCode, 200);
  assert.equal(response.body.ok, true);
  assert.equal(response.body.service, 'stockprob-r');
  assert.equal(response.body.providers.bloomberg, 'disconnected');
});

test('outperform API returns structured 400 for bad horizon', async () => {
  const response = mockResponse();
  await outperformHandler({ method: 'GET', query: { ticker: 'MSFT', horizon: '30' } }, response);

  assert.equal(response.statusCode, 400);
  assert.match(response.body.error, /horizon/);
});
