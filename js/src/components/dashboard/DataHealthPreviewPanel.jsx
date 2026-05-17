import React from 'react';
import MetricCard from '../ui/MetricCard.jsx';
import StatusBadge from '../ui/StatusBadge.jsx';

export default function DataHealthPreviewPanel({ providers = [], systemHealth = {}, memoryHealth = {} }) {
  const degraded = providers.filter((row) => !['ok', 'fallback'].includes(String(row.status).toLowerCase())).length;
  return (
    <section className="table-card">
      <div className="section-title-row"><div><span className="section-kicker">Data Health Preview</span><h2>System State</h2></div><a className="source-badge" href="/data-health">Open</a></div>
      <div className="mini-metric-grid">
        <MetricCard label="Providers" value={String(providers.length)} caption={`${degraded} degraded`} tone={degraded ? 'warn' : 'bull'} />
        <MetricCard label="Queue" value={String(systemHealth.queueDepth ?? 0)} caption="depth" tone={(systemHealth.queueDepth || 0) > 10 ? 'warn' : 'bull'} />
        <MetricCard label="Cache" value={String(memoryHealth.cacheEntries ?? 0)} caption="entries" tone="neutral" />
      </div>
      <div className="provider-grid compact">
        {providers.slice(0, 6).map((provider) => <div key={provider.provider} className="provider-row"><strong>{provider.provider}</strong><StatusBadge status={provider.status}>{provider.status}</StatusBadge></div>)}
      </div>
    </section>
  );
}
