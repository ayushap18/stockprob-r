import React, { useMemo } from 'react';
import { ChartShell, EChart, EmptyChart, axisLabel, chartTheme, echartGrid } from './ChartPrimitives.jsx';

export default function TechnicalBreakdownChart({ prediction, isDemo, warnings }) {
  const technical = prediction?.features?.technical || {};
  const rows = [
    ['Momentum', prediction?.technicalScore],
    ['RSI 14', technical.rsi_14 ? technical.rsi_14 / 100 : null],
    ['Volume Z', technical.volume_z_score ? Math.min(1, Math.abs(technical.volume_z_score) / 3) : null],
    ['Beta', technical.beta_vs_spy ? Math.min(1, technical.beta_vs_spy / 2) : null],
    ['Relative Strength', technical.sector_relative_strength ? technical.sector_relative_strength + 0.5 : null],
    ['Mean Reversion', technical.mean_reversion_score],
  ].map(([name, value]) => ({ name, value: Number.isFinite(Number(value)) ? Math.max(0, Math.min(1, Number(value))) : 0.5 }));
  const option = useMemo(() => scoreOption(rows), [rows]);
  return <ChartShell title="Technical Breakdown" subtitle="Momentum, volatility, RSI, volume, beta, relative strength" isDemo={isDemo} warnings={warnings}>{rows.length ? <EChart option={option} height={280} /> : <EmptyChart />}</ChartShell>;
}

export function scoreOption(rows) {
  const t = chartTheme();
  return {
    grid: { ...echartGrid(), left: 118 },
    xAxis: { type: 'value', min: 0, max: 1, axisLabel: { ...axisLabel(), formatter: (value) => `${Math.round(value * 100)}` }, splitLine: { lineStyle: { color: t.grid } } },
    yAxis: { type: 'category', data: rows.map((row) => row.name).reverse(), axisLabel: axisLabel(), axisLine: { show: false }, axisTick: { show: false } },
    tooltip: { backgroundColor: t.bg, borderColor: t.border, textStyle: { color: t.text } },
    series: [{ type: 'bar', data: rows.map((row) => row.value).reverse(), itemStyle: { color: t.cyan }, barWidth: 12 }],
  };
}
