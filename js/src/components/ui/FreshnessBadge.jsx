import React from 'react';

export default function FreshnessBadge({ asOf, stale = false }) {
  const label = asOf ? new Date(asOf).toLocaleTimeString() : 'not updated';
  return <span className={`freshness-badge ${stale ? 'stale' : ''}`}>{stale ? 'stale' : label}</span>;
}
