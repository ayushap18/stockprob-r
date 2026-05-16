import { cacheStats } from '../../src/lib/cache.js';
import { getQueueStatus } from '../../src/lib/jobs.js';
import { ok } from '../../src/lib/responseEnvelope.js';

export default async function handler(request, response) {
  const queue = await getQueueStatus();
  const data = {
    status: process.env.DATABASE_URL || process.env.REDIS_URL ? 'ok' : 'degraded',
    db: process.env.DATABASE_URL ? 'ok' : 'unknown',
    redis: process.env.REDIS_URL ? 'ok' : 'unknown',
    queueDepth: queue.queueDepth,
    lastCronRun: null,
    activeJobs: queue.activeJobs,
    errorCount24h: 0,
    cache: cacheStats(),
  };
  return response.status(200).json(ok(data, { source: 'cache', warnings: process.env.REDIS_URL ? [] : ['Redis not configured; using memory cache and local queue stubs.'] }));
}
