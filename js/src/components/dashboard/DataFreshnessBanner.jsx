export default function DataFreshnessBanner({ warnings = [], isDemo = false, stale = false }) {
  const messages = [...new Set([...(isDemo ? ['Dashboard is using deterministic demo data for unavailable sections.'] : []), ...(stale ? ['Some values are stale while the background refresh runs.'] : []), ...warnings])].filter(Boolean);
  if (!messages.length) return null;
  return <section className="freshness-banner">{messages.slice(0, 5).map((warning) => <span key={warning}>{warning}</span>)}</section>;
}
