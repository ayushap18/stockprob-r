const subscriptions = new Map();

export function createLiveSubscription({ kind, symbols = [], pollMs = 15000, horizonDays = 5, onMessage, onStatus }) {
  const normalized = [...new Set(symbols.map((symbol) => String(symbol).toUpperCase()).filter(Boolean))].sort();
  const key = `${kind}:${normalized.join(',')}:${horizonDays}`;
  if (subscriptions.has(key)) {
    const existing = subscriptions.get(key);
    existing.refs += 1;
    existing.listeners.add(onMessage);
    existing.statusListeners.add(onStatus);
    return () => release(key, onMessage, onStatus);
  }
  const state = {
    refs: 1,
    listeners: new Set([onMessage]),
    statusListeners: new Set([onStatus]),
    stopped: false,
    retry: 0,
    eventSource: null,
    timer: null,
    controller: null,
  };
  subscriptions.set(key, state);
  start(state, { kind, symbols: normalized, pollMs, horizonDays });
  return () => release(key, onMessage, onStatus);
}

function start(state, config) {
  notifyStatus(state, 'connecting');
  if (tryWebSocket(state, config)) return;
  trySse(state, config);
}

function tryWebSocket(state, config) {
  const base = import.meta.env.VITE_REALTIME_URL || '';
  if (!base || typeof WebSocket === 'undefined') return false;
  try {
    const ws = new WebSocket(`${base.replace(/\/$/, '')}/${config.kind}?symbols=${encodeURIComponent(config.symbols.join(','))}`);
    state.ws = ws;
    ws.onopen = () => notifyStatus(state, 'live');
    ws.onmessage = (event) => emit(state, safeJson(event.data));
    ws.onerror = () => {
      notifyStatus(state, 'reconnecting');
      ws.close();
    };
    ws.onclose = () => {
      if (!state.stopped) trySse(state, config);
    };
    return true;
  } catch {
    return false;
  }
}

function trySse(state, config) {
  if (typeof EventSource === 'undefined') return poll(state, config);
  const url = streamUrl(config);
  try {
    const es = new EventSource(url);
    state.eventSource = es;
    notifyStatus(state, 'fallback');
    const handler = (event) => emit(state, safeJson(event.data));
    ['dashboard.patch', 'quote.update', 'probability.update', 'chart.update', 'system.health', 'provider.health', 'memory.health', 'job.update', 'error', 'heartbeat.ping'].forEach((type) => es.addEventListener(type, handler));
    es.onerror = () => {
      es.close();
      if (!state.stopped) poll(state, config);
    };
  } catch {
    poll(state, config);
  }
}

function poll(state, config) {
  notifyStatus(state, state.retry ? 'reconnecting' : 'fallback');
  const run = async () => {
    if (state.stopped) return;
    state.controller?.abort();
    state.controller = new AbortController();
    try {
      const response = await fetch(pollUrl(config), { signal: state.controller.signal });
      const payload = await response.json();
      if (!response.ok || payload.ok === false) throw new Error(payload.error?.message || 'poll failed');
      state.retry = 0;
      emit(state, restToRealtime(config.kind, payload, config.symbols));
      notifyStatus(state, document.hidden ? 'fallback' : 'live');
    } catch (error) {
      state.retry += 1;
      notifyStatus(state, state.retry > 4 ? 'offline' : 'reconnecting', error.message);
    } finally {
      const hiddenMultiplier = document.hidden ? 4 : 1;
      const errorMultiplier = Math.min(8, 1 + state.retry);
      state.timer = setTimeout(run, config.pollMs * hiddenMultiplier * errorMultiplier);
    }
  };
  run();
}

function release(key, onMessage, onStatus) {
  const state = subscriptions.get(key);
  if (!state) return;
  state.listeners.delete(onMessage);
  state.statusListeners.delete(onStatus);
  state.refs -= 1;
  if (state.refs > 0) return;
  state.stopped = true;
  state.ws?.close();
  state.eventSource?.close();
  state.controller?.abort();
  clearTimeout(state.timer);
  subscriptions.delete(key);
}

function streamUrl({ kind, symbols, horizonDays }) {
  if (kind === 'dashboard') return `/api/stream/dashboard?symbols=${encodeURIComponent(symbols.join(','))}&horizonDays=${horizonDays}`;
  if (kind === 'quotes') return `/api/stream/quotes?symbols=${encodeURIComponent(symbols.join(','))}`;
  if (kind === 'probabilities') return `/api/stream/probabilities?symbols=${encodeURIComponent(symbols.join(','))}&horizonDays=${horizonDays}`;
  if (kind === 'provider-health') return '/api/stream/provider-health';
  if (kind === 'memory') return '/api/stream/memory';
  return '/api/stream/system';
}

function pollUrl({ kind, symbols, horizonDays }) {
  if (kind === 'dashboard') return `/api/dashboard/${encodeURIComponent(symbols[0] || 'MSFT')}/snapshot`;
  if (kind === 'quotes') return `/api/market/quote/${encodeURIComponent(symbols[0] || 'MSFT')}`;
  if (kind === 'probabilities') return `/api/probabilities/${encodeURIComponent(symbols[0] || 'MSFT')}?horizonDays=${horizonDays}`;
  if (kind === 'provider-health') return '/api/system/providers';
  if (kind === 'memory') return '/api/system/memory';
  return '/api/system/health';
}

function restToRealtime(kind, payload, symbols) {
  const type = kind === 'dashboard' ? 'dashboard.patch' : kind === 'quotes' ? 'quote.update' : kind === 'probabilities' ? 'probability.update' : kind === 'provider-health' ? 'provider.health' : kind === 'memory' ? 'memory.health' : 'system.health';
  return {
    type,
    symbol: symbols?.[0] || null,
    timestamp: payload.meta?.asOf || new Date().toISOString(),
    source: payload.meta?.source || 'cache',
    isDemo: Boolean(payload.meta?.isDemo),
    data: payload.data,
    warnings: payload.meta?.warnings || [],
  };
}

function emit(state, message) {
  if (!message) return;
  state.listeners.forEach((listener) => listener?.(message));
}

function notifyStatus(state, status, error = '') {
  state.statusListeners.forEach((listener) => listener?.({ status, error, timestamp: new Date().toISOString() }));
}

function safeJson(value) {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}
