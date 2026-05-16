import React from 'react';
import { useProviderHealth } from '../../hooks/useProviderHealth.js';
import LiveStatusBadge from './LiveStatusBadge.jsx';

export default function LiveProviderHealthPanel() {
  const live = useProviderHealth();
  return (
    <section className="live-panel">
      <header><h3>Provider Health</h3><LiveStatusBadge status={live.status} source={live.source} lastUpdated={live.lastUpdated} /></header>
      <div className="live-provider-grid">
        {(live.data || []).slice(0, 8).map((provider) => (
          <article key={provider.provider}>
            <strong>{provider.provider}</strong>
            <span className={provider.status}>{provider.status}</span>
            <small>{provider.configured ? 'configured' : 'not configured'}</small>
          </article>
        ))}
      </div>
    </section>
  );
}
