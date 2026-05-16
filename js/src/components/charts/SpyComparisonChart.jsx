import React from 'react';
import { CartesianGrid, Line, LineChart, Tooltip, XAxis, YAxis } from 'recharts';
import { ChartShell, EmptyChart, RechartsFrame, signedPct } from './ChartPrimitives.jsx';

export default function SpyComparisonChart({ data = [], isDemo, warnings }) {
  return (
    <ChartShell title="Stock vs SPY" subtitle="Cumulative return and excess return" isDemo={isDemo} warnings={warnings}>
      {data.length ? (
        <RechartsFrame>
          <LineChart data={data} margin={{ top: 16, right: 16, bottom: 8, left: 0 }}>
            <CartesianGrid stroke="rgba(148,163,184,0.13)" vertical={false} />
            <XAxis dataKey="date" tick={{ fill: '#8aa0ad', fontSize: 10 }} tickLine={false} axisLine={false} minTickGap={28} />
            <YAxis tickFormatter={(value) => signedPct(value)} tick={{ fill: '#8aa0ad', fontSize: 10 }} tickLine={false} axisLine={false} width={52} />
            <Tooltip formatter={(value) => signedPct(value)} contentStyle={{ background: '#071216', border: '1px solid #1e3a46' }} />
            <Line dataKey="stockReturn" name="Stock" stroke="#22d3ee" dot={false} strokeWidth={2} isAnimationActive={false} />
            <Line dataKey="spyReturn" name="SPY" stroke="#94a3b8" dot={false} strokeWidth={2} isAnimationActive={false} />
            <Line dataKey="excessReturn" name="Excess" stroke="#22c55e" dot={false} strokeWidth={1.5} isAnimationActive={false} />
          </LineChart>
        </RechartsFrame>
      ) : <EmptyChart />}
    </ChartShell>
  );
}
