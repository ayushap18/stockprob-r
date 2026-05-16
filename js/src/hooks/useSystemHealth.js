import { useEffect, useState } from 'react';
import { createLiveSubscription } from '../lib/liveClient.js';

export function useSystemHealth() {
  const [state, setState] = useState({ data: null, status: 'connecting', lastUpdated: null, source: null, isDemo: false, warnings: [], error: '' });
  useEffect(() => createLiveSubscription({
    kind: 'system',
    symbols: ['SYSTEM'],
    pollMs: 30000,
    onStatus: ({ status, error }) => setState((current) => ({ ...current, status, error })),
    onMessage: (message) => setState((current) => ({ ...current, data: message.data, lastUpdated: message.timestamp, source: message.source, isDemo: message.isDemo, warnings: message.warnings || [] })),
  }), []);
  return { ...state, reconnect: () => setState((current) => ({ ...current, status: 'reconnecting' })) };
}
