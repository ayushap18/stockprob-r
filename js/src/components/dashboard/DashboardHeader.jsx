import DataSourceBadge from './DataSourceBadge.jsx';

export default function DashboardHeader({ snapshot, meta = {} }) {
  const quote = snapshot?.quote || {};
  const company = snapshot?.company || {};
  return (
    <section className="connected-dashboard-header">
      <div>
        <span className="micro-label">Connected Dashboard</span>
        <h1>{snapshot?.symbol || 'MSFT'} <small>{company.name || company.company || 'US listed security'}</small></h1>
        <p>{company.sector || 'Sector unavailable'} · {company.industry || 'Industry unavailable'}</p>
      </div>
      <div className="connected-header-metrics">
        <strong>${Number(quote.price || 0).toFixed(2)}</strong>
        <span>{Number(quote.changePercent || 0) >= 0 ? '+' : ''}{Number(quote.changePercent || 0).toFixed(2)}%</span>
        <DataSourceBadge source={meta.source} isDemo={meta.isDemo} stale={meta.stale} />
      </div>
    </section>
  );
}
