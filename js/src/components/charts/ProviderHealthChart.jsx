import React from 'react';
import { ChartShell } from './ChartPrimitives.jsx';

export default function ProviderHealthChart({ data = [], isDemo, warnings }) {
  return (
    <ChartShell title="Provider Health" subtitle="Status, latency, refresh, fallback and warning counts" isDemo={isDemo} warnings={warnings}>
      <div className="provider-health-table">
        {data.map((provider) => (
          <div key={provider.provider}>
            <strong>{provider.provider}</strong>
            <span className={`status-chip ${String(provider.status).toLowerCase()}`}>{provider.status}</span>
            <small>{provider.latencyMs ? `${Math.round(provider.latencyMs)} ms` : 'no latency'}</small>
            <small>fallbacks {provider.fallbackCount ?? 0}</small>
            <small>warnings {provider.warningCount ?? 0}</small>
            <small>{provider.lastRefresh || 'not refreshed'}</small>
          </div>
        ))}
      </div>
    </ChartShell>
  );
}
