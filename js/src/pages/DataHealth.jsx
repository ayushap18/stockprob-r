import React, { useEffect, useMemo, useState } from 'react';
import AppShell from '../components/ui/AppShell.jsx';
import ChartCard from '../components/ui/ChartCard.jsx';
import CompactTable from '../components/ui/CompactTable.jsx';
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
  const okCount = providers.filter((row) => ['ok', 'fallback'].includes(String(row.status).toLowerCase())).length;
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

      <section className="investment-grid health-top-grid">
        <section className="table-card health-provider-table">
          <div className="section-title-row"><div><span className="section-kicker">Providers</span><h2>Status Table</h2></div></div>
          <CompactTable columns={[
            { key: 'provider', label: 'Provider' },
            { key: 'status', label: 'Status' },
            { key: 'lastSuccessAt', label: 'Last Success' },
            { key: 'averageLatencyMs', label: 'Latency' },
            { key: 'errorRate', label: 'Error' },
            { key: 'fallbackCount24h', label: 'Fallbacks' },
            { key: 'freshness', label: 'Freshness' },
          ]} rows={providers} renderCell={renderProvider} />
        </section>
        <section className="table-card health-coverage-card">
          <div className="section-title-row"><div><span className="section-kicker">Coverage</span><h2>Data Coverage</h2></div></div>
          <div className="coverage-list">
            {coverageRows.map((row) => <CoverageRow key={row.key} label={labelize(row.key)} value={Number(row.value)} />)}
          </div>
        </section>
      </section>

      <section className="investment-grid datahealth-chart-grid" style={{ marginTop: 10 }}>
        <ChartCard title="Provider Latency" caption="p95 / avg">
          <ProviderHealthChart data={providers} isDemo={payload?.meta?.isDemo} />
        </ChartCard>
        <section className="table-card">
          <div className="section-title-row"><div><span className="section-kicker">Error Rate</span><h2>24h provider errors</h2></div></div>
          <CompactTable columns={[{ key: 'provider', label: 'Provider' }, { key: 'errorRate', label: 'Error' }, { key: 'fallbackCount24h', label: 'Fallback' }]} rows={providers} renderCell={renderProvider} />
        </section>
        <ChartCard title="Data Coverage Over Time" caption={`${okCount}/${providers.length} providers online`}>
          <SystemCoverageChart isDemo={payload?.meta?.isDemo} warnings={payload?.meta?.warnings} />
        </ChartCard>
        <section className="table-card">
          <div className="section-title-row"><div><span className="section-kicker">Staleness</span><h2>Freshness Histogram</h2></div></div>
          <CompactTable columns={[{ key: 'bucket', label: 'Age' }, { key: 'count', label: 'Symbols' }]} rows={data?.staleness || []} />
        </section>
      </section>

      <section className="investment-grid four health-runtime-grid" style={{ marginTop: 10 }}>
        <HealthMiniPanel title="Technical" rows={[
          ['RSI (14)', '58.4', 'Neutral'],
          ['MACD', '0.82', 'Bullish'],
          ['ADX (14)', '18.6', 'Weak trend'],
          ['Volatility (20D)', '24.1%', 'Moderate'],
        ]} />
        <HealthMiniPanel title="Fundamental" rows={[
          ['EPS Growth YoY', '+12.4%', 'Strong'],
          ['Revenue Growth', '+8.9%', 'Strong'],
          ['ROE', '33.6%', 'Strong'],
          ['Debt / Equity', '0.38', 'Healthy'],
        ]} />
        <HealthMiniPanel title="News & Sentiment" rows={[
          ['News Volume', '2,143', '+12%'],
          ['Sentiment Score', '+0.28', 'Bullish'],
          ['Positive', '1,423', '66%'],
          ['Negative', '720', '34%'],
        ]} />
        <HealthMiniPanel title="Macro Regime" rows={[
          ['Current Regime', 'Neutral', '57%'],
          ['Inflation Trend', 'Falling', 'OK'],
          ['Rate Trend', 'Stable', 'OK'],
          ['Liquidity', 'Improving', 'OK'],
        ]} />
      </section>

      <section className="investment-grid two" style={{ marginTop: 10 }}>
        <section className="table-card">
          <div className="section-title-row"><div><span className="section-kicker">Incidents</span><h2>Provider Warnings</h2></div></div>
          <CompactTable columns={[{ key: 'severity', label: 'Severity' }, { key: 'provider', label: 'Provider' }, { key: 'message', label: 'Message' }, { key: 'lastSeen', label: 'Last Seen' }]} rows={incidentRows} renderCell={renderIncident} />
        </section>
        <section className="table-card">
          <div className="section-title-row"><div><span className="section-kicker">Queue / Memory</span><h2>Runtime</h2></div></div>
          <CompactTable columns={[{ key: 'key', label: 'Metric' }, { key: 'value', label: 'Value' }]} rows={[...queueRows, ...Object.entries(memory).map(([key, value]) => ({ key, value }))]} renderCell={(row, column) => column.key === 'key' ? labelize(row.key) : formatValue(row.value)} />
        </section>
      </section>
    </AppShell>
  );
}

function CoverageRow({ label, value }) {
  const pctValue = Number.isFinite(value) ? Math.round(value * 100) : 0;
  return (
    <div className="coverage-row">
      <span>{label}</span>
      <b>{pctValue}%</b>
      <i><em style={{ width: `${Math.max(2, pctValue)}%` }} /></i>
    </div>
  );
}

function HealthMiniPanel({ title, rows }) {
  return (
    <section className="table-card health-mini-panel">
      <div className="section-title-row"><div><span className="section-kicker">{title}</span></div></div>
      <CompactTable columns={[{ key: 'metric', label: 'Metric' }, { key: 'value', label: 'Value' }, { key: 'state', label: 'State' }]} rows={rows.map(([metric, value, state]) => ({ metric, value, state }))} renderCell={(row, column) => column.key === 'state' ? <span className={String(row.state).match(/weak|negative|degraded/i) ? 'value-warn' : 'value-bull'}>{row.state}</span> : row[column.key]} />
    </section>
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
