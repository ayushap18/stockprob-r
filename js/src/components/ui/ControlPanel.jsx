import React from 'react';

export default function ControlPanel({ title, children }) {
  return (
    <section className="control-panel">
      <div className="section-title-row"><div><span className="section-kicker">Controls</span><h2>{title}</h2></div></div>
      <div className="control-panel-grid">{children}</div>
    </section>
  );
}
