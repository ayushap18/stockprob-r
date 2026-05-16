const memoryState = {
  jobs: [],
};

const MAX_MEMORY_JOBS = 500;
const VALID_STATUSES = new Set(['queued', 'running', 'completed', 'failed', 'cancelled']);

export function createJobQueue({ env = process.env } = {}) {
  if (env.REDIS_URL) return new RedisQueueAdapter({ redisUrl: env.REDIS_URL });
  return new MemoryJobQueueAdapter();
}

export class MemoryJobQueueAdapter {
  constructor() {
    this.kind = 'memory';
    this.distributed = false;
  }

  async status() {
    return {
      kind: this.kind,
      status: 'fallback',
      distributed: false,
      message: 'Using in-process memory queue. Configure REDIS_URL and a worker process for durable distributed jobs.',
      counts: countJobs(memoryState.jobs),
      recent_jobs: await this.recentJobs(8),
    };
  }

  async enqueue(type, payload = {}, options = {}) {
    const job = normalizeJob({
      type,
      payload,
      priority: normalizePriority(options.priority),
      max_attempts: positiveInteger(options.maxAttempts || options.max_attempts, 1),
      mode: this.kind,
    });
    pushBounded(memoryState.jobs, job);
    return { ...job };
  }

  async start(jobOrId) {
    return updateJob(jobOrId, {
      status: 'running',
      started_at: new Date().toISOString(),
      attempts: (findJob(jobOrId)?.attempts || 0) + 1,
    });
  }

  async complete(jobOrId, result = {}) {
    return updateJob(jobOrId, {
      status: 'completed',
      completed_at: new Date().toISOString(),
      result,
      error: null,
    });
  }

  async fail(jobOrId, error) {
    return updateJob(jobOrId, {
      status: 'failed',
      failed_at: new Date().toISOString(),
      error: normalizeError(error),
    });
  }

  async cancel(jobOrId, reason = 'JOB_CANCELLED') {
    return updateJob(jobOrId, {
      status: 'cancelled',
      cancelled_at: new Date().toISOString(),
      error: { code: 'JOB_CANCELLED', message: reason },
    });
  }

  async recentJobs(limit = 25) {
    return memoryState.jobs.slice(-positiveInteger(limit, 25)).reverse().map(summarizeJob);
  }

  async nextQueued(types = []) {
    const allowed = new Set((Array.isArray(types) ? types : [types]).filter(Boolean));
    const job = memoryState.jobs.find((candidate) => candidate.status === 'queued' && (!allowed.size || allowed.has(candidate.type)));
    return job ? { ...job } : null;
  }
}

export class RedisQueueAdapter {
  constructor({ redisUrl }) {
    this.kind = 'redis';
    this.distributed = true;
    this.redisUrl = redisUrl;
  }

  async status() {
    return {
      kind: this.kind,
      status: 'configured',
      distributed: true,
      message: 'REDIS_URL is configured. Install and run the BullMQ worker package to execute durable jobs.',
      queues: queueWorkerPlan().queues.map(({ name, concurrency, rate_limit_per_minute }) => ({ name, concurrency, rate_limit_per_minute })),
    };
  }

  async enqueue(type, payload = {}, options = {}) {
    return normalizeJob({
      type,
      payload,
      priority: normalizePriority(options.priority),
      max_attempts: positiveInteger(options.maxAttempts || options.max_attempts, 3),
      mode: this.kind,
      skipped: 'redis_driver_not_installed',
    });
  }

  async start(jobOrId) {
    return normalizeExternalJob(jobOrId, { status: 'running', mode: this.kind });
  }

  async complete(jobOrId, result = {}) {
    return normalizeExternalJob(jobOrId, { status: 'completed', result, mode: this.kind });
  }

  async fail(jobOrId, error) {
    return normalizeExternalJob(jobOrId, { status: 'failed', error: normalizeError(error), mode: this.kind });
  }

  async cancel(jobOrId, reason = 'JOB_CANCELLED') {
    return normalizeExternalJob(jobOrId, { status: 'cancelled', error: { code: 'JOB_CANCELLED', message: reason }, mode: this.kind });
  }

  async recentJobs() {
    return [];
  }

  async nextQueued() {
    return null;
  }
}

export function queueWorkerPlan() {
  return {
    driver: 'BullMQ-compatible Redis queue',
    queues: [
      { name: 'analysis', concurrency: 12, rate_limit_per_minute: 240, emits: ['analysis.progress', 'analysis.result', 'analysis.failed'] },
      { name: 'rank', concurrency: 6, rate_limit_per_minute: 90, emits: ['rank.item', 'rank.leaderboard', 'rank.complete'] },
      { name: 'backtest', concurrency: 2, rate_limit_per_minute: 12, emits: ['backtest.progress', 'backtest.trade', 'backtest.metrics'] },
      { name: 'provider-refresh', concurrency: 4, rate_limit_per_minute: 120, emits: ['provider.status'] },
      { name: 'model-training', concurrency: 1, rate_limit_per_minute: 4, emits: ['analysis.progress', 'analysis.result'] },
    ],
    message_types: [
      'analysis.start',
      'analysis.progress',
      'analysis.partial',
      'analysis.result',
      'analysis.failed',
      'analysis.cancelled',
      'rank.start',
      'rank.item',
      'rank.leaderboard',
      'rank.complete',
      'rank.failed',
      'backtest.start',
      'backtest.progress',
      'backtest.trade',
      'backtest.metrics',
      'backtest.complete',
      'provider.status',
      'server.metrics',
    ],
  };
}

export function resetMemoryQueue() {
  memoryState.jobs.length = 0;
}

export function summarizeJob(job = {}) {
  return {
    id: job.id,
    type: job.type,
    status: job.status,
    mode: job.mode,
    priority: job.priority,
    attempts: job.attempts,
    max_attempts: job.max_attempts,
    created_at: job.created_at,
    updated_at: job.updated_at,
    started_at: job.started_at,
    completed_at: job.completed_at,
    failed_at: job.failed_at,
    cancelled_at: job.cancelled_at,
    result: job.result || null,
    error: job.error || null,
    skipped: job.skipped,
  };
}

function normalizeJob(record = {}) {
  const now = new Date().toISOString();
  return {
    id: record.id || `${record.type || 'job'}-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    type: String(record.type || 'analysis'),
    status: VALID_STATUSES.has(record.status) ? record.status : 'queued',
    payload: record.payload || {},
    priority: normalizePriority(record.priority),
    attempts: positiveInteger(record.attempts, 0),
    max_attempts: positiveInteger(record.max_attempts, 1),
    mode: record.mode || 'memory',
    created_at: record.created_at || now,
    updated_at: record.updated_at || now,
    result: record.result || null,
    error: record.error || null,
    skipped: record.skipped,
  };
}

function normalizeExternalJob(jobOrId, patch = {}) {
  const base = typeof jobOrId === 'string' ? { id: jobOrId, type: 'external' } : jobOrId || {};
  return summarizeJob(normalizeJob({ ...base, ...patch, updated_at: new Date().toISOString() }));
}

function updateJob(jobOrId, patch) {
  const existing = findJob(jobOrId);
  if (!existing) {
    return summarizeJob(normalizeJob({ ...(typeof jobOrId === 'object' ? jobOrId : { id: jobOrId }), ...patch }));
  }
  Object.assign(existing, patch, { updated_at: new Date().toISOString() });
  return { ...existing };
}

function findJob(jobOrId) {
  const id = typeof jobOrId === 'string' ? jobOrId : jobOrId?.id;
  return memoryState.jobs.find((job) => job.id === id);
}

function countJobs(jobs) {
  return jobs.reduce(
    (counts, job) => {
      counts.total += 1;
      counts[job.status] = (counts[job.status] || 0) + 1;
      return counts;
    },
    { total: 0, queued: 0, running: 0, completed: 0, failed: 0, cancelled: 0 }
  );
}

function normalizeError(error) {
  if (!error) return { code: 'UNKNOWN', message: 'Unknown job failure' };
  return {
    code: error.code || 'JOB_FAILED',
    message: error.message || String(error),
  };
}

function normalizePriority(priority) {
  return Math.max(1, Math.min(10, positiveInteger(priority, 5)));
}

function positiveInteger(value, fallback) {
  const numeric = Number(value);
  return Number.isFinite(numeric) && numeric >= 0 ? Math.floor(numeric) : fallback;
}

function pushBounded(collection, record) {
  collection.push(record);
  while (collection.length > MAX_MEMORY_JOBS) collection.shift();
}
