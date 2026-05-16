import React, { useMemo } from 'react';
import { ChartShell, EChart, EmptyChart, axisLabel, chartTheme, fmtPct } from './ChartPrimitives.jsx';

export default function CalibrationCurve({ data = [], isDemo, warnings }) {
  const option = useMemo(() => {
    const t = chartTheme();
    const rows = data.map((row, index) => ({ predicted: Number(row.predicted ?? row.avg_probability ?? index / 10), realized: Number(row.realized ?? row.observed_rate ?? 0), bucket: row.bucket || `${index}` }));
    return {
      grid: { left: 54, right: 20, top: 24, bottom: 42 },
      xAxis: { type: 'value', min: 0, max: 1, axisLabel: { ...axisLabel(), formatter: (value) => fmtPct(value, 0) }, splitLine: { lineStyle: { color: t.grid } } },
      yAxis: { type: 'value', min: 0, max: 1, axisLabel: { ...axisLabel(), formatter: (value) => fmtPct(value, 0) }, splitLine: { lineStyle: { color: t.grid } } },
      tooltip: { backgroundColor: t.bg, borderColor: t.border, textStyle: { color: t.text } },
      series: [
        { type: 'line', data: [[0, 0], [1, 1]], lineStyle: { color: t.green, type: 'dashed' }, showSymbol: false, name: 'Ideal' },
        { type: 'line', data: rows.map((row) => [row.predicted, row.realized]), lineStyle: { color: t.cyan, width: 3 }, symbolSize: 8, name: 'Model' },
      ],
    };
  }, [data]);
  return <ChartShell title="Calibration Curve" subtitle="Predicted probability bucket vs realized hit rate" isDemo={isDemo} warnings={warnings}>{data.length ? <EChart option={option} height={300} /> : <EmptyChart />}</ChartShell>;
}
