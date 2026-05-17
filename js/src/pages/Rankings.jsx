import React, { useEffect, useMemo, useState } from 'react';
import AppShell from '../components/ui/AppShell.jsx';
import ChartCard from '../components/ui/ChartCard.jsx';
import CompactTable from '../components/ui/CompactTable.jsx';
import StatusBadge from '../components/ui/StatusBadge.jsx';
import { RankingScatterChart, SectorHeatmap } from '../components/charts/index.js';
import { fetchRankings, fetchSimilarStocks } from '../lib/rankingApi.js';
import { filterRankings } from '../lib/normalizeRankingData.js';

export default function RankingsPage() {
  const params = new URLSearchParams(window.location.search);
  const base = (params.get('base') || params.get('ticker') || 'MSFT').toUpperCase();
  const [query, setQuery] = useState('');
  const [sector, setSector] = useState('All');
  const [minProbability, setMinProbability] = useState(0.5);
  const [maxRisk, setMaxRisk] = useState(0.5);
  const [minConfidence, setMinConfidence] = useState(0);
  const [freshness, setFreshness] = useState('All');
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
    const filtered = filterRankings(payload?.data || [], { query, sector, minProbability, maxRisk })
      .filter((row) => row.confidence >= minConfidence)
      .filter((row) => freshness === 'All' || String(row.providerStatus || row.freshness).toLowerCase().includes(freshness.toLowerCase()));
    return [...filtered].sort((a, b) => Number(b[sortKey] || 0) - Number(a[sortKey] || 0));
  }, [payload?.data, query, sector, minProbability, maxRisk, minConfidence, freshness, sortKey]);

  const sectors = useMemo(() => ['All', ...new Set((payload?.data || []).map((row) => row.sector))], [payload?.data]);
  const groups = useMemo(() => ({
    bullish: [...rows].sort((a, b) => b.probability - a.probability).slice(0, 3),
    lowRisk: [...rows].sort((a, b) => a.risk - b.risk).slice(0, 3),
    confidence: [...rows].sort((a, b) => b.confidence - a.confidence).slice(0, 3),
    pressure: [...rows].sort((a, b) => a.expectedExcessReturn - b.expectedExcessReturn).slice(0, 3),
  }), [rows]);

  return (
    <AppShell active="Rankings" rightSlot={<StatusBadge status={payload?.meta?.isDemo ? 'demo' : 'live'}>{payload?.meta?.source || 'rankings'}</StatusBadge>}>
      <section className="investment-command screen-command">
        <div>
          <span className="section-kicker">Screener</span>
          <input className="investment-input" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Ticker, company, sector, theme" />
        </div>
        <div className="investment-context">
          <label className="filter-field"><span>Sector</span>
          <select className="investment-select" value={sector} onChange={(event) => setSector(event.target.value)}>{sectors.map((item) => <option key={item}>{item}</option>)}</select>
          </label>
          <label className="filter-field"><span>Prob Outperform</span><input className="investment-input" type="number" min="0" max="1" step="0.01" value={minProbability} onChange={(event) => setMinProbability(Number(event.target.value))} /></label>
          <label className="filter-field"><span>Risk Score</span><input className="investment-input" type="number" min="0" max="1" step="0.01" value={maxRisk} onChange={(event) => setMaxRisk(Number(event.target.value))} /></label>
          <label className="filter-field"><span>Confidence</span><input className="investment-input" type="number" min="0" max="1" step="0.01" value={minConfidence} onChange={(event) => setMinConfidence(Number(event.target.value))} /></label>
          <label className="filter-field"><span>Freshness</span>
          <select className="investment-select" value={freshness} onChange={(event) => setFreshness(event.target.value)}><option>All</option><option>ok</option><option>demo</option><option>degraded</option></select>
          </label>
          <label className="filter-field"><span>Sort By</span>
          <select className="investment-select" value={sortKey} onChange={(event) => setSortKey(event.target.value)}>
            <option value="probability">Probability</option>
            <option value="expectedReturn">Expected Return</option>
            <option value="expectedExcessReturn">Excess Return</option>
            <option value="risk">Risk</option>
            <option value="confidence">Confidence</option>
            <option value="alphaScore">Alpha</option>
            <option value="similarityScore">Similarity</option>
          </select>
          </label>
          <span className="source-badge">{rows.length} results</span>
          <button className="investment-button secondary" type="button" onClick={() => { setQuery(''); setSector('All'); setMinProbability(0); setMaxRisk(1); setMinConfidence(0); setFreshness('All'); }}>Reset</button>
        </div>
        <a className="investment-button secondary" href={`/dashboard?ticker=${encodeURIComponent(base)}`}>Dashboard</a>
      </section>

      {payload?.meta?.warnings?.length ? <section className="warning-strip">{payload.meta.warnings.map((warning) => <span key={warning}>{warning}</span>)}</section> : null}

      <section className="table-card screen-primary-table">
        <div className="section-title-row">
          <div><span className="section-kicker">Ranked Universe</span><h2>{loading ? 'Loading...' : 'Comparable Results'}</h2></div>
          <span className="source-badge">Universe 3,214 stocks</span>
        </div>
        <CompactTable
          columns={[
            { key: 'rank', label: '#' },
            { key: 'ticker', label: 'Ticker' },
            { key: 'company', label: 'Company' },
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

      <section className="investment-grid ranking-main-grid" style={{ marginTop: 10 }}>
        <ChartCard title="Ranking Map" caption="Expected return vs probability">
          <RankingScatterChart data={rows} isDemo={payload?.meta?.isDemo} />
        </ChartCard>
        <ChartCard title="Sector Heatmap" caption="Avg expected return">
          <SectorHeatmap data={rows} isDemo={payload?.meta?.isDemo} />
        </ChartCard>
        <section className="table-card">
          <div className="section-title-row">
            <div><span className="section-kicker">Similar Opportunities</span><h2>{base} factor match</h2></div>
          </div>
          <CompactTable
            columns={[{ key: 'ticker', label: 'Ticker' }, { key: 'similarityScore', label: 'Similarity' }, { key: 'probability', label: 'P(out)' }, { key: 'expectedReturn', label: 'Exp' }]}
            rows={similar.slice(0, 5)}
            renderCell={renderRelatedRow}
          />
          <a className="screen-link" href={`/dashboard?ticker=${encodeURIComponent(similar[0]?.ticker || base)}`}>View more similar stocks →</a>
        </section>
      </section>

      <section className="investment-grid four screen-bottom-grid" style={{ marginTop: 10 }}>
        <RankingPod title="Top Bullish" rows={groups.bullish} valueKey="probability" />
        <RankingPod title="Low Risk" rows={groups.lowRisk} valueKey="risk" invert />
        <RankingPod title="High Confidence" rows={groups.confidence} valueKey="confidence" />
        <RankingPod title="Under Pressure" rows={groups.pressure} valueKey="expectedExcessReturn" bearish />
      </section>
    </AppShell>
  );
}

function RankingPod({ title, rows, valueKey, invert = false, bearish = false }) {
  return (
    <section className="table-card mini-pod">
      <div className="section-title-row"><div><span className="section-kicker">{title}</span><h2>{rows[0]?.ticker || 'n/a'}</h2></div></div>
      <CompactTable
        columns={[{ key: 'ticker', label: 'Ticker' }, { key: valueKey, label: valueKey === 'expectedExcessReturn' ? 'Excess' : 'Score' }, { key: 'expectedReturn', label: 'Exp' }]}
        rows={rows}
        renderCell={(row, column) => {
          if (column.key === 'ticker') return <strong>{row.ticker}</strong>;
          if (column.key === 'expectedReturn' || column.key === 'expectedExcessReturn') return <span className={row[column.key] >= 0 ? 'value-bull' : 'value-bear'}>{signedPct(row[column.key])}</span>;
          const tone = bearish ? 'value-bear' : invert ? 'value-warn' : 'value-bull';
          return <span className={tone}>{pct(row[column.key])}</span>;
        }}
      />
    </section>
  );
}

function renderCell(row, column) {
  if (['probability', 'risk', 'confidence'].includes(column.key)) return pct(row[column.key]);
  if (['expectedReturn', 'expectedExcessReturn', 'past1mReturn', 'past3mReturn', 'past1yReturn'].includes(column.key)) return <span className={row[column.key] >= 0 ? 'value-bull' : 'value-bear'}>{signedPct(row[column.key])}</span>;
  if (column.key === 'providerStatus') return <StatusBadge status={row.providerStatus}>{row.providerStatus}</StatusBadge>;
  if (column.key === 'ticker') return <strong>{row.ticker}</strong>;
  return row[column.key];
}

function renderRelatedRow(row, column) {
  if (column.key === 'ticker') return <strong>{row.ticker}</strong>;
  if (['probability', 'similarityScore'].includes(column.key)) return pct(row[column.key]);
  if (column.key === 'expectedReturn') return <span className={row.expectedReturn >= 0 ? 'value-bull' : 'value-bear'}>{signedPct(row.expectedReturn)}</span>;
  return row[column.key] ?? 'n/a';
}

function pct(value) {
  return Number.isFinite(Number(value)) ? `${Math.round(Number(value) * 100)}%` : 'n/a';
}

function signedPct(value) {
  if (!Number.isFinite(Number(value))) return 'n/a';
  const n = Number(value) * 100;
  return `${n >= 0 ? '+' : ''}${n.toFixed(1)}%`;
}
