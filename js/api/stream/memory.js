import { cacheStats } from '../../src/lib/cache.js';
import { getMemoryStatus } from '../../src/lib/memoryManager.js';
import { realtimeEnvelope } from '../../src/lib/responseEnvelope.js';

export default async function handler(request, response) {
  const memory = getMemoryStatus(cacheStats());
  response.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
  response.setHeader('Cache-Control', 'no-cache, no-transform');
  response.setHeader('Connection', 'keep-alive');
  response.write('event: memory.health\n');
  response.write(`data: ${JSON.stringify(realtimeEnvelope('memory.health', memory, { source: process.env.REDIS_URL ? 'redis' : 'cache', warnings: memory.warnings || [] }))}\n\n`);
  response.write('event: heartbeat.ping\n');
  response.write(`data: ${JSON.stringify(realtimeEnvelope('heartbeat.ping', { intervalMs: 30000 }, { source: 'cache' }))}\n\n`);
  response.end();
}
