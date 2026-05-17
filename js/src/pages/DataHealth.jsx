import React, { useEffect, useMemo, useState } from 'react';
import AppShell from '../components/ui/AppShell.jsx';
import ChartCard from '../components/ui/ChartCard.jsx';
import CompactTable from '../components/ui/CompactTable.jsx';
import MetricCard from '../components/ui/MetricCard.jsx';
import StatusBadge from '../components/ui/StatusBadge.jsx';
import { ProviderHealthChart, SystemCoverageChart } from '../components/charts/index.js';
import { fetchDataHealth } from '../lib/dataHealthApi.js';

export default function DataHealthPage() {
  const [payload, setPayload] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetchDataHealth().then((result) => {
      if (!cancelled) setPayload(result);
    }).finally(() => { if (!cancelled) setLoading(false); });
    const interval = setInterval(() => fetchDataHealth().then((result) => { if (!cancelled) setPayload(result); }), 30_000);
    return () => { cancelled = true; clearInterval(interval); };
  }, []);

  const data = payload?.data;
  const providers = data?.providers || [];
  const coverageRows = useMemo(() => Object.entries(data?.coverage || {}).map(([key, value]) => ({ key, value })), [data?.coverage]);
  const queueRows = useMemo(() => Object.entries(data?.queues || {}).map(([key, value]) => ({ key, value })), [data?.queues]);
  const memory = data?.memory || {};
  const incidentRows = useMemo(() => providers.filter((row) => !['ok', 'fallback'].includes(String(row.status).toLowerCase())).map((row, index) => ({
    id: index + 1,
    severity: row.status === 'not_configured' ? 'missing' : 'degraded',
    provider: row.provider,
    message: row.status === 'not_configured' ? 'API key not configured; fallback path active' : 'Provider degraded; watch latency and fallback count',
    lastSeen: row.lastErrorAt || row.lastSuccessAt || 'n/a',
  })), [providers]);

  return (
    <AppShell active="Data Health" rightSlot={<StatusBadge status={data?.status || 'degraded'}>{data?.status || 'loading'}</StatusBadge>}>
      <section className="investment-command screen-command">
        <div>
          <span className="section-kicker">Data Health</span>
          <h1 style={{ margin: '4px 0 0', fontSize: 22 }}>Provider, Cache, Queue, Memory</h1>
        </div>
        <div className="investment-context">
          <span className="source-badge">{payload?.meta?.source || 'system'}</span>
          <span className="freshness-badge">{payload?.meta?.asOf ? new Date(payload.meta.asOf).toLocaleTimeString() : 'not updated'}</span>
          {loading && <span className="status-badge degraded">refreshing</span>}
        </div>
        <button className="investment-button secondary" type="button" onClick={() => fetchDataHealth().then(setPayload)}>Refresh</button>
      </section>

      {payload?.meta?.warnings?.length ? <section className="warning-strip">{payload.meta.warnings.map((warning) => <span key={warning}>{warning}</span>)}</section> : null}

      <section className="investment-grid kpi-strip">
        <MetricCard label="Providers" value={String(providers.length)} caption="tracked" tone="neutral" />
        <MetricCard label="OK" value={String(providers.filter((row) => ['ok', 'fallback'].includes(String(row.status).toLowerCase())).length)} caption="online/fallback" tone="bull" />
        <MetricCard label="Degraded" value={String(providers.filter((row) => String(row.status).toLowerCase().includes('degraded')).length)} caption="needs attention" tone="warn" />
        <MetricCard label="Down" value={String(providers.filter((row) => ['down', 'failed'].includes(String(row.status).toLowerCase())).length)} caption="offline" tone="bear" />
        <MetricCard label="Queue" value={String(data?.queues?.queueDepth ?? 0)} caption="depth" tone={(data?.queues?.queueDepth || 0) > 10 ? 'warn' : 'bull'} />
        <MetricCard label="Cache Entries" value={String(memory.cacheEntries ?? memory.entries ?? 0)} caption="memory/redis" tone="neutral" />
        <MetricCard label="Hit Rate" value={pct(memory.cacheHitRate)} caption="cache" tone={(memory.cacheHitRate || 0) > 0.55 ? 'bull' : 'warn'} />
        <MetricCard label="In Flight" value={String(memory.activeInFlightRequests ?? 0)} caption="requests" tone={(memory.activeInFlightRequests || 0) > 20 ? 'warn' : 'bull'} />
        <MetricCard label="Subscriptions" value={String(memory.activeSubscriptions ?? 0)} caption="live clients" tone="neutral" />
        <MetricCard label="Polling" value={String(memory.activePollingLoops ?? 0)} caption="fallback loops" tone={(memory.activePollingLoops || 0) > 12 ? 'warn' : 'bull'} />
      </section>

      <section className="investment-grid two" style={{ marginTop: 10 }}>
        <ChartCard title="Provider Status" caption="Latency / fallback / warnings">
          <ProviderHealthChart data={providers} isDemo={payload?.meta?.isDemo} />
        </ChartCard>
        <ChartCard title="System Coverage" caption="Universe coverage">
          <SystemCoverageChart isDemo={payload?.meta?.isDemo} warnings={payload?.meta?.warnings} />
        </ChartCard>
      </section>

      <section className="investment-grid three" style={{ marginTop: 10 }}>
        <section className="table-card">
          <div className="section-title-row"><div><span className="section-kicker">Providers</span><h2>Status Table</h2></div></div>
          <CompactTable columns={[
            { key: 'provider', label: 'Provider' },
            { key: 'status', label: 'Status' },
            { key: 'averageLatencyMs', label: 'Latency' },
            { key: 'errorRate', label: 'Error' },
            { key: 'fallbackCount24h', label: 'Fallbacks' },
            { key: 'freshness', label: 'Freshness' },
          ]} rows={providers} renderCell={renderProvider} />
        </section>
        <section className="table-card">
          <div className="section-title-row"><div><span className="section-kicker">Coverage</span><h2>Data Coverage</h2></div></div>
          <CompactTable columns={[{ key: 'key', label: 'Dataset' }, { key: 'value', label: 'Coverage' }]} rows={coverageRows} renderCell={(row, column) => column.key === 'value' ? pct(row.value) : labelize(row.key)} />
        </section>
        <section className="table-card">
          <div className="section-title-row"><div><span className="section-kicker">Queue / Memory</span><h2>Runtime</h2></div></div>
          <CompactTable columns={[{ key: 'key', label: 'Metric' }, { key: 'value', label: 'Value' }]} rows={[...queueRows, ...Object.entries(memory).map(([key, value]) => ({ key, value }))]} renderCell={(row, column) => column.key === 'key' ? labelize(row.key) : formatValue(row.value)} />
        </section>
      </section>

      <section className="investment-grid two" style={{ marginTop: 10 }}>
        <section className="table-card">
          <div className="section-title-row"><div><span className="section-kicker">Staleness</span><h2>Freshness Histogram</h2></div></div>
          <CompactTable columns={[{ key: 'bucket', label: 'Age' }, { key: 'count', label: 'Symbols' }]} rows={data?.staleness || []} />
        </section>
        <section className="table-card">
          <div className="section-title-row"><div><span className="section-kicker">Incidents</span><h2>Provider Warnings</h2></div></div>
          <CompactTable columns={[{ key: 'severity', label: 'Severity' }, { key: 'provider', label: 'Provider' }, { key: 'message', label: 'Message' }, { key: 'lastSeen', label: 'Last Seen' }]} rows={incidentRows} renderCell={renderIncident} />
        </section>
      </section>
    </AppShell>
  );
}

function renderIncident(row, column) {
  if (column.key === 'severity') return <StatusBadge status={row.severity === 'missing' ? 'degraded' : row.severity}>{row.severity}</StatusBadge>;
  return row[column.key] ?? 'n/a';
}

function renderProvider(row, column) {
  if (column.key === 'status') return <StatusBadge status={row.status}>{row.status}</StatusBadge>;
  if (column.key === 'averageLatencyMs') return `${Math.round(row.averageLatencyMs || 0)}ms`;
  if (column.key === 'errorRate') return pct(row.errorRate);
  return row[column.key] ?? 'n/a';
}

function pct(value) {
  return Number.isFinite(Number(value)) ? `${Math.round(Number(value) * 100)}%` : 'n/a';
}

function labelize(value) {
  return String(value).replace(/([A-Z])/g, ' $1').replace(/_/g, ' ').replace(/^./, (char) => char.toUpperCase());
}

function formatValue(value) {
  if (Array.isArray(value)) return `${value.length} rows`;
  if (value && typeof value === 'object') return `${Object.keys(value).length} fields`;
  if (typeof value === 'number') return Number.isInteger(value) ? String(value) : value.toFixed(2);
  return value === null || value === undefined ? 'n/a' : String(value);
}
