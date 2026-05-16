import { cacheStats } from '../../src/lib/cache.js';
import { getQueueStatus } from '../../src/lib/jobs.js';
import { realtimeEnvelope } from '../../src/lib/responseEnvelope.js';

export default async function handler(request, response) {
  const queue = await getQueueStatus();
  response.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
  response.setHeader('Cache-Control', 'no-cache, no-transform');
  response.setHeader('Connection', 'keep-alive');
  response.write(`event: system.health\n`);
  response.write(`data: ${JSON.stringify(realtimeEnvelope('system.health', {
    status: process.env.DATABASE_URL || process.env.REDIS_URL ? 'ok' : 'degraded',
    db: process.env.DATABASE_URL ? 'ok' : 'unknown',
    redis: process.env.REDIS_URL ? 'ok' : 'unknown',
    queueDepth: queue.queueDepth,
    lastCronRun: null,
    activeJobs: queue.activeJobs,
    errorCount24h: 0,
    cache: cacheStats(),
  }, { source: 'cache', warnings: process.env.REDIS_URL ? [] : ['Redis not configured; memory fallback active.'] }))}\n\n`);
  response.end();
}
