import React from 'react';

export default function MetricCard({ label, value, caption, tone = 'neutral', trend }) {
  return (
    <article className={`metric-card ${tone}`}>
      <span className="metric-label">{label}</span>
      <strong>{value}</strong>
      <small>{trend ? <span className={trend.tone || tone}>{trend.value}</span> : null}{trend ? ' · ' : ''}{caption}</small>
    </article>
  );
}
