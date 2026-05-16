import test from 'node:test';
import assert from 'node:assert/strict';
import rankHandler from '../api/rank.js';
import backtestHandler from '../api/backtest.js';

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

test('rank API returns backend rankings using injectable market data', async () => {
  const response = mockResponse();
  const queue = mockQueue();
  await rankHandler(
    {
      method: 'GET',
      query: { tickers: 'AAA,BBB', horizon: '5' },
      dataClient: { fetchPredictionDataset: async () => ({ stockRows: [], spyRows: [] }) },
      queue,
    },
    response
  );

  assert.equal(response.statusCode, 200);
  assert.equal(response.body.count, 2);
  assert.equal(response.body.rankings.every((row) => row.ticker), true);
  assert.equal(response.body.queue_job.type, 'rank');
  assert.equal(response.body.queue_job.status, 'completed');
  assert.equal(queue.events.includes('rank:queued'), true);
});

test('backtest API returns summary metrics and trades', async () => {
  const response = mockResponse();
  const saved = [];
  const queue = mockQueue();
  await backtestHandler(
    {
      method: 'GET',
      query: { universe: 'AAA,BBB', horizon: '5' },
      storage: { saveBacktest: async (record) => saved.push(record) },
      queue,
    },
    response
  );

  assert.equal(response.statusCode, 200);
  assert.equal(response.body.horizon, '5d');
  assert.equal(response.body.trades.length > 0, true);
  assert.equal(response.body.benchmark_equity_curve.length, response.body.equity_curve.length);
  assert.equal(Number.isFinite(response.body.metrics.sharpe_ratio), true);
  assert.equal(response.body.data_mode, 'demo-history');
  assert.equal(response.body.queue_job.type, 'backtest');
  assert.equal(response.body.queue_job.status, 'completed');
  assert.equal(saved.length, 1);
  assert.equal(saved[0].horizon, '5d');
});

function mockQueue() {
  const events = [];
  return {
    events,
    async enqueue(type, payload) {
      events.push(`${type}:queued`);
      return { id: `${type}-job`, type, payload, status: 'queued', mode: 'memory' };
    },
    async start(jobOrId) {
      const job = typeof jobOrId === 'string' ? { id: jobOrId } : jobOrId;
      events.push(`${job.type}:running`);
      return { ...job, status: 'running' };
    },
    async complete(jobOrId, result) {
      const job = typeof jobOrId === 'string' ? { id: jobOrId } : jobOrId;
      events.push(`${job.type}:completed`);
      return { ...job, status: 'completed', result };
    },
    async fail(jobOrId, error) {
      const job = typeof jobOrId === 'string' ? { id: jobOrId } : jobOrId;
      events.push(`${job.type}:failed`);
      return { ...job, status: 'failed', error };
    },
  };
}
