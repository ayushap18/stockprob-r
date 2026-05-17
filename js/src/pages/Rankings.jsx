import React, { useEffect, useMemo, useState } from 'react';
import AppShell from '../components/ui/AppShell.jsx';
import ChartCard from '../components/ui/ChartCard.jsx';
import CompactTable from '../components/ui/CompactTable.jsx';
import MetricCard from '../components/ui/MetricCard.jsx';
import StatusBadge from '../components/ui/StatusBadge.jsx';
import { RankingScatterChart, SectorHeatmap } from '../components/charts/index.js';
import { fetchRankings, fetchSimilarStocks } from '../lib/rankingApi.js';
import { filterRankings } from '../lib/normalizeRankingData.js';

export default function RankingsPage() {
  const params = new URLSearchParams(window.location.search);
  const base = (params.get('base') || params.get('ticker') || 'MSFT').toUpperCase();
  const [query, setQuery] = useState('');
  const [sector, setSector] = useState('All');
  const [sortKey, setSortKey] = useState('probability');
  const [payload, setPayload] = useState(null);
  const [similar, setSimilar] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    Promise.all([fetchRankings({ query, base }), fetchSimilarStocks(base)])
      .then(([rankings, related]) => {
        if (cancelled) return;
        setPayload(rankings);
        setSimilar(related.data);
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [query, base]);

  const rows = useMemo(() => {
    const filtered = filterRankings(payload?.data || [], { query, sector });
    return [...filtered].sort((a, b) => Number(b[sortKey] || 0) - Number(a[sortKey] || 0));
  }, [payload?.data, query, sector, sortKey]);

  const sectors = useMemo(() => ['All', ...new Set((payload?.data || []).map((row) => row.sector))], [payload?.data]);
  const leaders = rows.slice(0, 4);

  return (
    <AppShell active="Rankings" rightSlot={<StatusBadge status={payload?.meta?.isDemo ? 'demo' : 'live'}>{payload?.meta?.source || 'rankings'}</StatusBadge>}>
      <section className="investment-command">
        <div>
          <span className="section-kicker">Screener</span>
          <input className="investment-input" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Ticker, company, sector, theme" />
        </div>
        <div className="investment-context">
          <select className="investment-select" value={sector} onChange={(event) => setSector(event.target.value)}>{sectors.map((item) => <option key={item}>{item}</option>)}</select>
          <select className="investment-select" value={sortKey} onChange={(event) => setSortKey(event.target.value)}>
            <option value="probability">Probability</option>
            <option value="expectedReturn">Expected Return</option>
            <option value="expectedExcessReturn">Excess Return</option>
            <option value="risk">Risk</option>
            <option value="confidence">Confidence</option>
            <option value="alphaScore">Alpha</option>
            <option value="similarityScore">Similarity</option>
          </select>
          <span className="source-badge">{rows.length} results</span>
        </div>
        <a className="investment-button secondary" href={`/dashboard?ticker=${encodeURIComponent(base)}`}>Dashboard</a>
      </section>

      {payload?.meta?.warnings?.length ? <section className="warning-strip">{payload.meta.warnings.map((warning) => <span key={warning}>{warning}</span>)}</section> : null}

      <section className="investment-grid kpi-strip">
        {leaders.map((row) => (
          <MetricCard key={row.ticker} label={row.ticker} value={pct(row.probability)} caption={`${signedPct(row.expectedExcessReturn)} excess`} tone={row.probability >= 0.55 ? 'bull' : row.probability < 0.48 ? 'bear' : 'warn'} />
        ))}
      </section>

      <section className="investment-grid two" style={{ marginTop: 10 }}>
        <ChartCard title="Ranking Scatter" caption="Probability vs expected return">
          <RankingScatterChart data={rows} isDemo={payload?.meta?.isDemo} />
        </ChartCard>
        <ChartCard title="Sector Heatmap" caption="Probability / expected / risk">
          <SectorHeatmap data={rows} isDemo={payload?.meta?.isDemo} />
        </ChartCard>
      </section>

      <section className="chart-card" style={{ marginTop: 10 }}>
        <div className="section-title-row">
          <div><span className="section-kicker">Similarity Map</span><h2>Related to {base}</h2></div>
        </div>
        <div className="suggestions-grid">
          {similar.map((row) => <RelatedCard key={row.ticker} row={row} />)}
        </div>
      </section>

      <section className="table-card" style={{ marginTop: 10 }}>
        <div className="section-title-row">
          <div><span className="section-kicker">Ranked Universe</span><h2>{loading ? 'Loading...' : 'Comparable Results'}</h2></div>
        </div>
        <CompactTable
          columns={[
            { key: 'rank', label: '#' },
            { key: 'ticker', label: 'Ticker' },
            { key: 'sector', label: 'Sector' },
            { key: 'probability', label: 'P(out)' },
            { key: 'expectedReturn', label: 'Exp' },
            { key: 'expectedExcessReturn', label: 'Excess' },
            { key: 'past1mReturn', label: '1M' },
            { key: 'past3mReturn', label: '3M' },
            { key: 'past1yReturn', label: '1Y' },
            { key: 'risk', label: 'Risk' },
            { key: 'confidence', label: 'Conf' },
            { key: 'providerStatus', label: 'Source' },
          ]}
          rows={rows}
          renderCell={renderCell}
        />
      </section>
    </AppShell>
  );
}

function RelatedCard({ row }) {
  return (
    <article className="suggestion-card">
      <header><div><h3>{row.ticker}</h3><p>{row.company}</p></div><StatusBadge status={row.providerStatus}>{row.providerStatus}</StatusBadge></header>
      <p>{row.similarityReason}</p>
      <dl>
        <div><dt>Similarity</dt><dd>{pct(row.similarityScore)}</dd></div>
        <div><dt>P(out)</dt><dd>{pct(row.probability)}</dd></div>
        <div><dt>Risk</dt><dd>{pct(row.risk)}</dd></div>
      </dl>
    </article>
  );
}

function renderCell(row, column) {
  if (['probability', 'risk', 'confidence'].includes(column.key)) return pct(row[column.key]);
  if (['expectedReturn', 'expectedExcessReturn', 'past1mReturn', 'past3mReturn', 'past1yReturn'].includes(column.key)) return <span className={row[column.key] >= 0 ? 'value-bull' : 'value-bear'}>{signedPct(row[column.key])}</span>;
  if (column.key === 'providerStatus') return <StatusBadge status={row.providerStatus}>{row.providerStatus}</StatusBadge>;
  if (column.key === 'ticker') return <strong>{row.ticker}</strong>;
  return row[column.key];
}

function pct(value) {
  return Number.isFinite(Number(value)) ? `${Math.round(Number(value) * 100)}%` : 'n/a';
}

function signedPct(value) {
  if (!Number.isFinite(Number(value))) return 'n/a';
  const n = Number(value) * 100;
  return `${n >= 0 ? '+' : ''}${n.toFixed(1)}%`;
}
