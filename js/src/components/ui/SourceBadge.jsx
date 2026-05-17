import React from 'react';

export default function SourceBadge({ source = 'demo', isDemo = false }) {
  return <span className={`source-badge ${isDemo ? 'demo' : ''}`}>{isDemo ? 'demo' : source}</span>;
}
