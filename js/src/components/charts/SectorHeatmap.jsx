import React, { useMemo } from 'react';
import { ChartShell, EChart, EmptyChart, axisLabel, chartTheme } from './ChartPrimitives.jsx';

export default function SectorHeatmap({ data = [], isDemo, warnings }) {
  const option = useMemo(() => {
    const t = chartTheme();
    const sectors = [...new Set(data.map((row) => row.sector || 'Unknown'))];
    const metrics = ['Probability', 'Expected', 'Confidence', 'Risk'];
    const values = sectors.flatMap((sector, x) => metrics.map((metric, y) => {
      const rows = data.filter((row) => (row.sector || 'Unknown') === sector);
      const value = average(rows.map((row) => metric === 'Probability' ? row.probability : metric === 'Expected' ? row.expectedReturn + 0.5 : metric === 'Confidence' ? row.confidence : row.risk));
      return [x, y, value];
    }));
    return {
      tooltip: { backgroundColor: t.bg, borderColor: t.border, textStyle: { color: t.text } },
      grid: { left: 80, right: 24, top: 24, bottom: 64 },
      xAxis: { type: 'category', data: sectors, axisLabel: { ...axisLabel(), rotate: 30 }, axisLine: { lineStyle: { color: t.border } } },
      yAxis: { type: 'category', data: metrics, axisLabel: axisLabel(), axisLine: { lineStyle: { color: t.border } } },
      visualMap: { min: 0, max: 1, show: false, inRange: { color: ['#172554', '#0e7490', '#22c55e'] } },
      series: [{ type: 'heatmap', data: values, label: { show: true, formatter: (params) => Math.round(params.value[2] * 100), color: t.text } }],
    };
  }, [data]);
  return <ChartShell title="Sector Heatmap" subtitle="Average probability, expected return, confidence and risk by sector" isDemo={isDemo} warnings={warnings}>{data.length ? <EChart option={option} height={320} /> : <EmptyChart />}</ChartShell>;
}

function average(values) {
  const sample = values.filter((value) => Number.isFinite(Number(value))).map(Number);
  return sample.length ? sample.reduce((sum, value) => sum + value, 0) / sample.length : 0;
}
