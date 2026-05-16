import React from 'react';
import { useLiveQuotes } from '../../hooks/useLiveQuotes.js';
import LiveStatusBadge from './LiveStatusBadge.jsx';

export default function LiveQuoteTicker({ symbols = ['MSFT', 'AAPL', 'NVDA'] }) {
  const live = useLiveQuotes(symbols);
  return (
    <section className="live-quote-ticker">
      <header>
        <span>Live Quotes</span>
        <LiveStatusBadge status={live.status} source={live.source} isDemo={live.isDemo} lastUpdated={live.lastUpdated} />
      </header>
      <div>
        {symbols.map((symbol) => {
          const quote = live.data[symbol];
          return (
            <article key={symbol}>
              <strong>{symbol}</strong>
              <b>{money(quote?.price)}</b>
              <small className={(quote?.change || 0) >= 0 ? 'positive' : 'negative'}>{signed(quote?.changePercent)}%</small>
              <em>{quote?.marketState || 'unknown'}</em>
            </article>
          );
        })}
      </div>
      {live.warnings?.[0] && <p>{live.warnings[0]}</p>}
    </section>
  );
}

function money(value) {
  return Number.isFinite(Number(value)) ? `$${Number(value).toFixed(2)}` : '...';
}

function signed(value) {
  if (!Number.isFinite(Number(value))) return '...';
  return `${Number(value) >= 0 ? '+' : ''}${Number(value).toFixed(2)}`;
}
