import { useMemoryHealth } from '../../hooks/useMemoryHealth.js';
import DataSourceBadge from './DataSourceBadge.jsx';

export default function MemoryStatusPanel({ memoryHealth = null }) {
  const live = useMemoryHealth();
  const data = memoryHealth || live.data || {};
  return (
    <article className="live-panel memory-panel">
      <header><span>Memory Health</span><DataSourceBadge source={live.source} status={live.status} /></header>
      <div className="live-system-grid">
        <Metric label="Cache entries" value={data.cacheEntries ?? 0} />
        <Metric label="Approx bytes" value={compact(data.approximateCacheBytes)} />
        <Metric label="Subscriptions" value={data.activeSubscriptions ?? 0} />
        <Metric label="Polling loops" value={data.activePollingLoops ?? 0} />
        <Metric label="In-flight" value={data.activeInFlightRequests ?? 0} />
        <Metric label="Redis" value={data.redis || 'unknown'} />
      </div>
      {(data.warnings || live.warnings || []).slice(0, 2).map((warning) => <p key={warning}>{warning}</p>)}
    </article>
  );
}

function Metric({ label, value }) {
  return <div><span>{label}</span><strong>{value}</strong></div>;
}

function compact(value) {
  const n = Number(value || 0);
  return n > 1000 ? `${Math.round(n / 1000)}KB` : String(n);
}
