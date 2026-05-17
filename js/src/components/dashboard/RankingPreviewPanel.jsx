import React from 'react';
import CompactTable from '../ui/CompactTable.jsx';
import StatusBadge from '../ui/StatusBadge.jsx';

export default function RankingPreviewPanel({ rows = [] }) {
  const preview = rows.slice(0, 8);
  return (
    <section className="table-card">
      <div className="section-title-row"><div><span className="section-kicker">Ranking Preview</span><h2>Top Cross-Sectional Names</h2></div><a className="source-badge" href="/rankings">Open</a></div>
      <CompactTable columns={[
        { key: 'ticker', label: 'Symbol' },
        { key: 'probability', label: 'P(out)' },
        { key: 'expectedReturn', label: 'Exp' },
        { key: 'risk', label: 'Risk' },
        { key: 'confidence', label: 'Conf' },
        { key: 'providerStatus', label: 'Source' },
      ]} rows={preview} renderCell={renderCell} />
    </section>
  );
}

function renderCell(row, column) {
  if (column.key === 'ticker') return <strong>{row.ticker || row.symbol}</strong>;
  if (['probability', 'risk', 'confidence'].includes(column.key)) return pct(row[column.key]);
  if (column.key === 'expectedReturn') return <span className={row.expectedReturn >= 0 ? 'value-bull' : 'value-bear'}>{signedPct(row.expectedReturn)}</span>;
  if (column.key === 'providerStatus') return <StatusBadge status={row.providerStatus}>{row.providerStatus || 'demo'}</StatusBadge>;
  return row[column.key];
}

function pct(value) { return Number.isFinite(Number(value)) ? `${Math.round(Number(value) * 100)}%` : 'n/a'; }
function signedPct(value) {
  if (!Number.isFinite(Number(value))) return 'n/a';
  const n = Number(value) * 100;
  return `${n >= 0 ? '+' : ''}${n.toFixed(1)}%`;
}
