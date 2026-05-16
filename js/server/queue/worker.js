import { createJobQueue, queueWorkerPlan } from './jobs.js';
import { processQueueJob, workerReadiness } from './processors.js';

const DEFAULT_POLL_MS = 2_500;

export async function runMemoryWorkerOnce({ queue = createJobQueue(), maxJobs = 10, types = [] } = {}) {
  let processed = 0;
  let failed = 0;
  const results = [];
  for (let index = 0; index < maxJobs; index += 1) {
    const queued = await queue.nextQueued?.(types);
    if (!queued) break;
    let running = null;
    try {
      running = await queue.start(queued);
      const result = await processQueueJob(running);
      const completed = await queue.complete(running, result);
      processed += 1;
      results.push(completed);
    } catch (error) {
      failed += 1;
      results.push(await queue.fail(running || queued, error));
    }
  }
  return {
    processed,
    failed,
    idle: processed + failed === 0,
    results,
  };
}

export async function runWorkerLoop({
  queue = createJobQueue(),
  pollMs = DEFAULT_POLL_MS,
  maxLoops = Infinity,
  logger = console,
  signal,
} = {}) {
  const readiness = workerReadiness();
  logger.info?.('[stockprob-worker] starting', readiness);
  let loops = 0;
  let processed = 0;
  let failed = 0;

  while (!signal?.aborted && loops < maxLoops) {
    loops += 1;
    const run = queue.kind === 'memory' ? await runMemoryWorkerOnce({ queue, maxJobs: 25 }) : await runRedisPlaceholder({ queue });
    processed += run.processed;
    failed += run.failed;
    if (run.idle) await sleep(pollMs);
  }

  const summary = { loops, processed, failed, stopped_at: new Date().toISOString() };
  logger.info?.('[stockprob-worker] stopped', summary);
  return summary;
}

export function workerStatus({ env = process.env } = {}) {
  return {
    ...workerReadiness({ env }),
    worker_plan: queueWorkerPlan(),
  };
}

async function runRedisPlaceholder({ queue }) {
  const status = await queue.status();
  return {
    processed: 0,
    failed: 0,
    idle: true,
    results: [],
    status,
    message: 'Redis queue adapter is configured; attach BullMQ Worker runtime in the deployment process.',
  };
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
