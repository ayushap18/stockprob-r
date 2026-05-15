import { createCompositeDataClient } from '../server/data/clients.js';
import { providerSummary } from '../server/data/resilience.js';

export default async function handler(_request, response) {
  const client = createCompositeDataClient();
  const providers = client.status();
  response.setHeader?.('Cache-Control', 'no-store');
  response.status(200).json({
    ok: true,
    service: 'stockprob-r',
    version: '1.0.0',
    providers,
    provider_summary: providerSummary(providers),
    timestamp: new Date().toISOString(),
  });
}
