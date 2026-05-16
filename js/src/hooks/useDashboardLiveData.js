import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { fetchDashboardSnapshot, refreshDashboardSymbol } from '../lib/dashboardApi.js';
import { createLiveSubscription } from '../lib/liveClient.js';
import { mergeDashboardPatch, normalizeDashboardData } from '../lib/normalizeDashboardData.js';

const initial = {
  snapshot: null,
  live: {},
  status: 'connecting',
  lastUpdated: null,
  source: 'cache',
  isDemo: false,
  warnings: [],
  error: '',
};

export function useDashboardLiveData(symbols = ['MSFT'], options = {}) {
  const primary = useMemo(() => String(symbols[0] || 'MSFT').toUpperCase(), [symbols]);
  const normalizedSymbols = useMemo(() => [...new Set(symbols.map((symbol) => String(symbol).toUpperCase()).filter(Boolean))], [symbols.join(',')]);
  const horizonDays = options.horizonDays || 5;
  const [state, dispatch] = useReducer(reducer, initial);
  const requestRef = useRef(0);

  const load = useCallback(async () => {
    const requestId = requestRef.current + 1;
    requestRef.current = requestId;
    dispatch({ type: 'status', status: 'connecting', error: '' });
    const payload = await fetchDashboardSnapshot(primary);
    if (requestRef.current !== requestId) return;
    dispatch({ type: 'snapshot', payload });
  }, [primary]);

  const refresh = useCallback(async () => {
    dispatch({ type: 'status', status: 'reconnecting', error: '' });
    const payload = await refreshDashboardSymbol(primary);
    dispatch({ type: 'snapshot', payload });
  }, [primary]);

  useEffect(() => {
    load().catch((error) => dispatch({ type: 'status', status: 'offline', error: error.message }));
  }, [load]);

  useEffect(() => {
    const unsubscribe = createLiveSubscription({
      kind: 'dashboard',
      symbols: normalizedSymbols,
      horizonDays,
      pollMs: options.pollMs || 20_000,
      onStatus: (status) => dispatch({ type: 'status', status: status.status, error: status.error || '' }),
      onMessage: (message) => dispatch({ type: 'message', message }),
    });
    return unsubscribe;
  }, [normalizedSymbols.join(','), horizonDays, options.pollMs]);

  return {
    ...state,
    quote: state.snapshot?.quote || null,
    probabilities: state.snapshot?.probabilities || null,
    charts: state.snapshot ? {
      candles: state.snapshot.candles,
      benchmark: state.snapshot.benchmark,
      probabilityHistory: state.snapshot.probabilityHistory,
      monteCarlo: state.snapshot.monteCarlo,
      rankings: state.snapshot.rankings,
      backtest: state.snapshot.backtest,
      macro: state.snapshot.macro,
    } : null,
    providerHealth: state.snapshot?.providerHealth || null,
    systemHealth: state.snapshot?.systemHealth || null,
    memoryHealth: state.snapshot?.memoryHealth || null,
    reconnect: load,
    refresh,
  };
}

function reducer(state, action) {
  if (action.type === 'status') return { ...state, status: action.status, error: action.error ?? state.error };
  if (action.type === 'snapshot') {
    const snapshot = normalizeDashboardData(action.payload.data);
    return {
      ...state,
      snapshot,
      status: action.payload.meta?.source === 'demo' ? 'fallback' : 'live',
      source: action.payload.meta?.source || 'cache',
      isDemo: Boolean(action.payload.meta?.isDemo),
      warnings: action.payload.meta?.warnings || [],
      lastUpdated: action.payload.meta?.asOf || new Date().toISOString(),
      error: '',
    };
  }
  if (action.type === 'message') {
    const snapshot = state.snapshot ? mergeDashboardPatch(state.snapshot, action.message) : normalizeDashboardData(action.message.data, action.message.symbol);
    return {
      ...state,
      snapshot,
      status: action.message.isDemo ? 'fallback' : 'live',
      source: action.message.source || state.source,
      isDemo: Boolean(action.message.isDemo),
      warnings: action.message.warnings || state.warnings,
      lastUpdated: action.message.timestamp,
      live: { ...state.live, [action.message.type]: action.message },
    };
  }
  return state;
}
