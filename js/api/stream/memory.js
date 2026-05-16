import memoryHandler from '../system/memory.js';
import { realtimeEnvelope } from '../../src/lib/responseEnvelope.js';

export default async function handler(request, response) {
  const capture = await captureJson(request, memoryHandler);
  response.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
  response.setHeader('Cache-Control', 'no-cache, no-transform');
  response.setHeader('Connection', 'keep-alive');
  response.write('event: memory.health\n');
  response.write(`data: ${JSON.stringify(realtimeEnvelope('memory.health', capture.data || {}, { source: capture.meta?.source || 'cache', isDemo: capture.meta?.isDemo, warnings: capture.meta?.warnings || [] }))}\n\n`);
  response.end();
}

async function captureJson(request, handler) {
  let payload = {};
  const response = { setHeader() {}, status() { return this; }, json(value) { payload = value; return this; } };
  await handler(request, response);
  return payload;
}
