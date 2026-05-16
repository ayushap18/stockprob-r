import { providerReadiness } from '../../src/lib/providers/index.js';
import { realtimeEnvelope } from '../../src/lib/responseEnvelope.js';

export default async function handler(request, response) {
  response.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
  response.setHeader('Cache-Control', 'no-cache, no-transform');
  response.setHeader('Connection', 'keep-alive');
  response.write(`event: provider.health\n`);
  response.write(`data: ${JSON.stringify(realtimeEnvelope('provider.health', providerReadiness(), { source: 'cache' }))}\n\n`);
  response.end();
}
