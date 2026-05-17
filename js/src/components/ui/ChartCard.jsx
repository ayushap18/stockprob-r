import React from 'react';

export default function ChartCard({ title, caption, badge, controls, onExpand, children }) {
  return (
    <section className={`chart-card ${onExpand ? 'is-expandable' : ''}`} onDoubleClick={onExpand}>
      <div className="chart-title-row">
        <div>
          <span className="section-kicker">{caption}</span>
          <h2>{title}</h2>
        </div>
        <div className="chart-card-actions" onClick={(event) => event.stopPropagation()}>
          {badge}
          {onExpand && <button type="button" className="chart-expand-button" onClick={onExpand} aria-label={`Expand ${title}`}>⛶</button>}
        </div>
      </div>
      {controls && <div className="chart-card-controls">{controls}</div>}
      {children}
    </section>
  );
}
