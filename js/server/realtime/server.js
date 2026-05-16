import { pathToFileURL } from 'node:url';
import { WebSocketServer } from 'ws';
import { predictOutperformance, rankUniverse } from '../models/predict.js';
import { searchListedUniverse } from '../data/universe.js';
import { runWalkForwardBacktest } from '../backtesting/backtest.js';
import {
  createRealtimeMessage,
  parseRealtimeEnvelope,
  validateRankRequest,
  validateRealtimeRequest,
  validateUniverseSearch,
} from './protocol.js';

const DEFAULT_PORT = 8091;
const HEARTBEAT_MS = 25_000;
const MAX_MESSAGE_BYTES = 64_000;
const DEFAULT_RANK_CONCURRENCY = 4;
const activeRequests = new Map();
const watchlistSubscriptions = new Map();
const blankAgentThreads = new Map();
const metrics = {
  activeSockets: 0,
  completedJobs: 0,
  failedJobs: 0,
  totalLatencyMs: 0,
  providerEvents: [],
};

const ERROR_CODES = {
  INVALID_MESSAGE: 'INVALID_MESSAGE',
  INVALID_TICKER: 'INVALID_TICKER',
  RATE_LIMITED: 'RATE_LIMITED',
  PROVIDER_FAILED: 'PROVIDER_FAILED',
  INSUFFICIENT_HISTORY: 'INSUFFICIENT_HISTORY',
  JOB_CANCELLED: 'JOB_CANCELLED',
  TIMEOUT: 'TIMEOUT',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
};

export async function handleRealtimeMessage(raw, options = {}) {
  const { send, dataClient } = options;
  const emit = (type, payload, requestId) => send?.(createRealtimeMessage(type, payload, requestId));
  let envelope;
  try {
    if (messageSize(raw) > MAX_MESSAGE_BYTES) throw new Error('message exceeds realtime payload limit');
    envelope = parseRealtimeEnvelope(raw);
    if (['ping', 'heartbeat.ping'].includes(envelope.type)) {
      emit('pong', { ok: true }, envelope.requestId);
      return emit('heartbeat.pong', { ok: true }, envelope.requestId);
    }
    if (envelope.type === 'cancel') return handleCancel(envelope, emit);
    if (envelope.type === 'metrics') return emit('server.metrics', realtimeMetrics(), envelope.requestId);
    if (envelope.type === 'analyze') return await handleAnalyze(envelope, emit, dataClient, options);
    if (envelope.type === 'rank') return await handleRank(envelope, emit, dataClient, options);
    if (envelope.type === 'universe.search') return await handleUniverseSearch(envelope, emit, options);
    if (envelope.type === 'watchlist.subscribe') return await handleWatchlistSubscribe(envelope, emit, dataClient, options);
    if (envelope.type === 'watchlist.unsubscribe') return handleWatchlistUnsubscribe(envelope, emit);
    if (envelope.type === 'backtest') return await handleBacktest(envelope, emit, options);
    if (envelope.type === 'agent.blank') return handleBlankAgent(envelope, emit);
    throw new Error(`unsupported realtime message type: ${envelope.type}`);
  } catch (error) {
    recordFailure();
    emit('error', formatRealtimeError(error), envelope?.requestId || null);
    return null;
  }
}

export function startRealtimeServer({
  port = Number(process.env.REALTIME_PORT || DEFAULT_PORT),
  dataClient,
  host = process.env.REALTIME_HOST || '127.0.0.1',
  rateLimiter = createRateLimiter({ maxEvents: Number(process.env.REALTIME_RATE_LIMIT || 90), windowMs: 60_000 }),
} = {}) {
  const wss = new WebSocketServer({ port, host, maxPayload: MAX_MESSAGE_BYTES });

  wss.on('connection', (socket, request) => {
    socket.isAlive = true;
    const connectionRequests = new Set();
    const clientId = request.socket.remoteAddress || 'unknown';
    const send = (message) => {
      if (socket.readyState === socket.OPEN) socket.send(JSON.stringify(message));
    };
    metrics.activeSockets += 1;
    send(createRealtimeMessage('ready', {
      service: 'stockprob-r-realtime',
      protocol: ['analyze', 'rank', 'universe.search', 'watchlist.subscribe', 'watchlist.unsubscribe', 'backtest', 'agent.blank', 'cancel', 'ping', 'metrics'],
      limits: { max_message_bytes: MAX_MESSAGE_BYTES, rank_concurrency: DEFAULT_RANK_CONCURRENCY },
    }));
    send(createRealtimeMessage('connection.ready', {
      service: 'stockprob-r-realtime',
      protocol_version: '2026-05-16',
    }));
    socket.on('pong', () => {
      socket.isAlive = true;
    });
    socket.on('message', (message) => {
      if (!rateLimiter.allow(clientId)) {
        send(createRealtimeMessage('error', { code: ERROR_CODES.RATE_LIMITED, message: 'rate limit exceeded', status: 429 }));
        return;
      }
      handleRealtimeMessage(message.toString(), { send, dataClient, connectionRequests });
    });
    socket.on('close', () => {
      metrics.activeSockets = Math.max(0, metrics.activeSockets - 1);
      for (const requestId of connectionRequests) {
        const tracker = activeRequests.get(requestId);
        if (tracker) tracker.cancelled = true;
      }
    });
    socket.on('error', (error) => {
      send(createRealtimeMessage('error', { message: error.message }));
    });
  });

  const interval = setInterval(() => {
    for (const socket of wss.clients) {
      if (!socket.isAlive) {
        socket.terminate();
        continue;
      }
      socket.isAlive = false;
      socket.ping();
    }
  }, HEARTBEAT_MS);

  wss.on('close', () => clearInterval(interval));
  return wss;
}

async function handleAnalyze(envelope, emit, dataClient, options = {}) {
  const request = validateRealtimeRequest(envelope.payload);
  const tracker = trackRequest(envelope.requestId, 'analyze', options.connectionRequests);
  const predictFn = options.predictFn || predictOutperformance;
  const startedAt = Date.now();
  try {
    emit('analysis.started', request, envelope.requestId);
    emit('analysis.start', request, envelope.requestId);
    emitAnalysisProgress(emit, envelope.requestId, request, 'fetching_prices', 0.1);
    emitProviderStatus(emit, envelope.requestId, 'market', 'fetching_prices');
    emitAnalysisProgress(emit, envelope.requestId, request, 'fetching_spy', 0.22);
    emitProviderStatus(emit, envelope.requestId, 'market', 'fetching_spy');
    emitAnalysisProgress(emit, envelope.requestId, request, 'fetching_news', 0.34);
    emitProviderStatus(emit, envelope.requestId, 'news', 'fetching_news');
    emitAnalysisProgress(emit, envelope.requestId, request, 'fetching_fundamentals', 0.46);
    emitProviderStatus(emit, envelope.requestId, 'fundamentals', 'fetching_fundamentals');
    emitAnalysisProgress(emit, envelope.requestId, request, 'calculating_features', 0.62);
    emitAnalysisProgress(emit, envelope.requestId, request, 'running_model', 0.82);
    const result = await predictFn({ ...request, dataClient });
    if (tracker.cancelled) {
      emit('analysis.cancelled', { request_id: envelope.requestId, ticker: request.ticker }, envelope.requestId);
      return null;
    }
    emitAnalysisProgress(emit, envelope.requestId, request, 'complete', 1);
    emit('analysis.result', result, envelope.requestId);
    recordCompletion(startedAt);
    return result;
  } catch (error) {
    recordFailure();
    emit('analysis.failed', { ...request, ...formatRealtimeError(error) }, envelope.requestId);
    throw error;
  } finally {
    activeRequests.delete(envelope.requestId);
    options.connectionRequests?.delete(envelope.requestId);
  }
}

async function handleRank(envelope, emit, dataClient, options = {}) {
  const request = validateRankRequest(envelope.payload);
  const tracker = trackRequest(envelope.requestId, 'rank', options.connectionRequests);
  const predictFn = options.predictFn || predictOutperformance;
  const concurrency = Number(options.rankConcurrency || DEFAULT_RANK_CONCURRENCY);
  const startedAt = Date.now();
  try {
    emit('rank.started', { horizon: request.horizon, requested: request.tickers.length }, envelope.requestId);
    emit('rank.start', { horizon: request.horizon, requested: request.tickers.length, concurrency }, envelope.requestId);
    const liveResults = [];
    const predictions = await mapWithConcurrency(request.tickers, concurrency, async (ticker, index) => {
      if (tracker.cancelled) return { ticker, error: 'cancelled', signal: 'avoid', warnings: ['Realtime rank request cancelled'] };
      try {
        const item = await predictFn({ ticker, horizon: request.horizon, dataClient });
        liveResults.push(item);
        emit('rank.item', { progress: (index + 1) / request.tickers.length, ...item }, envelope.requestId);
        emit('rank.leaderboard', { rankings: rankResults(liveResults).slice(0, request.limit), completed: liveResults.length, total: request.tickers.length }, envelope.requestId);
        return item;
      } catch (error) {
        const item = { ticker, error: error.message, error_code: errorCodeFor(error), signal: 'avoid', warnings: [error.message] };
        liveResults.push(item);
        emit('rank.item', { progress: (index + 1) / request.tickers.length, ...item }, envelope.requestId);
        emit('rank.leaderboard', { rankings: rankResults(liveResults).slice(0, request.limit), completed: liveResults.length, total: request.tickers.length }, envelope.requestId);
        return item;
      }
    });
    const rankings = rankResults(predictions).slice(0, request.limit);
    if (tracker.cancelled) {
      emit('rank.cancelled', { request_id: envelope.requestId, count: rankings.length }, envelope.requestId);
      return rankings;
    }
    rankings.forEach((item, index) => {
      emit('rank.item', { rank: index + 1, ...item }, envelope.requestId);
    });
    emit('rank.complete', { horizon: `${Number(request.horizon)}d`, count: rankings.length, rankings }, envelope.requestId);
    recordCompletion(startedAt);
    return rankings;
  } catch (error) {
    recordFailure();
    emit('rank.failed', formatRealtimeError(error), envelope.requestId);
    throw error;
  } finally {
    activeRequests.delete(envelope.requestId);
    options.connectionRequests?.delete(envelope.requestId);
  }
}

async function handleUniverseSearch(envelope, emit, options = {}) {
  const request = validateUniverseSearch(envelope.payload);
  const searchFn = options.searchFn || searchListedUniverse;
  const payload = await searchFn(request);
  emit('universe.results', payload, envelope.requestId);
  return payload;
}

function handleCancel(envelope, emit) {
  const requestId = envelope.payload?.request_id || envelope.payload?.id || envelope.requestId;
  const tracker = activeRequests.get(requestId);
  if (tracker) tracker.cancelled = true;
  emit('cancel.accepted', { request_id: requestId, found: Boolean(tracker) }, envelope.requestId);
  if (tracker) emit(`${tracker.type}.cancelled`, { request_id: requestId, code: ERROR_CODES.JOB_CANCELLED }, requestId);
  return tracker || null;
}

function trackRequest(requestId, type, connectionRequests) {
  const tracker = { type, startedAt: Date.now(), cancelled: false };
  activeRequests.set(requestId, tracker);
  connectionRequests?.add(requestId);
  return tracker;
}

export function realtimeMetrics() {
  return {
    active_sockets: metrics.activeSockets,
    active_jobs: activeRequests.size,
    active_requests: activeRequests.size,
    queue_depth: 0,
    avg_latency_ms: metrics.completedJobs ? Math.round(metrics.totalLatencyMs / metrics.completedJobs) : 0,
    error_rate: metrics.completedJobs + metrics.failedJobs ? Number((metrics.failedJobs / (metrics.completedJobs + metrics.failedJobs)).toFixed(4)) : 0,
    provider_latency: providerLatencySummary(),
    requests: [...activeRequests.entries()].map(([requestId, tracker]) => ({
      request_id: requestId,
      type: tracker.type,
      age_ms: Date.now() - tracker.startedAt,
      cancelled: tracker.cancelled,
    })),
  };
}

async function handleWatchlistSubscribe(envelope, emit, dataClient, options = {}) {
  const request = validateRankRequest(envelope.payload);
  const subscriptionId = envelope.requestId;
  const minIntervalMs = Number(options.minWatchlistIntervalMs || 10);
  const intervalMs = Math.max(minIntervalMs, Number(envelope.payload?.interval_ms || 60_000));
  const predictFn = options.predictFn || predictOutperformance;
  const state = { last: new Map(), stopped: false };
  watchlistSubscriptions.set(subscriptionId, state);

  emit('watchlist.subscribe', { subscription_id: subscriptionId, tickers: request.tickers, interval_ms: intervalMs }, envelope.requestId);
  const snapshot = await runWatchlistCycle({ request, predictFn, dataClient, state, emit, requestId: envelope.requestId, snapshot: true });
  emit('watchlist.snapshot', { subscription_id: subscriptionId, results: snapshot }, envelope.requestId);

  const timer = setInterval(() => {
    runWatchlistCycle({ request, predictFn, dataClient, state, emit, requestId: envelope.requestId, snapshot: false }).catch((error) => {
      emit('error', formatRealtimeError(error), envelope.requestId);
    });
  }, intervalMs);
  state.timer = timer;
  return state;
}

function handleWatchlistUnsubscribe(envelope, emit) {
  const subscriptionId = envelope.payload?.subscription_id || envelope.requestId;
  const state = watchlistSubscriptions.get(subscriptionId);
  if (state?.timer) clearInterval(state.timer);
  if (state) state.stopped = true;
  watchlistSubscriptions.delete(subscriptionId);
  emit('watchlist.unsubscribe', { subscription_id: subscriptionId, found: Boolean(state) }, envelope.requestId);
  return state || null;
}

async function runWatchlistCycle({ request, predictFn, dataClient, state, emit, requestId, snapshot }) {
  const results = [];
  for (const ticker of request.tickers) {
    if (state.stopped) break;
    const result = await predictFn({ ticker, horizon: request.horizon, dataClient });
    results.push(result);
    const previous = state.last.get(ticker);
    const changed = !previous || previous.signal !== result.signal || Math.abs(Number(previous.probability_outperform_spy || 0) - Number(result.probability_outperform_spy || 0)) >= 0.02;
    state.last.set(ticker, result);
    if (!snapshot && changed) emit('watchlist.update', { subscription_id: requestId, ticker, previous, current: result }, requestId);
  }
  return results;
}

async function handleBacktest(envelope, emit, options = {}) {
  const backtestFn = options.backtestFn || runWalkForwardBacktest;
  const payload = envelope.payload || {};
  const startedAt = Date.now();
  emit('backtest.start', { universe: payload.universe || [], horizon: payload.horizon || 5 }, envelope.requestId);
  emit('backtest.progress', { step: 'loading_history', progress: 0.15 }, envelope.requestId);
  emit('backtest.progress', { step: 'walk_forward', progress: 0.5 }, envelope.requestId);
  const result = await backtestFn(payload);
  for (const trade of result.trades || []) emit('backtest.trade', trade, envelope.requestId);
  emit('backtest.metrics', result.metrics || {}, envelope.requestId);
  emit('backtest.progress', { step: 'complete', progress: 1 }, envelope.requestId);
  emit('backtest.complete', result, envelope.requestId);
  recordCompletion(startedAt);
  return result;
}

function handleBlankAgent(envelope, emit) {
  const threadId = envelope.payload?.thread_id || envelope.requestId;
  const message = String(envelope.payload?.message || '').slice(0, 4_000);
  const thread = blankAgentThreads.get(threadId) || [];
  thread.push({ role: 'user', content: message, timestamp: new Date().toISOString() });
  const response = {
    role: 'agent',
    thread_id: threadId,
    content: 'Blank realtime agent ready. I can hold this thread and echo operational notes, but I do not generate trading advice.',
  };
  thread.push({ ...response, timestamp: new Date().toISOString() });
  blankAgentThreads.set(threadId, thread.slice(-50));
  emit('agent.blank.message', response, envelope.requestId);
  return response;
}

function emitAnalysisProgress(emit, requestId, request, step, progress) {
  emit('analysis.progress', { ...request, step, progress }, requestId);
}

function emitProviderStatus(emit, requestId, provider, stage, status = 'online') {
  const event = { provider, stage, status, latency_ms: 0 };
  metrics.providerEvents.push({ ...event, timestamp: Date.now() });
  metrics.providerEvents = metrics.providerEvents.slice(-100);
  emit('provider.status', event, requestId);
}

function rankResults(results) {
  return [...results].sort((first, second) => (second.alpha_score ?? -1) - (first.alpha_score ?? -1));
}

function formatRealtimeError(error) {
  return {
    code: errorCodeFor(error),
    message: error.message || 'Realtime request failed',
    status: error.status || statusForError(error),
    details: error.details || null,
  };
}

function errorCodeFor(error) {
  if (error.code) return error.code;
  if (/ticker/i.test(error.message || '')) return ERROR_CODES.INVALID_TICKER;
  if (/rate limit/i.test(error.message || '')) return ERROR_CODES.RATE_LIMITED;
  if (/provider|fetch|HTTP/i.test(error.message || '')) return ERROR_CODES.PROVIDER_FAILED;
  if (/insufficient/i.test(error.message || '')) return ERROR_CODES.INSUFFICIENT_HISTORY;
  if (/timeout/i.test(error.message || '')) return ERROR_CODES.TIMEOUT;
  if (/JSON|message|unsupported/i.test(error.message || '')) return ERROR_CODES.INVALID_MESSAGE;
  return ERROR_CODES.INTERNAL_ERROR;
}

function statusForError(error) {
  if (error.status) return error.status;
  if (errorCodeFor(error) === ERROR_CODES.INVALID_TICKER || errorCodeFor(error) === ERROR_CODES.INVALID_MESSAGE) return 400;
  if (errorCodeFor(error) === ERROR_CODES.RATE_LIMITED) return 429;
  if (errorCodeFor(error) === ERROR_CODES.INSUFFICIENT_HISTORY || errorCodeFor(error) === ERROR_CODES.PROVIDER_FAILED) return 503;
  return 500;
}

function recordCompletion(startedAt) {
  metrics.completedJobs += 1;
  metrics.totalLatencyMs += Date.now() - startedAt;
}

function recordFailure() {
  metrics.failedJobs += 1;
}

function providerLatencySummary() {
  const providers = {};
  for (const event of metrics.providerEvents) {
    providers[event.provider] ||= { count: 0, avg_latency_ms: 0, status: event.status };
    providers[event.provider].count += 1;
    providers[event.provider].avg_latency_ms = Math.round((providers[event.provider].avg_latency_ms * (providers[event.provider].count - 1) + event.latency_ms) / providers[event.provider].count);
    providers[event.provider].status = event.status;
  }
  return providers;
}

export function createRateLimiter({ maxEvents = 90, windowMs = 60_000 } = {}) {
  const buckets = new Map();
  return {
    allow(key = 'default') {
      const now = Date.now();
      const bucket = (buckets.get(key) || []).filter((timestamp) => now - timestamp < windowMs);
      if (bucket.length >= maxEvents) {
        buckets.set(key, bucket);
        return false;
      }
      bucket.push(now);
      buckets.set(key, bucket);
      return true;
    },
  };
}

export async function mapWithConcurrency(items, concurrency, mapper) {
  const results = new Array(items.length);
  let cursor = 0;
  const workerCount = Math.max(1, Math.min(Number(concurrency) || 1, items.length || 1));
  await Promise.all(
    Array.from({ length: workerCount }, async () => {
      while (cursor < items.length) {
        const index = cursor;
        cursor += 1;
        results[index] = await mapper(items[index], index);
      }
    })
  );
  return results;
}

function messageSize(raw) {
  if (typeof raw === 'string') return Buffer.byteLength(raw);
  if (Buffer.isBuffer(raw)) return raw.length;
  return Buffer.byteLength(JSON.stringify(raw || {}));
}

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  const server = startRealtimeServer();
  server.on('listening', () => {
    const address = server.address();
    console.log(`StockProb-R realtime WebSocket server listening on ws://localhost:${address.port}`);
  });
}
