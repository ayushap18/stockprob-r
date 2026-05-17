import React, { useMemo } from 'react';
import { ChartShell, EChart, chartTheme, fmtPct } from './ChartPrimitives.jsx';
import { scenarioAdjustedExpectedReturn, scenarioAdjustedVolatility } from '../../lib/math/scenarios.js';

export default function ScenarioComparisonChart({ expectedReturn = 0.08, volatility = 0.24, isDemo }) {
  const option = useMemo(() => {
    const t = chartTheme();
    const scenarios = ['base', 'bull', 'bear', 'high_volatility', 'recession_risk', 'earnings_week'];
    return {
      grid: { left: 62, right: 22, top: 24, bottom: 58 },
      tooltip: { backgroundColor: t.bg, borderColor: t.border, textStyle: { color: t.text } },
      legend: { textStyle: { color: t.muted } },
      xAxis: { type: 'category', data: scenarios.map((s) => s.replace('_', ' ')), axisLabel: { color: t.muted, rotate: 18 } },
      yAxis: { type: 'value', axisLabel: { color: t.muted, formatter: (value) => fmtPct(value, 0) }, splitLine: { lineStyle: { color: t.grid } } },
      series: [
        { name: 'Expected', type: 'bar', data: scenarios.map((s) => scenarioAdjustedExpectedReturn(expectedReturn, s)), itemStyle: { color: t.green } },
        { name: 'Volatility', type: 'bar', data: scenarios.map((s) => scenarioAdjustedVolatility(volatility, s)), itemStyle: { color: t.amber } },
      ],
    };
  }, [expectedReturn, volatility]);
  return <ChartShell title="Scenario Comparison" subtitle="Drift and volatility by scenario" isDemo={isDemo}><EChart option={option} height={280} /></ChartShell>;
}
