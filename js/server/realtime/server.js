import { pathToFileURL } from 'node:url';
import { WebSocketServer } from 'ws';
import { predictOutperformance, rankUniverse } from '../models/predict.js';
import { searchListedUniverse } from '../data/universe.js';
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

export async function handleRealtimeMessage(raw, options = {}) {
  const { send, dataClient } = options;
  const emit = (type, payload, requestId) => send?.(createRealtimeMessage(type, payload, requestId));
  let envelope;
  try {
    if (messageSize(raw) > MAX_MESSAGE_BYTES) throw new Error('message exceeds realtime payload limit');
    envelope = parseRealtimeEnvelope(raw);
    if (envelope.type === 'ping') return emit('pong', { ok: true }, envelope.requestId);
    if (envelope.type === 'cancel') return handleCancel(envelope, emit);
    if (envelope.type === 'metrics') return emit('server.metrics', realtimeMetrics(), envelope.requestId);
    if (envelope.type === 'analyze') return await handleAnalyze(envelope, emit, dataClient, options);
    if (envelope.type === 'rank') return await handleRank(envelope, emit, dataClient, options);
    if (envelope.type === 'universe.search') return await handleUniverseSearch(envelope, emit, options);
    throw new Error(`unsupported realtime message type: ${envelope.type}`);
  } catch (error) {
    emit('error', { message: error.message }, envelope?.requestId || null);
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
    send(createRealtimeMessage('ready', {
      service: 'stockprob-r-realtime',
      protocol: ['analyze', 'rank', 'universe.search', 'cancel', 'ping', 'metrics'],
      limits: { max_message_bytes: MAX_MESSAGE_BYTES, rank_concurrency: DEFAULT_RANK_CONCURRENCY },
    }));
    socket.on('pong', () => {
      socket.isAlive = true;
    });
    socket.on('message', (message) => {
      if (!rateLimiter.allow(clientId)) {
        send(createRealtimeMessage('error', { message: 'rate limit exceeded' }));
        return;
      }
      handleRealtimeMessage(message.toString(), { send, dataClient, connectionRequests });
    });
    socket.on('close', () => {
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
  try {
    emit('analysis.started', request, envelope.requestId);
    emit('analysis.progress', { ...request, step: 'fetching_market_data', progress: 0.25 }, envelope.requestId);
    emit('analysis.progress', { ...request, step: 'calculating_features', progress: 0.55 }, envelope.requestId);
    const result = await predictFn({ ...request, dataClient });
    if (tracker.cancelled) {
      emit('analysis.cancelled', { request_id: envelope.requestId, ticker: request.ticker }, envelope.requestId);
      return null;
    }
    emit('analysis.progress', { ...request, step: 'scoring_signal', progress: 0.85 }, envelope.requestId);
    emit('analysis.result', result, envelope.requestId);
    return result;
  } catch (error) {
    emit('analysis.failed', { ...request, message: error.message, status: error.status || 500, details: error.details || null }, envelope.requestId);
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
  try {
    emit('rank.started', { horizon: request.horizon, requested: request.tickers.length }, envelope.requestId);
    const predictions = await mapWithConcurrency(request.tickers, concurrency, async (ticker, index) => {
      if (tracker.cancelled) return { ticker, error: 'cancelled', signal: 'avoid', warnings: ['Realtime rank request cancelled'] };
      try {
        const item = await predictFn({ ticker, horizon: request.horizon, dataClient });
        emit('rank.item', { progress: (index + 1) / request.tickers.length, ...item }, envelope.requestId);
        return item;
      } catch (error) {
        const item = { ticker, error: error.message, signal: 'avoid', warnings: [error.message] };
        emit('rank.item', { progress: (index + 1) / request.tickers.length, ...item }, envelope.requestId);
        return item;
      }
    });
    const rankings = predictions.sort((first, second) => (second.alpha_score ?? -1) - (first.alpha_score ?? -1)).slice(0, request.limit);
    if (tracker.cancelled) {
      emit('rank.cancelled', { request_id: envelope.requestId, count: rankings.length }, envelope.requestId);
      return rankings;
    }
    rankings.forEach((item, index) => {
      emit('rank.item', { rank: index + 1, ...item }, envelope.requestId);
    });
    emit('rank.complete', { horizon: `${Number(request.horizon)}d`, count: rankings.length, rankings }, envelope.requestId);
    return rankings;
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
    active_requests: activeRequests.size,
    requests: [...activeRequests.entries()].map(([requestId, tracker]) => ({
      request_id: requestId,
      type: tracker.type,
      age_ms: Date.now() - tracker.startedAt,
      cancelled: tracker.cancelled,
    })),
  };
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
