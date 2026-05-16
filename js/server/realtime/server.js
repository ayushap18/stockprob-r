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

export async function handleRealtimeMessage(raw, { send, dataClient } = {}) {
  const emit = (type, payload, requestId) => send?.(createRealtimeMessage(type, payload, requestId));
  let envelope;
  try {
    envelope = parseRealtimeEnvelope(raw);
    if (envelope.type === 'analyze') return await handleAnalyze(envelope, emit, dataClient);
    if (envelope.type === 'rank') return await handleRank(envelope, emit, dataClient);
    if (envelope.type === 'universe.search') return await handleUniverseSearch(envelope, emit);
    throw new Error(`unsupported realtime message type: ${envelope.type}`);
  } catch (error) {
    emit('error', { message: error.message }, envelope?.requestId || null);
    return null;
  }
}

export function startRealtimeServer({ port = Number(process.env.REALTIME_PORT || DEFAULT_PORT), dataClient } = {}) {
  const wss = new WebSocketServer({ port });

  wss.on('connection', (socket) => {
    socket.isAlive = true;
    const send = (message) => {
      if (socket.readyState === socket.OPEN) socket.send(JSON.stringify(message));
    };
    send(createRealtimeMessage('ready', { service: 'stockprob-r-realtime', protocol: ['analyze', 'rank', 'universe.search'] }));
    socket.on('pong', () => {
      socket.isAlive = true;
    });
    socket.on('message', (message) => {
      handleRealtimeMessage(message.toString(), { send, dataClient });
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

async function handleAnalyze(envelope, emit, dataClient) {
  const request = validateRealtimeRequest(envelope.payload);
  emit('analysis.started', request, envelope.requestId);
  emit('analysis.progress', { ...request, step: 'fetching_market_data', progress: 0.25 }, envelope.requestId);
  emit('analysis.progress', { ...request, step: 'calculating_features', progress: 0.55 }, envelope.requestId);
  const result = await predictOutperformance({ ...request, dataClient });
  emit('analysis.progress', { ...request, step: 'scoring_signal', progress: 0.85 }, envelope.requestId);
  emit('analysis.result', result, envelope.requestId);
  return result;
}

async function handleRank(envelope, emit, dataClient) {
  const request = validateRankRequest(envelope.payload);
  emit('rank.started', { horizon: request.horizon, requested: request.tickers.length }, envelope.requestId);
  const ranked = await rankUniverse({ tickers: request.tickers, horizon: request.horizon, dataClient });
  const rankings = ranked.rankings.slice(0, request.limit);
  rankings.forEach((item, index) => {
    emit('rank.item', { rank: index + 1, ...item }, envelope.requestId);
  });
  emit('rank.complete', { horizon: ranked.horizon, count: rankings.length, rankings }, envelope.requestId);
  return rankings;
}

async function handleUniverseSearch(envelope, emit) {
  const request = validateUniverseSearch(envelope.payload);
  const payload = await searchListedUniverse(request);
  emit('universe.results', payload, envelope.requestId);
  return payload;
}

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  const server = startRealtimeServer();
  server.on('listening', () => {
    const address = server.address();
    console.log(`StockProb-R realtime WebSocket server listening on ws://localhost:${address.port}`);
  });
}
