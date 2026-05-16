import DataSourceBadge from './DataSourceBadge.jsx';

export default function SystemStatusPanel({ systemHealth = {}, providerHealth = [], memoryHealth = {} }) {
  const configured = providerHealth.filter((provider) => provider.status === 'ok').length;
  return (
    <article className="live-panel system-status-panel">
      <header><span>Unified System</span><DataSourceBadge source="cache" status={systemHealth.status || 'degraded'} /></header>
      <div className="live-system-grid">
        <Metric label="System" value={systemHealth.status || 'unknown'} />
        <Metric label="DB" value={systemHealth.db || 'unknown'} />
        <Metric label="Redis" value={systemHealth.redis || 'unknown'} />
        <Metric label="Queue" value={systemHealth.queueDepth ?? 0} />
        <Metric label="Providers OK" value={configured} />
        <Metric label="Cache" value={memoryHealth.cacheEntries ?? 0} />
      </div>
    </article>
  );
}

function Metric({ label, value }) {
  return <div><span>{label}</span><strong>{value}</strong></div>;
}
