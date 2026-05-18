import { cacheStats } from '../../src/lib/cache.js';
import { getMemoryStatus } from '../../src/lib/memoryManager.js';
import { ok } from '../../src/lib/responseEnvelope.js';

export default async function handler(request, response) {
  const memory = getMemoryStatus(cacheStats());
  const warnings = Array.isArray(memory.warnings) ? memory.warnings : [];
  return response.status(200).json(ok(memory, {
    source: process.env.REDIS_URL ? 'redis' : 'cache',
    warnings,
  }));
}
