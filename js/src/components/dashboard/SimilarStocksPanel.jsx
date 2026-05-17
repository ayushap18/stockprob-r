import React, { useMemo } from 'react';
import StatusBadge from '../ui/StatusBadge.jsx';
import { scoreSimilarStocks } from '../../lib/similarityEngine.js';

export default function SimilarStocksPanel({ symbol, snapshot }) {
  const rows = useMemo(() => {
    const base = {
      sector: snapshot?.company?.sector,
      risk: snapshot?.probabilities?.riskScore,
      probability: snapshot?.probabilities?.probabilityOutperformSpy,
      expectedReturn: snapshot?.probabilities?.expectedReturn,
      confidence: snapshot?.probabilities?.confidence,
      momentumScore: snapshot?.probabilities?.momentumScore,
    };
    return scoreSimilarStocks(base, (snapshot?.rankings || []).filter((row) => row.ticker !== symbol && row.symbol !== symbol)).slice(0, 4);
  }, [snapshot, symbol]);
  return (
    <section className="chart-card">
      <div className="section-title-row">
        <div><span className="section-kicker">Smart Suggestions</span><h2>Similar Stocks</h2></div>
        <a className="source-badge" href={`/rankings?base=${encodeURIComponent(symbol)}`}>Full rankings</a>
      </div>
      <div className="suggestions-grid">
        {rows.map((row) => <SuggestionCard key={row.ticker || row.symbol} row={row} />)}
      </div>
    </section>
  );
}

function SuggestionCard({ row }) {
  return (
    <article className="suggestion-card">
      <header><div><h3>{row.ticker || row.symbol}</h3><p>{row.company || row.sector}</p></div><StatusBadge status={row.providerStatus}>{row.providerStatus || 'demo'}</StatusBadge></header>
      <p>{row.similarityReason}</p>
      <dl>
        <div><dt>Similarity</dt><dd>{pct(row.similarityScore)}</dd></div>
        <div><dt>P(out)</dt><dd>{pct(row.probability)}</dd></div>
        <div><dt>Risk</dt><dd>{pct(row.risk)}</dd></div>
      </dl>
      <a className="source-badge" href={`/dashboard?ticker=${encodeURIComponent(row.ticker || row.symbol)}`}>Compare</a>
    </article>
  );
}

function pct(value) {
  return Number.isFinite(Number(value)) ? `${Math.round(Number(value) * 100)}%` : 'n/a';
}
