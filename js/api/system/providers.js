import { providerReadiness } from '../../src/lib/providers/index.js';
import { ok } from '../../src/lib/responseEnvelope.js';

export default async function handler(request, response) {
  return response.status(200).json(ok(providerReadiness(), { source: 'cache' }));
}
