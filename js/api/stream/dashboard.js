import { buildDashboardSnapshot } from '../../src/lib/buildDashboardSnapshot.js';
import { realtimeEnvelope } from '../../src/lib/responseEnvelope.js';
import { normalizeHorizonDays, normalizeSymbols } from '../../src/lib/validation.js';

export default async function handler(request, response) {
  const symbols = normalizeSymbols(request.query?.symbols || request.query?.symbol || request.query?.ticker, ['MSFT']);
  const horizonDays = normalizeHorizonDays(request.query?.horizonDays || request.query?.horizon, 5);
  response.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
  response.setHeader('Cache-Control', 'no-cache, no-transform');
  response.setHeader('Connection', 'keep-alive');
  for (const symbol of symbols.slice(0, 8)) {
    const snapshot = await buildDashboardSnapshot(symbol, { horizonDays });
    const patch = {
      symbol: snapshot.data.symbol,
      quote: snapshot.data.quote,
      probabilities: snapshot.data.probabilities,
      providerHealth: snapshot.data.providerHealth,
      systemHealth: snapshot.data.systemHealth,
      memoryHealth: snapshot.data.memoryHealth,
    };
    response.write('event: dashboard.patch\n');
    response.write(`data: ${JSON.stringify(realtimeEnvelope('dashboard.patch', patch, { symbol, source: snapshot.meta.source, isDemo: snapshot.meta.isDemo, warnings: snapshot.meta.warnings }))}\n\n`);
  }
  response.write('event: heartbeat.ping\n');
  response.write(`data: ${JSON.stringify(realtimeEnvelope('heartbeat.ping', { intervalMs: 20000 }, { source: 'cache' }))}\n\n`);
  response.end();
}
