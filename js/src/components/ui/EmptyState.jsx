import React from 'react';

export default function EmptyState({ title = 'No data', message = 'Try a different symbol or refresh.' }) {
  return <section className="empty-state"><strong>{title}</strong><span>{message}</span></section>;
}
