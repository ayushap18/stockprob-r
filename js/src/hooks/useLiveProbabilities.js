import { useEffect, useMemo, useState } from 'react';
import { createLiveSubscription } from '../lib/liveClient.js';

export function useLiveProbabilities(symbols = [], horizonDays = 5) {
  const normalized = useMemo(() => symbols.map((symbol) => String(symbol).toUpperCase()).filter(Boolean), [symbols.join(',')]);
  const [state, setState] = useState({ data: {}, status: 'connecting', lastUpdated: null, source: null, isDemo: false, warnings: [], error: '' });
  useEffect(() => createLiveSubscription({
    kind: 'probabilities',
    symbols: normalized,
    horizonDays,
    pollMs: 60000,
    onStatus: ({ status, error }) => setState((current) => ({ ...current, status, error })),
    onMessage: (message) => setState((current) => ({
      ...current,
      data: { ...current.data, [message.symbol || message.data?.symbol]: message.data },
      lastUpdated: message.timestamp,
      source: message.source,
      isDemo: message.isDemo,
      warnings: message.warnings || [],
    })),
  }), [normalized.join(','), horizonDays]);
  return { ...state, reconnect: () => setState((current) => ({ ...current, status: 'reconnecting' })) };
}
