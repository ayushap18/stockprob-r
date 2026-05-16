#!/usr/bin/env node
import { createJobQueue } from './jobs.js';
import { runWorkerLoop, workerStatus } from './worker.js';

const once = process.argv.includes('--once');
const statusOnly = process.argv.includes('--status');
const pollMs = numberArg('--poll-ms', 2_500);
const maxLoops = once ? 1 : numberArg('--max-loops', Infinity);

if (statusOnly) {
  console.log(JSON.stringify(workerStatus(), null, 2));
  process.exit(0);
}

const controller = new AbortController();
process.on('SIGINT', () => controller.abort());
process.on('SIGTERM', () => controller.abort());

runWorkerLoop({
  queue: createJobQueue(),
  pollMs,
  maxLoops,
  signal: controller.signal,
}).catch((error) => {
  console.error('[stockprob-worker] fatal', error);
  process.exit(1);
});

function numberArg(name, fallback) {
  const index = process.argv.indexOf(name);
  if (index === -1 || index + 1 >= process.argv.length) return fallback;
  const value = Number(process.argv[index + 1]);
  return Number.isFinite(value) ? value : fallback;
}
