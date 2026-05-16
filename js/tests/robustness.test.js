import test from 'node:test';
import assert from 'node:assert/strict';
import healthHandler from '../api/health.js';
import outperformHandler from '../api/outperform.js';
import { predictOutperformance } from '../server/models/predict.js';
import { cachedFetchJson, cacheStats, clearCache, providerSummary, safeProviderCall } from '../server/data/resilience.js';
import { infrastructureReadiness, requiredProviderPlan } from '../server/config/infrastructure.js';
import { FundamentalsDataClient, MacroDataClient } from '../server/data/clients.js';
import { calculateMacroFeatures } from '../server/features/macro.js';

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
  assert.equal(Array.isArray(response.body.infrastructure.providers), true);
  assert.equal(response.body.infrastructure.capabilities.persistent_feature_store, false);
  assert.equal(response.body.required_provider_plan.phase_1.includes('POLYGON_API_KEY'), true);
  assert.equal(response.body.storage.kind, 'memory');
  assert.equal(response.body.storage.schema_plan.tables.some((table) => table.name === 'stockprob_predictions'), true);
  assert.equal(response.body.queue.kind, 'memory');
  assert.equal(response.body.queue.worker_plan.queues.some((queue) => queue.name === 'rank'), true);
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

test('infrastructureReadiness maps configured providers and missing env', () => {
  const previous = process.env.POLYGON_API_KEY;
  process.env.POLYGON_API_KEY = 'test-key';
  try {
    const readiness = infrastructureReadiness({ cacheStats: { entries: 2 } });
    const polygon = readiness.providers.find((provider) => provider.key === 'polygon');
    const postgres = readiness.providers.find((provider) => provider.key === 'postgres');

    assert.equal(polygon.configured, true);
    assert.equal(postgres.configured, false);
    assert.equal(readiness.capabilities.live_market_data, true);
    assert.equal(readiness.cache.entries, 2);
    assert.equal(requiredProviderPlan().phase_2.includes('DATABASE_URL'), true);
  } finally {
    if (previous === undefined) delete process.env.POLYGON_API_KEY;
    else process.env.POLYGON_API_KEY = previous;
  }
});

test('MacroDataClient converts FRED observations into model macro inputs', async () => {
  clearCache();
  const originalFetch = global.fetch;
  const previousFredKey = process.env.FRED_API_KEY;
  process.env.FRED_API_KEY = 'test-fred-key';
  global.fetch = async (url) => {
    const seriesId = new URL(url).searchParams.get('series_id');
    const values = {
      DGS10: [
        ['2026-01-01', '4.00'],
        ['2026-02-01', '4.20'],
      ],
      DGS2: [['2026-02-01', '3.90']],
      FEDFUNDS: [['2026-02-01', '4.50']],
      CPIAUCSL: [
        ['2025-02-01', '300'],
        ['2026-02-01', '309'],
      ],
      UNRATE: [
        ['2025-08-01', '4.2'],
        ['2026-02-01', '4.0'],
      ],
      DTWEXBGS: [
        ['2026-01-01', '120'],
        ['2026-02-01', '118'],
      ],
    }[seriesId];
    return {
      ok: true,
      json: async () => ({
        observations: values.map(([date, value]) => ({ date, value })),
      }),
    };
  };

  try {
    const macro = await new MacroDataClient().fetchMacroState('2026-02-28');
    assert.equal(macro.treasury_10y, 4.2);
    assert.equal(macro.yield_curve_spread, 0.30000000000000027);
    assert.equal(Math.round(macro.cpi_yoy * 1000) / 1000, 0.03);
    const features = calculateMacroFeatures({ macro });
    assert.equal(features.fed_funds_rate, 4.5);
    assert.equal(features.fred_as_of, '2026-02-01');
    assert.equal(Number.isFinite(features.macro_sector_score), true);
  } finally {
    global.fetch = originalFetch;
    if (previousFredKey === undefined) delete process.env.FRED_API_KEY;
    else process.env.FRED_API_KEY = previousFredKey;
    clearCache();
  }
});

test('FundamentalsDataClient maps FMP stable endpoint fields', async () => {
  clearCache();
  const originalFetch = global.fetch;
  const previousFmpKey = process.env.FMP_API_KEY;
  process.env.FMP_API_KEY = 'test-fmp-key';
  global.fetch = async (url) => {
    const pathname = new URL(url).pathname;
    let payload = [];
    if (pathname.endsWith('/profile')) payload = [{ price: 300, eps: 8 }];
    if (pathname.endsWith('/ratios-ttm')) {
      payload = [
        {
          grossProfitMarginTTM: 0.48,
          operatingProfitMarginTTM: 0.33,
          netProfitMarginTTM: 0.27,
          currentRatioTTM: 1.07,
          debtToEquityRatioTTM: 1.7,
          returnOnEquityTTM: 1.5,
          priceToEarningsRatioTTM: 36,
          priceToSalesRatioTTM: 9.8,
          priceToBookRatioTTM: 41,
        },
      ];
    }
    if (pathname.endsWith('/financial-growth')) payload = [{ revenueGrowth: 0.06, epsgrowth: 0.22 }];
    return { ok: true, json: async () => payload };
  };

  try {
    const fundamentals = await new FundamentalsDataClient().fetchFundamentals('AAPL');
    assert.equal(fundamentals.revenue_growth_yoy, 0.06);
    assert.equal(fundamentals.eps_growth_yoy, 0.22);
    assert.equal(fundamentals.debt_to_equity, 1.7);
    assert.equal(fundamentals.pe_ratio, 36);
    assert.equal(fundamentals.forward_pe_ratio, 37.5);
  } finally {
    global.fetch = originalFetch;
    if (previousFmpKey === undefined) delete process.env.FMP_API_KEY;
    else process.env.FMP_API_KEY = previousFmpKey;
    clearCache();
  }
});
