import React from 'react';

export default function ChartCard({ title, caption, badge, children }) {
  return (
    <section className="chart-card">
      <div className="chart-title-row">
        <div>
          <span className="section-kicker">{caption}</span>
          <h2>{title}</h2>
        </div>
        {badge}
      </div>
      {children}
    </section>
  );
}
