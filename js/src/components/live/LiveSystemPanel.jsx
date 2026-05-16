import React from 'react';
import { useSystemHealth } from '../../hooks/useSystemHealth.js';
import LiveStatusBadge from './LiveStatusBadge.jsx';

export default function LiveSystemPanel() {
  const live = useSystemHealth();
  const data = live.data || {};
  return (
    <section className="live-panel">
      <header><h3>System Health</h3><LiveStatusBadge status={live.status} source={live.source} lastUpdated={live.lastUpdated} /></header>
      <div className="live-system-grid">
        <Stat label="status" value={data.status || 'checking'} />
        <Stat label="db" value={data.db || 'unknown'} />
        <Stat label="redis" value={data.redis || 'unknown'} />
        <Stat label="queue" value={data.queueDepth ?? 0} />
        <Stat label="active jobs" value={data.activeJobs ?? 0} />
        <Stat label="errors 24h" value={data.errorCount24h ?? 0} />
      </div>
      {live.warnings?.[0] && <p>{live.warnings[0]}</p>}
    </section>
  );
}

function Stat({ label, value }) {
  return <article><span>{label}</span><strong>{value}</strong></article>;
}
