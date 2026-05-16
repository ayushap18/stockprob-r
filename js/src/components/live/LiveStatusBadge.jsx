import React from 'react';

export default function LiveStatusBadge({ status = 'connecting', source, isDemo, lastUpdated }) {
  const label = isDemo ? 'Demo' : status === 'live' ? 'Live' : status === 'fallback' ? 'Fallback' : status === 'offline' ? 'Offline' : status === 'reconnecting' ? 'Reconnecting' : 'Connecting';
  return (
    <span className={`live-status-badge ${String(status).toLowerCase()} ${isDemo ? 'demo' : ''}`}>
      <i />
      {label}
      {source && <b>{source}</b>}
      {lastUpdated && <small>{new Date(lastUpdated).toLocaleTimeString()}</small>}
    </span>
  );
}
