import test from 'node:test';
import assert from 'node:assert/strict';
import { createJobQueue, queueWorkerPlan, resetMemoryQueue } from '../server/queue/jobs.js';

test('memory queue records rank job lifecycle and bounded metrics', async () => {
  resetMemoryQueue();
  const queue = createJobQueue({ env: {} });

  const queued = await queue.enqueue('rank', { tickers: ['MSFT', 'AAPL'], horizon: 5 });
  const running = await queue.start(queued.id);
  const completed = await queue.complete(queued.id, { count: 2 });
  const status = await queue.status();
  const recent = await queue.recentJobs();

  assert.equal(queue.kind, 'memory');
  assert.equal(running.status, 'running');
  assert.equal(completed.status, 'completed');
  assert.equal(status.counts.completed, 1);
  assert.equal(status.counts.failed, 0);
  assert.equal(recent[0].type, 'rank');
  assert.deepEqual(recent[0].result, { count: 2 });
});

test('memory queue marks failed jobs with structured errors', async () => {
  resetMemoryQueue();
  const queue = createJobQueue({ env: {} });

  const queued = await queue.enqueue('backtest', { horizon: 20 });
  const failed = await queue.fail(queued.id, Object.assign(new Error('provider timeout'), { code: 'PROVIDER_FAILED' }));
  const status = await queue.status();

  assert.equal(failed.status, 'failed');
  assert.equal(failed.error.code, 'PROVIDER_FAILED');
  assert.equal(status.counts.failed, 1);
});

test('redis queue reports configured distributed mode without leaking redis URL', async () => {
  const queue = createJobQueue({ env: { REDIS_URL: 'redis://user:secret@example:6379/0' } });
  const status = await queue.status();
  const queued = await queue.enqueue('analysis', { ticker: 'NVDA' });

  assert.equal(queue.kind, 'redis');
  assert.equal(status.distributed, true);
  assert.equal(status.status, 'configured');
  assert.equal(JSON.stringify(status).includes('secret@example'), false);
  assert.equal(queued.status, 'queued');
  assert.equal(queued.skipped, 'redis_driver_not_installed');
});

test('queue worker plan describes production queues and event messages', () => {
  const plan = queueWorkerPlan();

  assert.equal(plan.queues.some((queue) => queue.name === 'rank'), true);
  assert.equal(plan.queues.some((queue) => queue.name === 'backtest'), true);
  assert.equal(plan.message_types.includes('rank.item'), true);
  assert.equal(plan.message_types.includes('backtest.metrics'), true);
});
