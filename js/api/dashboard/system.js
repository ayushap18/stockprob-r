import { cacheStats } from '../../src/lib/cache.js';
import { getQueueStatus } from '../../src/lib/jobs.js';
import { getMemoryStatus } from '../../src/lib/memoryManager.js';
import { providerReadiness } from '../../src/lib/providers/index.js';
import { ok, fail } from '../../src/lib/responseEnvelope.js';

export default async function handler(request, response) {
  try {
    const queue = await getQueueStatus();
    return response.status(200).json(ok({
      providerHealth: providerReadiness(),
      systemHealth: {
        status: providerReadiness().some((provider) => provider.configured) ? 'ok' : 'degraded',
        db: process.env.DATABASE_URL ? 'ok' : 'unknown',
        redis: process.env.REDIS_URL ? 'ok' : 'unknown',
        queueDepth: queue.queueDepth,
        activeJobs: queue.activeJobs,
        lastCronRun: null,
        errorCount24h: 0,
      },
      memoryHealth: getMemoryStatus(cacheStats()),
    }, { source: 'cache', warnings: process.env.REDIS_URL ? [] : ['Redis not configured; memory cache active.'] }));
  } catch (error) {
    return response.status(500).json(fail(error));
  }
}
