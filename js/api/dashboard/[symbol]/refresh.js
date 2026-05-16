import { enqueueJob } from '../../../src/lib/jobs.js';
import snapshotHandler from './snapshot.js';

export default async function handler(request, response) {
  await enqueueJob('prices.refresh', { symbol: request.query?.symbol || request.query?.ticker || 'MSFT' }).catch(() => null);
  return snapshotHandler(request, response);
}
