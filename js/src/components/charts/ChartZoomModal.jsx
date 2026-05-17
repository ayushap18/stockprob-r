import React, { useEffect } from 'react';

export default function ChartZoomModal({ chart, onClose }) {
  useEffect(() => {
    if (!chart) return undefined;
    const onKey = (event) => {
      if (event.key === 'Escape') onClose?.();
    };
    document.addEventListener('keydown', onKey);
    document.body.classList.add('chart-modal-open');
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.classList.remove('chart-modal-open');
    };
  }, [chart, onClose]);

  if (!chart) return null;
  return (
    <div className="chart-zoom-backdrop" role="presentation" onMouseDown={onClose}>
      <section className="chart-zoom-modal" role="dialog" aria-modal="true" aria-label={`${chart.title || 'Chart'} expanded`} onMouseDown={(event) => event.stopPropagation()}>
        <header>
          <div>
            <span className="section-kicker">{chart.caption || 'Expanded chart'}</span>
            <h2>{chart.title}</h2>
          </div>
          <button type="button" className="chart-zoom-close" onClick={onClose} aria-label="Close expanded chart">×</button>
        </header>
        {chart.controls && <div className="chart-zoom-controls">{chart.controls}</div>}
        <div className="chart-zoom-body">{chart.content}</div>
      </section>
    </div>
  );
}
