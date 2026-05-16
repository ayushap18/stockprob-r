import React, { useMemo } from 'react';
import { ChartShell, EChart, EmptyChart, axisLabel, chartTheme, echartGrid } from './ChartPrimitives.jsx';

export default function MacroRegimeChart({ data = [], isDemo, warnings }) {
  const option = useMemo(() => {
    const t = chartTheme();
    return {
      grid: echartGrid(),
      legend: { textStyle: { color: t.muted }, top: 0 },
      xAxis: { type: 'category', data: data.map((row) => row.date), axisLabel: axisLabel(), axisLine: { lineStyle: { color: t.border } } },
      yAxis: [{ type: 'value', axisLabel: axisLabel(), splitLine: { lineStyle: { color: t.grid } } }, { type: 'value', min: 0, max: 1, axisLabel: axisLabel(), splitLine: { show: false } }],
      tooltip: { trigger: 'axis', backgroundColor: t.bg, borderColor: t.border, textStyle: { color: t.text } },
      series: [
        { name: '10Y', type: 'line', data: data.map((row) => row.treasury10y), smooth: true, showSymbol: false, color: t.cyan },
        { name: '2Y', type: 'line', data: data.map((row) => row.treasury2y), smooth: true, showSymbol: false, color: t.purple },
        { name: 'CPI YoY', type: 'line', data: data.map((row) => row.cpiYoY * 100), smooth: true, showSymbol: false, color: t.amber },
        { name: 'Macro score', type: 'line', yAxisIndex: 1, data: data.map((row) => row.macroScore), smooth: true, showSymbol: false, color: t.green },
      ],
    };
  }, [data]);
  return <ChartShell title="Macro Regime" subtitle="Rates, inflation, labor and macro score" isDemo={isDemo} warnings={warnings}>{data.length ? <EChart option={option} height={300} /> : <EmptyChart />}</ChartShell>;
}
