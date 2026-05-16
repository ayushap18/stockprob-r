import { createCompositeDataClient } from '../server/data/clients.js';
import { cacheStats, providerSummary } from '../server/data/resilience.js';
import { infrastructureReadiness, requiredProviderPlan } from '../server/config/infrastructure.js';
import { createJobQueue, queueWorkerPlan } from '../server/queue/jobs.js';
import { workerStatus } from '../server/queue/worker.js';
import { createStorageAdapter, storageSchemaPlan } from '../server/storage/store.js';

export default async function handler(request, response) {
  const client = createCompositeDataClient();
  const providers = client.status();
  const storage = request.storage || createStorageAdapter();
  const storageStatus = await storage.status();
  const queue = request.queue || createJobQueue();
  const queueStatus = await queue.status();
  const infrastructure = infrastructureReadiness({ cacheStats: cacheStats() });
  response.setHeader?.('Cache-Control', 'no-store');
  response.status(200).json({
    ok: true,
    service: 'stockprob-r',
    version: '1.0.0',
    providers,
    provider_summary: providerSummary(providers),
    infrastructure,
    storage: {
      ...storageStatus,
      schema_plan: storageSchemaPlan(),
    },
    queue: {
      ...queueStatus,
      worker_plan: queueWorkerPlan(),
      worker_status: workerStatus(),
    },
    required_provider_plan: requiredProviderPlan(),
    timestamp: new Date().toISOString(),
  });
  await storage.saveProviderSnapshot({
    provider_summary: providerSummary(providers),
    providers,
    infrastructure,
  }).catch(() => null);
}
