import { useEffect, useState } from 'react';
import { createLiveSubscription } from '../lib/liveClient.js';

export function useProviderHealth() {
  const [state, setState] = useState({ data: [], status: 'connecting', lastUpdated: null, source: null, isDemo: false, warnings: [], error: '' });
  useEffect(() => createLiveSubscription({
    kind: 'provider-health',
    symbols: ['PROVIDERS'],
    pollMs: 30000,
    onStatus: ({ status, error }) => setState((current) => ({ ...current, status, error })),
    onMessage: (message) => setState((current) => ({ ...current, data: Array.isArray(message.data) ? message.data : [], lastUpdated: message.timestamp, source: message.source, isDemo: message.isDemo, warnings: message.warnings || [] })),
  }), []);
  return { ...state, reconnect: () => setState((current) => ({ ...current, status: 'reconnecting' })) };
}
