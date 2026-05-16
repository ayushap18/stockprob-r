import test from 'node:test';
import assert from 'node:assert/strict';
import universeHandler from '../api/universe.js';
import { parseNasdaqListed, parseOtherListed, searchUniverse } from '../server/data/universe.js';
import { createRealtimeMessage, validateRealtimeRequest } from '../server/realtime/protocol.js';

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

test('realtime protocol validates requests and creates typed messages', () => {
  assert.deepEqual(validateRealtimeRequest({ ticker: 'msft', horizon: 10 }), { ticker: 'MSFT', horizon: 10 });
  assert.throws(() => validateRealtimeRequest({ ticker: 'MSFT', horizon: 30 }), /horizon/);

  const message = createRealtimeMessage('progress', { step: 'features', ticker: 'MSFT' });
  assert.equal(message.type, 'progress');
  assert.equal(message.payload.step, 'features');
  assert.equal(typeof message.id, 'string');
});
