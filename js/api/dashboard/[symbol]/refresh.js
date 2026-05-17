import { enqueueJob } from '../../../src/lib/jobs.js';
import snapshotHandler from './snapshot.js';

export default async function handler(request, response) {
  await enqueueJob('prices.refresh', { symbol: request.query?.symbol || request.query?.ticker || 'MSFT' }).catch(() => null);
  request.query = { ...(request.query || {}), force: '1', refresh: '1' };
  return snapshotHandler(request, response);
}
