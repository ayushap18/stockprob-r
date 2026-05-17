import React, { useMemo } from 'react';
import { ChartShell, EChart, EmptyChart, axisLabel, chartTheme, echartGrid } from './ChartPrimitives.jsx';

export default function FeatureImportanceChart({ data = [], isDemo, warnings, height = 340, limit = 14 }) {
  const option = useMemo(() => {
    const rows = [...data].sort((a, b) => Math.abs(b.importance) - Math.abs(a.importance)).slice(0, limit).reverse();
    const t = chartTheme();
    return {
      grid: { ...echartGrid(), left: 132 },
      xAxis: { type: 'value', axisLabel: axisLabel(), splitLine: { lineStyle: { color: t.grid } } },
      yAxis: { type: 'category', data: rows.map((row) => row.feature), axisLabel: axisLabel(), axisLine: { show: false }, axisTick: { show: false } },
      tooltip: { trigger: 'axis', backgroundColor: t.bg, borderColor: t.border, textStyle: { color: t.text } },
      series: [{ type: 'bar', data: rows.map((row) => ({ value: row.importance, itemStyle: { color: row.impact < 0 ? t.red : t.cyan } })), barWidth: 12 }],
    };
  }, [data, limit]);
  return <ChartShell title="Feature Importance" subtitle="Sorted by absolute model contribution" isDemo={isDemo} warnings={warnings}>{data.length ? <EChart option={option} height={height} /> : <EmptyChart />}</ChartShell>;
}
