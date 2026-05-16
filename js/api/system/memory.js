import { cacheStats } from '../../src/lib/cache.js';
import { getMemoryStatus } from '../../src/lib/memoryManager.js';
import { ok, fail } from '../../src/lib/responseEnvelope.js';

export default async function handler(request, response) {
  try {
    return response.status(200).json(ok(getMemoryStatus(cacheStats()), {
      source: 'cache',
      warnings: process.env.REDIS_URL ? [] : ['Redis not configured; memory cache active.'],
    }));
  } catch (error) {
    return response.status(500).json(fail(error));
  }
}
