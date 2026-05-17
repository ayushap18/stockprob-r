import React, { useEffect, useMemo, useRef, useState } from 'react';
import FreshnessBadge from '../ui/FreshnessBadge.jsx';
import SourceBadge from '../ui/SourceBadge.jsx';
import StatusBadge from '../ui/StatusBadge.jsx';

const demoResults = [
  { symbol: 'MSFT', name: 'Microsoft Corporation', sector: 'Technology', theme: 'AI infrastructure' },
  { symbol: 'AAPL', name: 'Apple Inc.', sector: 'Technology', theme: 'Consumer hardware' },
  { symbol: 'NVDA', name: 'NVIDIA Corporation', sector: 'Technology', theme: 'Semiconductors' },
  { symbol: 'JPM', name: 'JPMorgan Chase & Co.', sector: 'Financials', theme: 'Large banks' },
];

export default function DashboardCommandCenter({ input, setInput, onSubmit, onSelectSymbol, snapshot, live, controls, updateControl }) {
  const [open, setOpen] = useState(false);
  const [results, setResults] = useState([]);
  const abortRef = useRef(null);
  const quote = snapshot?.quote || {};
  const company = snapshot?.company || {};
  const latestCandleDate = snapshot?.candles?.at?.(-1)?.date || snapshot?.candles?.at?.(-1)?.time;
  const selectedSymbol = String(snapshot?.symbol || '').toUpperCase();
  const mergedResults = useMemo(() => {
    const mapped = results.filter((row) => row?.symbol);
    if (!selectedSymbol) return mapped;
    const hasSelected = mapped.some((row) => String(row.symbol).toUpperCase() === selectedSymbol);
    return hasSelected ? mapped : [{ symbol: selectedSymbol, name: company.name || company.company || 'Selected security', sector: company.exchange || 'US', theme: 'Current dashboard' }, ...mapped];
  }, [company.company, company.exchange, company.name, results, selectedSymbol]);

  useEffect(() => {
    const query = input.trim();
    if (!query) return setResults([]);
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    const timer = setTimeout(() => {
      fetch(`/api/universe?q=${encodeURIComponent(query)}&limit=8&include_etfs=true`, { signal: controller.signal })
        .then((response) => response.json())
        .then((payload) => {
          const rows = payload?.results || payload?.data || payload?.universe || [];
          setResults(rows.length ? rows.map((row) => ({
            symbol: row.symbol || row.ticker,
            name: row.name || row.company || row.security_name,
            sector: row.sector || row.exchange || 'US listed',
            theme: row.theme || row.industry || '',
          })) : demoResults);
        })
        .catch(() => setResults(demoResults));
    }, 220);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [input]);

  return (
    <form className="investment-command command-center" onSubmit={(event) => { setOpen(false); onSubmit(event); }}>
      <div className="command-search-wrap">
        <span className="section-kicker">Command Center</span>
        <div className="investment-search">
          <input
            className="investment-input"
            value={input}
            placeholder="Ticker or company"
            onFocus={() => setOpen(true)}
            onKeyDown={(event) => {
              if (event.key === 'Escape') setOpen(false);
              if (event.key === 'Enter') setOpen(false);
            }}
            onChange={(event) => { setInput(event.target.value.toUpperCase()); setOpen(true); }}
            aria-label="Ticker or company search"
          />
          <button className="search-clear-button" type="button" aria-label="Clear search" onClick={() => { setInput(''); setOpen(false); }}>×</button>
          <button className="search-run-button" type="submit">Run</button>
        </div>
        {open && mergedResults.length > 0 && (
          <div className="ticker-results" role="listbox">
            {mergedResults.map((row) => (
              <button key={`${row.symbol}-${row.name}`} type="button" onMouseDown={(event) => event.preventDefault()} onClick={() => { setInput(row.symbol); setOpen(false); onSelectSymbol?.(row.symbol); }}>
                <strong>{row.symbol}</strong><span>{row.name}</span><small>{row.sector} · {row.theme}</small>
              </button>
            ))}
          </div>
        )}
      </div>
      <div className="investment-context">
        <strong>{snapshot?.symbol}</strong>
        <span>{company.name || company.company || 'US listed security'}</span>
        <span>{company.exchange || 'US'} · USD</span>
        <StatusBadge status={quote.marketState || 'fallback'}>{quote.marketState || 'market'}</StatusBadge>
        <SourceBadge source={live.source || controls.dataMode} isDemo={live.isDemo} />
        <FreshnessBadge asOf={live.lastUpdated} stale={live.stale} />
        {latestCandleDate && <span title="Latest daily OHLC candle. During market closures this remains the last trading session.">Daily: {latestCandleDate}</span>}
      </div>
      <div className="investment-context">
        <button className="investment-button secondary" type="button" onClick={live.refresh}>Refresh</button>
        <button className="investment-button secondary" type="button">Watchlist</button>
      </div>
    </form>
  );
}
