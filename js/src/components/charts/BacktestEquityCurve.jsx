import React from 'react';
import { CartesianGrid, Line, LineChart, Tooltip, XAxis, YAxis } from 'recharts';
import { ChartShell, EmptyChart, RechartsFrame } from './ChartPrimitives.jsx';

export default function BacktestEquityCurve({ data = [], isDemo, warnings }) {
  return (
    <ChartShell title="Backtest Equity Curve" subtitle="Strategy equity curve versus SPY" isDemo={isDemo} warnings={warnings}>
      {data.length ? (
        <RechartsFrame height={300}>
          <LineChart data={data} margin={{ top: 16, right: 16, bottom: 8, left: 0 }}>
            <CartesianGrid stroke="rgba(148,163,184,0.13)" vertical={false} />
            <XAxis dataKey="date" tick={{ fill: '#8aa0ad', fontSize: 10 }} axisLine={false} tickLine={false} minTickGap={26} />
            <YAxis tickFormatter={(value) => `${Number(value).toFixed(2)}x`} tick={{ fill: '#8aa0ad', fontSize: 10 }} axisLine={false} tickLine={false} width={50} />
            <Tooltip contentStyle={{ background: '#071216', border: '1px solid #1e3a46' }} />
            <Line dataKey="strategy" stroke="#22d3ee" dot={false} strokeWidth={2.4} isAnimationActive={false} />
            <Line dataKey="spy" stroke="#94a3b8" dot={false} strokeWidth={2} isAnimationActive={false} />
          </LineChart>
        </RechartsFrame>
      ) : <EmptyChart />}
    </ChartShell>
  );
}
