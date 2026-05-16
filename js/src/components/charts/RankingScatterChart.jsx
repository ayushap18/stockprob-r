import React, { useMemo } from 'react';
import { ChartShell, EChart, EmptyChart, axisLabel, chartTheme, fmtPct } from './ChartPrimitives.jsx';

export default function RankingScatterChart({ data = [], isDemo, warnings }) {
  const option = useMemo(() => {
    const t = chartTheme();
    return {
      grid: { left: 56, right: 22, top: 24, bottom: 44 },
      xAxis: { type: 'value', axisLabel: { ...axisLabel(), formatter: (value) => fmtPct(value, 0) }, splitLine: { lineStyle: { color: t.grid } } },
      yAxis: { type: 'value', min: 0, max: 1, axisLabel: { ...axisLabel(), formatter: (value) => fmtPct(value, 0) }, splitLine: { lineStyle: { color: t.grid } } },
      tooltip: { backgroundColor: t.bg, borderColor: t.border, textStyle: { color: t.text }, formatter: (params) => `${params.data[3]}<br/>Expected: ${fmtPct(params.data[0])}<br/>Probability: ${fmtPct(params.data[1])}<br/>Confidence: ${fmtPct(params.data[2])}` },
      series: [{
        type: 'scatter',
        symbolSize: (dataPoint) => 10 + dataPoint[2] * 28,
        data: data.map((row) => [row.expectedReturn, row.probability, row.confidence, row.ticker, row.sector]),
        itemStyle: { color: t.cyan, opacity: 0.78 },
        markLine: { silent: true, symbol: 'none', lineStyle: { color: t.amber, type: 'dashed' }, data: [{ xAxis: 0 }, { yAxis: 0.5 }] },
      }],
    };
  }, [data]);
  return <ChartShell title="Ranking Scatter" subtitle="Expected return vs probability; bubble size is confidence" isDemo={isDemo} warnings={warnings}>{data.length ? <EChart option={option} height={330} /> : <EmptyChart />}</ChartShell>;
}
