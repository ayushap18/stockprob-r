import React, { useMemo } from 'react';
import { ChartShell, EChart, EmptyChart, axisLabel, chartTheme, fmtPct } from './ChartPrimitives.jsx';

export default function ConfidenceBucketChart({ data = [], isDemo, warnings }) {
  const rows = Array.isArray(data) ? data : Object.entries(data).map(([bucket, hitRate]) => ({ bucket, hitRate, averageReturn: 0 }));
  const option = useMemo(() => {
    const t = chartTheme();
    return {
      grid: { left: 52, right: 22, top: 24, bottom: 40 },
      legend: { textStyle: { color: t.muted } },
      xAxis: { type: 'category', data: rows.map((row) => row.bucket), axisLabel: axisLabel(), axisLine: { lineStyle: { color: t.border } } },
      yAxis: { type: 'value', axisLabel: { ...axisLabel(), formatter: (value) => fmtPct(value, 0) }, splitLine: { lineStyle: { color: t.grid } } },
      tooltip: { backgroundColor: t.bg, borderColor: t.border, textStyle: { color: t.text } },
      series: [
        { name: 'Hit rate', type: 'bar', data: rows.map((row) => row.hitRate), color: t.cyan },
        { name: 'Avg return', type: 'line', data: rows.map((row) => row.averageReturn), color: t.green },
      ],
    };
  }, [rows]);
  return <ChartShell title="Confidence Buckets" subtitle="Hit rate and average return by confidence bucket" isDemo={isDemo} warnings={warnings}>{rows.length ? <EChart option={option} height={300} /> : <EmptyChart />}</ChartShell>;
}
