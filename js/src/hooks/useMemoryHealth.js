import { useCallback, useEffect, useState } from 'react';
import { createLiveSubscription } from '../lib/liveClient.js';

export function useMemoryHealth() {
  const [state, setState] = useState({ data: null, status: 'connecting', lastUpdated: null, source: 'cache', isDemo: false, warnings: [], error: '' });
  const reconnect = useCallback(() => setState((current) => ({ ...current, status: 'reconnecting' })), []);

  useEffect(() => {
    const unsubscribe = createLiveSubscription({
      kind: 'memory',
      symbols: ['SYSTEM'],
      pollMs: 30_000,
      onStatus: (status) => setState((current) => ({ ...current, status: status.status, error: status.error || '' })),
      onMessage: (message) => {
        if (message.type !== 'memory.health') return;
        setState({
          data: message.data,
          status: 'live',
          lastUpdated: message.timestamp,
          source: message.source,
          isDemo: message.isDemo,
          warnings: message.warnings || [],
          error: '',
        });
      },
    });
    return unsubscribe;
  }, []);

  return { ...state, reconnect };
}
