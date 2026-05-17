import React, { useMemo } from 'react';
import { downsamplePaths } from '../../lib/monteCarlo.js';
import { ChartShell, EmptyChart, PlotlyChart, chartTheme, fmtMoney } from './ChartPrimitives.jsx';

export default function MonteCarloFanChart({ simulation, isDemo, warnings, height = 360 }) {
  const traces = useMemo(() => {
    if (!simulation?.percentiles?.length) return [];
    const t = chartTheme();
    const x = simulation.percentiles.map((row) => row.day);
    const percentileTraces = [
      { y: simulation.percentiles.map((row) => row.p95), name: 'P95', line: { color: 'rgba(34,211,238,0.25)' } },
      { y: simulation.percentiles.map((row) => row.p75), name: 'P75', line: { color: 'rgba(34,211,238,0.45)' }, fill: 'tonexty', fillcolor: 'rgba(34,211,238,0.08)' },
      { y: simulation.percentiles.map((row) => row.p50), name: 'P50', line: { color: t.cyan, width: 3 } },
      { y: simulation.percentiles.map((row) => row.p25), name: 'P25', line: { color: 'rgba(139,92,246,0.6)' } },
      { y: simulation.percentiles.map((row) => row.p5), name: 'P5', line: { color: 'rgba(139,92,246,0.35)' }, fill: 'tonexty', fillcolor: 'rgba(139,92,246,0.08)' },
    ].map((trace) => ({ type: 'scatter', mode: 'lines', x, hovertemplate: `%{y:$,.2f}<extra>${trace.name}</extra>`, ...trace }));
    const samples = downsamplePaths(simulation.paths || [], 30).map((path, index) => ({
      type: 'scatter',
      mode: 'lines',
      x,
      y: path,
      name: `Path ${index + 1}`,
      showlegend: false,
      line: { color: 'rgba(148,163,184,0.16)', width: 1 },
      hoverinfo: 'skip',
    }));
    return [...samples, ...percentileTraces];
  }, [simulation]);
  return (
    <ChartShell title="Monte Carlo Fan" subtitle="GBM percentile bands with limited sampled paths" isDemo={isDemo} warnings={warnings}>
      {traces.length ? <PlotlyChart data={traces} layout={{ yaxis: { tickprefix: '$', hoverformat: '$,.2f' }, xaxis: { title: 'Trading days' } }} height={height} /> : <EmptyChart />}
      {simulation?.summary && <small className="chart-footnote">Median final: {fmtMoney(simulation.summary.medianFinalPrice)} · P5/P95: {fmtMoney(simulation.summary.p5FinalPrice)} / {fmtMoney(simulation.summary.p95FinalPrice)}</small>}
    </ChartShell>
  );
}
