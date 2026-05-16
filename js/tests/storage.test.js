import test from 'node:test';
import assert from 'node:assert/strict';
import { createStorageAdapter, resetMemoryStorage, storageSchemaPlan } from '../server/storage/store.js';

test('memory storage records predictions and backtests with bounded status', async () => {
  resetMemoryStorage();
  const storage = createStorageAdapter({ env: {} });
  await storage.savePrediction({ ticker: 'MSFT', horizon: '5d', probability_outperform_spy: 0.61 });
  await storage.saveBacktest({ universe: ['MSFT'], horizon: '5d', metrics: { sharpe_ratio: 1.2 } });
  await storage.saveProviderSnapshot({ provider_summary: 'degraded' });

  const status = await storage.status();
  const predictions = await storage.recentPredictions();
  const backtests = await storage.recentBacktests();

  assert.equal(status.kind, 'memory');
  assert.equal(status.persistent, false);
  assert.equal(status.counts.predictions, 1);
  assert.equal(status.counts.backtests, 1);
  assert.equal(status.counts.provider_snapshots, 1);
  assert.equal(predictions[0].ticker, 'MSFT');
  assert.equal(backtests[0].horizon, '5d');
});

test('postgres storage reports configured status without leaking database URL', async () => {
  const storage = createStorageAdapter({ env: { DATABASE_URL: 'postgres://user:pass@example/db' } });
  const status = await storage.status();

  assert.equal(status.kind, 'postgres');
  assert.equal(status.persistent, true);
  assert.equal(JSON.stringify(status).includes('pass@example'), false);
  assert.equal(status.schema_required.includes('stockprob_predictions'), true);
});

test('storage schema plan includes dated feature rows and prediction indexes', () => {
  const schema = storageSchemaPlan();

  assert.equal(schema.extension, 'timescaledb');
  assert.equal(schema.tables.some((table) => table.name === 'stockprob_feature_rows'), true);
  assert.equal(schema.indexes.some((index) => index.includes('stockprob_predictions')), true);
});
