import test from 'node:test';
import assert from 'node:assert/strict';
import healthHandler from '../api/health.js';
import outperformHandler from '../api/outperform.js';
import { predictOutperformance } from '../server/models/predict.js';
import { cachedFetchJson, cacheStats, clearCache, providerSummary, safeProviderCall } from '../server/data/resilience.js';

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

test('safeProviderCall warns when provider returns empty data', async () => {
  const result = await safeProviderCall({
    name: 'fundamentals',
    fallback: {},
    task: async () => [],
  });

  assert.equal(result.status, 'degraded');
  assert.match(result.warning, /returned no data/);
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

test('outperform API uses shared validation and injectable data client', async () => {
  const response = mockResponse();
  await outperformHandler(
    {
      method: 'GET',
      query: { ticker: 'bad symbol', horizon: '5' },
      dataClient: { fetchPredictionDataset: async () => ({ stockRows: [], spyRows: [] }) },
    },
    response
  );

  assert.equal(response.statusCode, 400);
  assert.match(response.body.error, /Ticker/);
});

test('cachedFetchJson caches values and bounds cache size', async () => {
  clearCache();
  const originalFetch = global.fetch;
  let calls = 0;
  global.fetch = async (url) => {
    calls += 1;
    return {
      ok: true,
      json: async () => ({ url, calls }),
    };
  };

  try {
    const first = await cachedFetchJson('https://example.test/a', { ttlMs: 10_000, maxEntries: 2 });
    const cached = await cachedFetchJson('https://example.test/a', { ttlMs: 10_000, maxEntries: 2 });
    await cachedFetchJson('https://example.test/b', { ttlMs: 10_000, maxEntries: 2 });
    await cachedFetchJson('https://example.test/c', { ttlMs: 10_000, maxEntries: 2 });

    assert.deepEqual(first, cached);
    assert.equal(calls, 3);
    assert.equal(cacheStats().entries, 2);
  } finally {
    global.fetch = originalFetch;
    clearCache();
  }
});

test('cachedFetchJson clamps cache size and coalesces identical misses', async () => {
  clearCache();
  const originalFetch = global.fetch;
  let calls = 0;
  global.fetch = async () => {
    calls += 1;
    await new Promise((resolve) => setTimeout(resolve, 5));
    return {
      ok: true,
      json: async () => ({ calls }),
    };
  };

  try {
    const values = await Promise.all(
      Array.from({ length: 8 }, () => cachedFetchJson('https://example.test/coalesced', { ttlMs: 10_000, maxEntries: 0 }))
    );

    assert.equal(calls, 1);
    assert.equal(values.every((value) => value.calls === 1), true);
    assert.equal(cacheStats().entries, 1);
  } finally {
    global.fetch = originalFetch;
    clearCache();
  }
});

test('providerSummary treats fallback as degraded', () => {
  assert.equal(providerSummary({ bloomberg: 'connected', market: 'fallback' }), 'degraded');
});
