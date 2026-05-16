import { ok } from '../../src/lib/responseEnvelope.js';

export default async function handler(request, response) {
  return response.status(200).json(ok({
    quotes: 'cache-first ttl 5-60s',
    ohlcv: 'cache-first ttl 1-6h',
    fundamentals: 'cache-first ttl 12-24h',
    news: 'cache-first ttl 15-60m',
    macro: 'cache-first ttl 12-24h',
    probabilities: 'cache-first ttl 30-120s',
  }, { source: 'cache' }));
}
