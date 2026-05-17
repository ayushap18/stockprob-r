import { buildDashboardSnapshot } from '../../src/lib/buildDashboardSnapshot.js';
import { realtimeEnvelope } from '../../src/lib/responseEnvelope.js';
import { normalizeHorizonDays, normalizeSymbols } from '../../src/lib/validation.js';

export default async function handler(request, response) {
  const symbols = normalizeSymbols(request.query?.symbols || request.query?.symbol || request.query?.ticker, ['MSFT']);
  const horizonDays = normalizeHorizonDays(request.query?.horizonDays || request.query?.horizon, 5);
  const benchmarkSymbol = normalizeSymbols(request.query?.benchmark || 'SPY', ['SPY'])[0] || 'SPY';
  response.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
  response.setHeader('Cache-Control', 'no-cache, no-transform');
  response.setHeader('Connection', 'keep-alive');
  for (const symbol of symbols.slice(0, 8)) {
    const snapshot = await buildDashboardSnapshot(symbol, { horizonDays, benchmarkSymbol });
    const patch = {
      symbol: snapshot.data.symbol,
      quote: snapshot.data.quote,
      candles: snapshot.data.candles,
      benchmark: snapshot.data.benchmark,
      probabilities: snapshot.data.probabilities,
      probabilityHistory: snapshot.data.probabilityHistory,
      expectedReturns: snapshot.data.expectedReturns,
      monteCarlo: snapshot.data.monteCarlo,
      technicals: snapshot.data.technicals,
      features: snapshot.data.features,
      backtest: snapshot.data.backtest,
      providerHealth: snapshot.data.providerHealth,
      systemHealth: snapshot.data.systemHealth,
      memoryHealth: snapshot.data.memoryHealth,
    };
    response.write('event: dashboard.patch\n');
    response.write(`data: ${JSON.stringify(realtimeEnvelope('dashboard.patch', patch, { symbol, source: snapshot.meta.source, isDemo: snapshot.meta.isDemo, stale: snapshot.meta.stale, warnings: snapshot.meta.warnings }))}\n\n`);
  }
  response.write('event: heartbeat.ping\n');
  response.write(`data: ${JSON.stringify(realtimeEnvelope('heartbeat.ping', { intervalMs: 20000 }, { source: 'cache' }))}\n\n`);
  response.end();
}
