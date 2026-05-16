import test from 'node:test';
import assert from 'node:assert/strict';
import quoteHandler from '../api/market/quote/[symbol].js';
import systemHealthHandler from '../api/system/health.js';
import providersHandler from '../api/system/providers.js';
import { createCache } from '../src/lib/cache.js';
import { realtimeEnvelope } from '../src/lib/responseEnvelope.js';
import { calculateDerivedFeatures } from '../src/lib/derivedFeatures.js';
import { normalizeSymbol } from '../src/lib/validation.js';

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

test('new REST envelope endpoints fail closed and return safe metadata', async () => {
  const response = mockResponse();
  await systemHealthHandler({ method: 'GET', query: {} }, response);
  assert.equal(response.statusCode, 200);
  assert.equal(response.body.ok, true);
  assert.equal(typeof response.body.data.status, 'string');
  assert.equal(Array.isArray(response.body.meta.warnings), true);
});

test('provider health marks missing keys as not_configured', async () => {
  const response = mockResponse();
  await providersHandler({ method: 'GET', query: {} }, response);
  assert.equal(response.body.ok, true);
  const polygon = response.body.data.find((provider) => provider.provider === 'polygon');
  assert.equal(Boolean(polygon), true);
  assert.equal(['ok', 'not_configured'].includes(polygon.status), true);
});

test('quote endpoint returns demo fallback without throwing when providers fail', async () => {
  const previousUseYfinance = process.env.USE_YFINANCE;
  process.env.USE_YFINANCE = 'false';
  const response = mockResponse();
  await quoteHandler({ method: 'GET', query: { symbol: 'MSFT' } }, response);
  assert.equal(response.statusCode, 200);
  assert.equal(response.body.ok, true);
  assert.equal(response.body.data.symbol, 'MSFT');
  assert.equal(response.body.meta.isDemo, true);
  if (previousUseYfinance === undefined) delete process.env.USE_YFINANCE;
  else process.env.USE_YFINANCE = previousUseYfinance;
});

test('live helpers validate symbols, cache values, and shape realtime envelopes', async () => {
  assert.equal(normalizeSymbol('brk.b'), 'BRK.B');
  const cache = createCache({ namespace: 'test-live' });
  await cache.set('a', { value: 1 }, 1000);
  assert.equal((await cache.get('a')).value.value, 1);
  const message = realtimeEnvelope('quote.update', { price: 10 }, { symbol: 'MSFT', source: 'demo', isDemo: true });
  assert.equal(message.type, 'quote.update');
  assert.equal(message.symbol, 'MSFT');
  assert.equal(message.isDemo, true);
});

test('derived features are computed from public/app-generated inputs', () => {
  const prices = Array.from({ length: 25 }, (_, index) => ({ close: 100 + index }));
  const spy = Array.from({ length: 25 }, (_, index) => ({ close: 100 + index * 0.5 }));
  const features = calculateDerivedFeatures({ symbol: 'MSFT', prices, spy, news: [{ published_at: new Date().toISOString(), sentiment: 0.2 }] });
  assert.equal(features.symbol, 'MSFT');
  assert.equal(Number.isFinite(features.momentum_20d), true);
  assert.equal(Number.isFinite(features.relative_strength_vs_spy), true);
  assert.equal(features.news_volume_7d, 1);
});
