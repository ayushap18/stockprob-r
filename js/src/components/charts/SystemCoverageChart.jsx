import { ChartShell, EChart, axisLabel, chartTheme, echartGrid } from './ChartPrimitives.jsx';

export default function SystemCoverageChart({ data = [], isDemo = false, warnings = [] }) {
  const t = chartTheme();
  const rows = Array.isArray(data) && data.length ? data : [
    { name: 'Quotes', coverage: 0.82 },
    { name: 'OHLCV', coverage: 0.76 },
    { name: 'Fundamentals', coverage: 0.48 },
    { name: 'News', coverage: 0.41 },
    { name: 'Macro', coverage: 0.9 },
    { name: 'Backtests', coverage: 0.62 },
  ];
  return (
    <ChartShell title="System Coverage" subtitle="Endpoint and data coverage by dashboard section" isDemo={isDemo} warnings={warnings}>
      <EChart
        height={300}
        option={{
          backgroundColor: 'transparent',
          grid: echartGrid(),
          xAxis: { type: 'value', min: 0, max: 1, axisLabel: { ...axisLabel(), formatter: (value) => `${Math.round(value * 100)}%` }, splitLine: { lineStyle: { color: t.grid } } },
          yAxis: { type: 'category', data: rows.map((row) => row.name), axisLabel: axisLabel(t.text) },
          series: [{ type: 'bar', data: rows.map((row) => row.coverage), itemStyle: { color: t.cyan }, barWidth: 12 }],
          tooltip: { valueFormatter: (value) => `${Math.round(value * 100)}%` },
        }}
      />
    </ChartShell>
  );
}
