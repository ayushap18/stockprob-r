import { getQuote } from '../../src/lib/providers/index.js';
import { realtimeEnvelope } from '../../src/lib/responseEnvelope.js';
import { normalizeSymbols } from '../../src/lib/validation.js';

export default async function handler(request, response) {
  const symbols = normalizeSymbols(request.query?.symbols || request.query?.symbol || request.query?.ticker, ['MSFT', 'AAPL', 'NVDA']);
  response.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
  response.setHeader('Cache-Control', 'no-cache, no-transform');
  response.setHeader('Connection', 'keep-alive');
  for (const symbol of symbols) {
    const quote = await getQuote(symbol);
    response.write(`event: quote.update\n`);
    response.write(`data: ${JSON.stringify(realtimeEnvelope('quote.update', quote.data, { symbol, source: quote.source, isDemo: quote.source === 'demo', warnings: quote.warnings }))}\n\n`);
  }
  response.write(`event: heartbeat.ping\n`);
  response.write(`data: ${JSON.stringify(realtimeEnvelope('heartbeat.ping', { intervalMs: 15000 }, { source: 'cache' }))}\n\n`);
  response.end();
}
