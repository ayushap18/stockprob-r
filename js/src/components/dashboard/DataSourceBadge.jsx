export default function DataSourceBadge({ source = 'cache', isDemo = false, stale = false, status = 'live' }) {
  const label = isDemo ? 'Demo' : stale ? 'Stale' : source === 'yfinance' || source === 'yahoo' ? 'Yahoo fallback' : source;
  return <span className={`data-source-badge ${isDemo ? 'demo' : stale ? 'stale' : status}`}>{label}</span>;
}
