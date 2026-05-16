import test from 'node:test';
import assert from 'node:assert/strict';
import { createJobQueue, resetMemoryQueue } from '../server/queue/jobs.js';
import { processQueueJob, workerReadiness } from '../server/queue/processors.js';
import { runMemoryWorkerOnce } from '../server/queue/worker.js';

test('worker dispatches rank jobs with injectable data client', async () => {
  const result = await processQueueJob({
    type: 'rank',
    payload: { tickers: ['AAA', 'BBB'], horizon: 5 },
    deps: { dataClient: { fetchPredictionDataset: async () => ({ stockRows: [], spyRows: [] }) } },
  });

  assert.equal(result.type, 'rank');
  assert.equal(result.count, 2);
  assert.equal(result.payload.rankings.every((row) => row.ticker), true);
});

test('worker dispatches backtest jobs and returns metrics', async () => {
  const result = await processQueueJob({
    type: 'backtest',
    payload: { universe: ['AAA', 'BBB'], horizon: 5, top_n: 1 },
  });

  assert.equal(result.type, 'backtest');
  assert.equal(result.payload.horizon, '5d');
  assert.equal(result.payload.trades.length > 0, true);
  assert.equal(Number.isFinite(result.payload.metrics.sharpe_ratio), true);
});

test('worker dispatches provider refresh without requiring live provider keys', async () => {
  const result = await processQueueJob({ type: 'provider-refresh', payload: {} });

  assert.equal(result.type, 'provider-refresh');
  assert.equal(result.payload.ok, true);
  assert.equal(result.payload.provider_summary, 'degraded');
});

test('memory worker drains queued jobs and records completion', async () => {
  resetMemoryQueue();
  const queue = createJobQueue({ env: {} });
  await queue.enqueue('provider-refresh', {});
  await queue.enqueue('provider-refresh', {});

  const run = await runMemoryWorkerOnce({ queue, maxJobs: 5 });
  const status = await queue.status();

  assert.equal(run.processed, 2);
  assert.equal(run.failed, 0);
  assert.equal(status.counts.completed, 2);
  assert.equal(status.counts.queued, 0);
});

test('worker readiness reports local and redis modes without secrets', () => {
  const local = workerReadiness({ env: {} });
  const redis = workerReadiness({ env: { REDIS_URL: 'redis://user:secret@example:6379/0' } });

  assert.equal(local.mode, 'memory');
  assert.equal(redis.mode, 'redis');
  assert.equal(JSON.stringify(redis).includes('secret@example'), false);
  assert.equal(redis.required_processes.includes('stockprob-worker'), true);
});
