import React from 'react';

export default function PageHeader({ eyebrow, title, actions }) {
  return (
    <section className="page-header">
      <div><span className="section-kicker">{eyebrow}</span><h1>{title}</h1></div>
      <div className="investment-context">{actions}</div>
    </section>
  );
}
