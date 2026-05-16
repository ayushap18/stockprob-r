const jobs = [];
const JOB_TYPES = new Set([
  'universe.refresh',
  'prices.refresh',
  'fundamentals.refresh',
  'macro.refresh',
  'news.refresh',
  'filings.refresh',
  'features.generate',
  'probabilities.refresh',
  'backtest.run',
  'provider.healthcheck',
]);

export async function enqueueJob(type, payload = {}) {
  if (!JOB_TYPES.has(type)) throw new Error(`Unsupported job type: ${type}`);
  const job = {
    id: `job_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    type,
    payload,
    status: process.env.REDIS_URL ? 'queued' : 'recorded',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    driver: process.env.REDIS_URL ? 'redis-ready-stub' : 'memory-stub',
  };
  jobs.unshift(job);
  jobs.splice(250);
  return job;
}

export async function getQueueStatus() {
  return {
    driver: process.env.REDIS_URL ? 'redis-ready-stub' : 'memory-stub',
    redis: process.env.REDIS_URL ? 'configured' : 'not_configured',
    queueDepth: jobs.filter((job) => job.status === 'queued').length,
    activeJobs: jobs.filter((job) => job.status === 'running').length,
    counts: jobs.reduce((acc, job) => ({ ...acc, [job.status]: (acc[job.status] || 0) + 1 }), {}),
    recentJobs: jobs.slice(0, 20),
  };
}

export async function getJobStatus(id) {
  return jobs.find((job) => job.id === id) || null;
}
