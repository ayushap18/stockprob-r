import React from 'react';

export default function StatusBadge({ status = 'unknown', children }) {
  const normalized = String(status || 'unknown').toLowerCase();
  const tone = normalized.includes('ok') || normalized.includes('live') || normalized.includes('connected')
    ? 'ok'
    : normalized.includes('down') || normalized.includes('failed') || normalized.includes('offline')
      ? 'down'
      : normalized.includes('demo') ? 'demo' : normalized.includes('fallback') ? 'fallback' : normalized.includes('degraded') || normalized.includes('stale') || normalized.includes('warn') ? 'degraded' : 'neutral';
  return <span className={`status-badge ${tone}`}>{children || normalized}</span>;
}
