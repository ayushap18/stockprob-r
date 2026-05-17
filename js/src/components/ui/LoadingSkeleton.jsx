import React from 'react';

export default function LoadingSkeleton({ label = 'Loading' }) {
  return <div className="loading-skeleton" aria-label={label} />;
}
