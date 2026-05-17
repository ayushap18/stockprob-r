import React, { useMemo } from 'react';
import { ChartShell, EmptyChart, PlotlyChart, chartTheme, signedPct } from './ChartPrimitives.jsx';

export default function MonteCarloHistogram({ simulation, isDemo, warnings, height = 310 }) {
  const traces = useMemo(() => {
    const returns = simulation?.finalReturns || [];
    if (!returns.length) return [];
    return [{ type: 'histogram', x: returns, nbinsx: 42, marker: { color: 'rgba(34,211,238,0.72)' }, name: 'Final returns' }];
  }, [simulation]);
  const summary = simulation?.summary || {};
  const shapes = [summary.meanFinalReturn, summary.medianFinalReturn, summary.valueAtRisk5].filter(Number.isFinite).map((x, index) => ({
    type: 'line',
    x0: x,
    x1: x,
    y0: 0,
    y1: 1,
    yref: 'paper',
    line: { color: [chartTheme().green, chartTheme().cyan, chartTheme().red][index], width: 2, dash: index === 2 ? 'dash' : 'solid' },
  }));
  return (
    <ChartShell title="Terminal Return Distribution" subtitle="Mean, median, and VaR markers" isDemo={isDemo} warnings={warnings}>
      {traces.length ? <PlotlyChart data={traces} layout={{ shapes, xaxis: { tickformat: '.1%' }, yaxis: { title: 'Path count' } }} height={height} /> : <EmptyChart />}
      <small className="chart-footnote">Mean {signedPct(summary.meanFinalReturn)} · Median {signedPct(summary.medianFinalReturn)} · VaR 5% {signedPct(summary.valueAtRisk5)}</small>
    </ChartShell>
  );
}
