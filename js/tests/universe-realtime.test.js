import test from 'node:test';
import assert from 'node:assert/strict';
import universeHandler from '../api/universe.js';
import { parseNasdaqListed, parseOtherListed, searchUniverse } from '../server/data/universe.js';
import { createRealtimeMessage, validateRealtimeRequest } from '../server/realtime/protocol.js';
import { createRateLimiter, handleRealtimeMessage, mapWithConcurrency, realtimeMetrics } from '../server/realtime/server.js';

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

test('parses NASDAQ Trader listed symbol directories', () => {
  const nasdaqText = [
    'Symbol|Security Name|Market Category|Test Issue|Financial Status|Round Lot Size|ETF|NextShares',
    'AAPL|Apple Inc. Common Stock|Q|N|N|100|N|N',
    'QQQ|Invesco QQQ Trust, Series 1|G|N|N|100|Y|N',
    'File Creation Time: 0516202620:00|||||||',
  ].join('\n');
  const otherText = [
    'ACT Symbol|Security Name|Exchange|CQS Symbol|ETF|Round Lot Size|Test Issue|NASDAQ Symbol',
    'IBM|International Business Machines Corporation Common Stock|N|IBM|N|100|N|IBM',
    'SPY|SPDR S&P 500 ETF Trust|P|SPY|Y|100|N|SPY',
    'File Creation Time: 0516202620:00|||||||',
  ].join('\n');

  const listed = [...parseNasdaqListed(nasdaqText), ...parseOtherListed(otherText)];

  assert.deepEqual(listed.map((item) => item.symbol), ['AAPL', 'QQQ', 'IBM', 'SPY']);
  assert.equal(listed.find((item) => item.symbol === 'AAPL').exchange, 'NASDAQ');
  assert.equal(listed.find((item) => item.symbol === 'IBM').exchange, 'NYSE');
});

test('searchUniverse searches symbols and names across all listed stocks', () => {
  const results = searchUniverse([
    { symbol: 'AAPL', name: 'Apple Inc. Common Stock', exchange: 'NASDAQ', type: 'stock' },
    { symbol: 'MSFT', name: 'Microsoft Corporation', exchange: 'NASDAQ', type: 'stock' },
    { symbol: 'SPY', name: 'SPDR S&P 500 ETF Trust', exchange: 'NYSE Arca', type: 'etf' },
  ], 'micro');

  assert.equal(results[0].symbol, 'MSFT');
});

test('universe API returns structured search results', async () => {
  const response = mockResponse();
  await universeHandler(
    {
      method: 'GET',
      query: { q: 'apple', limit: '5' },
      universeClient: {
        fetchUniverse: async () => [
          { symbol: 'AAPL', name: 'Apple Inc. Common Stock', exchange: 'NASDAQ', type: 'stock' },
          { symbol: 'MSFT', name: 'Microsoft Corporation', exchange: 'NASDAQ', type: 'stock' },
        ],
      },
    },
    response
  );

  assert.equal(response.statusCode, 200);
  assert.equal(response.body.results[0].symbol, 'AAPL');
  assert.equal(response.body.coverage, 'nasdaq-trader-listed-us-securities');
});

test('universe API falls back when injected universe client fails', async () => {
  const response = mockResponse();
  await universeHandler(
    {
      method: 'GET',
      query: { q: 'AAPL', limit: '5' },
      universeClient: {
        fetchUniverse: async () => {
          throw new Error('custom universe unavailable');
        },
      },
    },
    response
  );

  assert.equal(response.statusCode, 200);
  assert.equal(response.body.coverage, 'fallback-major-us-securities');
  assert.equal(response.body.results[0].symbol, 'AAPL');
  assert.equal(response.body.warnings.some((warning) => warning.includes('custom universe unavailable')), true);
});

test('realtime protocol validates requests and creates typed messages', () => {
  assert.deepEqual(validateRealtimeRequest({ ticker: 'msft', horizon: 10 }), { ticker: 'MSFT', horizon: 10 });
  assert.throws(() => validateRealtimeRequest({ ticker: 'MSFT', horizon: 30 }), /horizon/);

  const message = createRealtimeMessage('progress', { step: 'features', ticker: 'MSFT' });
  assert.equal(message.type, 'progress');
  assert.equal(message.payload.step, 'features');
  assert.equal(typeof message.id, 'string');
});

test('realtime handler supports ping and structured errors without throwing', async () => {
  const messages = [];
  await handleRealtimeMessage('{bad-json', { send: (message) => messages.push(message) });
  await handleRealtimeMessage({ type: 'ping', request_id: 'ping-1' }, { send: (message) => messages.push(message) });

  assert.equal(messages[0].type, 'error');
  assert.equal(messages[0].payload.code, 'INVALID_MESSAGE');
  assert.equal(messages[1].type, 'pong');
  assert.equal(messages[2].type, 'heartbeat.pong');
  assert.equal(messages[1].request_id, 'ping-1');
});

test('analysis emits production progress steps and provider status', async () => {
  const messages = [];
  await handleRealtimeMessage(
    { type: 'analyze', request_id: 'analysis-1', payload: { ticker: 'MSFT', horizon: 5 } },
    {
      send: (message) => messages.push(message),
      predictFn: async () => ({ ticker: 'MSFT', signal: 'neutral', probability_outperform_spy: 0.51 }),
    }
  );

  const steps = messages.filter((message) => message.type === 'analysis.progress').map((message) => message.payload.step);
  assert.deepEqual(steps, ['fetching_prices', 'fetching_spy', 'fetching_news', 'fetching_fundamentals', 'calculating_features', 'running_model', 'complete']);
  assert(messages.some((message) => message.type === 'analysis.start'));
  assert(messages.some((message) => message.type === 'provider.status'));
  assert(messages.some((message) => message.type === 'analysis.result'));
});

test('realtime handler can cancel an in-flight analysis request', async () => {
  const messages = [];
  const slowPredictor = () => new Promise((resolve) => setTimeout(() => resolve({ ticker: 'MSFT', signal: 'neutral' }), 30));

  const running = handleRealtimeMessage(
    { type: 'analyze', request_id: 'req-1', payload: { ticker: 'MSFT', horizon: 5 } },
    { send: (message) => messages.push(message), predictFn: slowPredictor }
  );
  await handleRealtimeMessage({ type: 'cancel', request_id: 'cancel-1', payload: { request_id: 'req-1' } }, { send: (message) => messages.push(message) });
  await running;

  assert(messages.some((message) => message.type === 'analysis.cancelled'));
  assert(!messages.some((message) => message.type === 'analysis.result'));
});

test('mapWithConcurrency caps active realtime ranking work', async () => {
  let active = 0;
  let maxActive = 0;
  const values = await mapWithConcurrency([1, 2, 3, 4], 2, async (item) => {
    active += 1;
    maxActive = Math.max(maxActive, active);
    await new Promise((resolve) => setTimeout(resolve, 5));
    active -= 1;
    return item * 2;
  });

  assert.deepEqual(values, [2, 4, 6, 8]);
  assert.equal(maxActive, 2);
});

test('rank streams each ticker and live leaderboard updates', async () => {
  const messages = [];
  await handleRealtimeMessage(
    { type: 'rank', request_id: 'rank-1', payload: { tickers: ['AAA', 'BBB', 'CCC'], horizon: 5, limit: 2 } },
    {
      send: (message) => messages.push(message),
      rankConcurrency: 2,
      predictFn: async ({ ticker }) => ({ ticker, alpha_score: ticker === 'BBB' ? 0.9 : ticker === 'CCC' ? 0.7 : 0.4, signal: 'neutral' }),
    }
  );

  assert(messages.some((message) => message.type === 'rank.start'));
  assert.equal(messages.filter((message) => message.type === 'rank.item').length >= 3, true);
  assert.equal(messages.filter((message) => message.type === 'rank.leaderboard').length >= 3, true);
  assert.equal(messages.find((message) => message.type === 'rank.complete').payload.rankings[0].ticker, 'BBB');
});

test('rate limiter rejects bursts past configured realtime budget', () => {
  const limiter = createRateLimiter({ maxEvents: 2, windowMs: 1_000 });
  assert.equal(limiter.allow('client-a'), true);
  assert.equal(limiter.allow('client-a'), true);
  assert.equal(limiter.allow('client-a'), false);
  assert.equal(limiter.allow('client-b'), true);
});

test('realtime metrics reports active work and clears after completion', async () => {
  const messages = [];
  const slowPredictor = () => new Promise((resolve) => setTimeout(() => resolve({ ticker: 'AAPL', signal: 'neutral' }), 20));
  const running = handleRealtimeMessage(
    { type: 'analyze', request_id: 'metric-1', payload: { ticker: 'AAPL', horizon: 5 } },
    { send: (message) => messages.push(message), predictFn: slowPredictor }
  );

  assert.equal(realtimeMetrics().active_requests >= 1, true);
  await running;
  assert.equal(realtimeMetrics().active_requests, 0);
});

test('watchlist emits snapshot, changed updates, and unsubscribe', async () => {
  const messages = [];
  let run = 0;
  await handleRealtimeMessage(
    { type: 'watchlist.subscribe', request_id: 'watch-1', payload: { tickers: ['MSFT'], horizon: 5, interval_ms: 5 } },
    {
      send: (message) => messages.push(message),
      predictFn: async () => ({ ticker: 'MSFT', signal: run++ === 0 ? 'neutral' : 'bullish', probability_outperform_spy: run === 1 ? 0.51 : 0.7 }),
    }
  );
  await new Promise((resolve) => setTimeout(resolve, 20));
  await handleRealtimeMessage({ type: 'watchlist.unsubscribe', request_id: 'watch-stop', payload: { subscription_id: 'watch-1' } }, { send: (message) => messages.push(message) });

  assert(messages.some((message) => message.type === 'watchlist.snapshot'));
  assert(messages.some((message) => message.type === 'watchlist.update'));
  assert(messages.some((message) => message.type === 'watchlist.unsubscribe'));
});

test('backtest streaming emits progress, trade, metrics, and complete', async () => {
  const messages = [];
  await handleRealtimeMessage(
    { type: 'backtest', request_id: 'bt-1', payload: { universe: ['AAA'], horizon: 5 } },
    {
      send: (message) => messages.push(message),
      backtestFn: async () => ({
        trades: [{ ticker: 'AAA', entry_date: '2026-01-01', exit_date: '2026-01-08', net_return: 0.02 }],
        metrics: { sharpe_ratio: 1.1 },
        equity_curve: [{ date: '2026-01-08', equity: 1.02 }],
      }),
    }
  );

  assert(messages.some((message) => message.type === 'backtest.start'));
  assert(messages.some((message) => message.type === 'backtest.progress'));
  assert(messages.some((message) => message.type === 'backtest.trade'));
  assert(messages.some((message) => message.type === 'backtest.metrics'));
  assert(messages.some((message) => message.type === 'backtest.complete'));
});

test('blank agent accepts a user message without trading advice', async () => {
  const messages = [];
  await handleRealtimeMessage(
    { type: 'agent.blank', request_id: 'agent-1', payload: { message: 'hello' } },
    { send: (message) => messages.push(message) }
  );

  const response = messages.find((message) => message.type === 'agent.blank.message');
  assert.equal(response.payload.role, 'agent');
  assert.match(response.payload.content, /blank realtime agent/i);
});
