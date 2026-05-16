import { getQueueStatus } from '../../src/lib/jobs.js';
import { ok } from '../../src/lib/responseEnvelope.js';

export default async function handler(request, response) {
  return response.status(200).json(ok(await getQueueStatus(), { source: process.env.REDIS_URL ? 'redis' : 'cache' }));
}
