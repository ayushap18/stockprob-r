import React from 'react';
import { ChartShell, fmtMoney, fmtPct, signedPct } from './ChartPrimitives.jsx';

export default function MonteCarloRiskCards({ simulation, probabilityOutperformSpy, isDemo, warnings }) {
  const summary = simulation?.summary || {};
  const cards = [
    ['P(profit)', fmtPct(summary.probabilityProfit)],
    ['P(outperform SPY)', fmtPct(probabilityOutperformSpy ?? simulation?.probabilityOutperformSpy)],
    ['Mean final', fmtMoney(summary.meanFinalPrice)],
    ['Median return', signedPct(summary.medianFinalReturn)],
    ['VaR 5%', signedPct(summary.valueAtRisk5)],
    ['CVaR 5%', signedPct(summary.expectedShortfall5)],
    ['Max DD est.', signedPct(summary.maxDrawdownEstimate)],
  ];
  return (
    <ChartShell title="Monte Carlo Risk" subtitle="Counted simulation summary" isDemo={isDemo} warnings={warnings}>
      <div className="analytics-metric-grid">
        {cards.map(([label, value]) => <div key={label}><span>{label}</span><strong>{value}</strong></div>)}
      </div>
    </ChartShell>
  );
}
