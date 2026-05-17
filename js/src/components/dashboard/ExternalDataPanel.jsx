import React from 'react';
import StatusBadge from '../ui/StatusBadge.jsx';

const providerPurpose = {
  polygon: 'Prices / options',
  'YFinance/Yahoo': 'Public fallback quotes',
  yahoo: 'Public fallback quotes',
  fmp: 'Fundamentals',
  alpha_vantage: 'News sentiment',
  fred: 'Macro',
  sec: 'Filings / insiders',
  redis: 'Cache',
  postgres: 'Storage',
  demo: 'Deterministic fallback',
};

export default function ExternalDataPanel({ providers = [], currentSource = 'demo' }) {
  return (
    <section className="table-card">
      <div className="section-title-row">
        <div><span className="section-kicker">External Data</span><h2>Provider Sources</h2></div>
        <span className="source-badge">current {currentSource}</span>
      </div>
      <div className="provider-grid">
        {providers.map((provider) => (
          <div key={provider.provider} className="provider-row">
            <strong>{provider.provider}</strong>
            <span>{providerPurpose[provider.provider] || providerPurpose[String(provider.provider).toLowerCase()] || 'Market data'}</span>
            <StatusBadge status={provider.status}>{provider.status}</StatusBadge>
            <small>{provider.latencyMs || provider.averageLatencyMs ? `${Math.round(provider.latencyMs || provider.averageLatencyMs)}ms` : 'no latency'}</small>
            <small>{provider.lastRefresh || provider.lastSuccessAt || 'not refreshed'}</small>
          </div>
        ))}
      </div>
    </section>
  );
}
