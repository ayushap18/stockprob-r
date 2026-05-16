import { useEffect, useMemo, useState } from 'react';
import { createLiveSubscription } from '../lib/liveClient.js';

export function useLiveQuotes(symbols = []) {
  const normalized = useMemo(() => symbols.map((symbol) => String(symbol).toUpperCase()).filter(Boolean), [symbols.join(',')]);
  const [state, setState] = useState(empty());
  useEffect(() => createLiveSubscription({
    kind: 'quotes',
    symbols: normalized,
    pollMs: 15000,
    onStatus: ({ status, error }) => setState((current) => ({ ...current, status, error })),
    onMessage: (message) => setState((current) => ({
      ...current,
      data: { ...current.data, [message.symbol || message.data?.symbol]: message.data },
      lastUpdated: message.timestamp,
      source: message.source,
      isDemo: message.isDemo,
      warnings: message.warnings || [],
    })),
  }), [normalized.join(',')]);
  return { ...state, reconnect: () => setState((current) => ({ ...current, status: 'reconnecting' })) };
}

function empty() {
  return { data: {}, status: 'connecting', lastUpdated: null, source: null, isDemo: false, warnings: [], error: '' };
}
