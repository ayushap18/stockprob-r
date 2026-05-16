import React, { useMemo } from 'react';
import { ChartShell, EChart, axisLabel, chartTheme, echartGrid } from './ChartPrimitives.jsx';

export default function FundamentalBreakdownChart({ prediction, isDemo, warnings }) {
  const f = prediction?.features?.fundamental || {};
  const rows = [
    ['Revenue Growth', f.revenue_growth_yoy],
    ['EPS Growth', f.eps_growth_yoy],
    ['Gross Margin', f.gross_margin],
    ['Net Margin', f.net_margin],
    ['ROE', f.return_on_equity],
    ['ROIC', f.return_on_invested_capital],
    ['Balance Sheet', f.balance_sheet_score],
    ['Valuation', f.valuation_score],
  ].map(([name, value]) => ({ name, value: Number.isFinite(Number(value)) ? Math.max(-0.5, Math.min(1, Number(value))) : 0 }));
  const option = useMemo(() => {
    const t = chartTheme();
    return {
      grid: { ...echartGrid(), left: 112 },
      xAxis: { type: 'value', axisLabel: axisLabel(), splitLine: { lineStyle: { color: t.grid } } },
      yAxis: { type: 'category', data: rows.map((row) => row.name).reverse(), axisLabel: axisLabel(), axisLine: { show: false }, axisTick: { show: false } },
      tooltip: { backgroundColor: t.bg, borderColor: t.border, textStyle: { color: t.text } },
      series: [{ type: 'bar', data: rows.map((row) => ({ value: row.value, itemStyle: { color: row.value < 0 ? t.red : t.green } })).reverse(), barWidth: 12 }],
    };
  }, [rows]);
  return <ChartShell title="Fundamental Breakdown" subtitle="Growth, margins, balance sheet, valuation" isDemo={isDemo} warnings={warnings}><EChart option={option} height={280} /></ChartShell>;
}
