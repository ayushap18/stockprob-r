import React from 'react';
import { CartesianGrid, Line, LineChart, ReferenceLine, Tooltip, XAxis, YAxis } from 'recharts';
import { ChartShell, EmptyChart, RechartsFrame, fmtPct } from './ChartPrimitives.jsx';

export default function ProbabilityTrendChart({ data = [], isDemo, warnings }) {
  return (
    <ChartShell title="Probability Trend" subtitle="Outperform-SPY probability over time" isDemo={isDemo} warnings={warnings}>
      {data.length ? (
        <RechartsFrame height={250}>
          <LineChart data={data} margin={{ top: 16, right: 16, bottom: 8, left: 0 }}>
            <CartesianGrid stroke="rgba(148,163,184,0.13)" vertical={false} />
            <XAxis dataKey="date" tick={{ fill: '#8aa0ad', fontSize: 10 }} axisLine={false} tickLine={false} minTickGap={24} />
            <YAxis domain={[0, 1]} tickFormatter={(value) => fmtPct(value, 0)} tick={{ fill: '#8aa0ad', fontSize: 10 }} axisLine={false} tickLine={false} width={44} />
            <Tooltip formatter={(value) => fmtPct(value)} contentStyle={{ background: '#071216', border: '1px solid #1e3a46' }} />
            <ReferenceLine y={0.5} stroke="#f59e0b" strokeDasharray="4 4" />
            <Line dataKey="probability" stroke="#22d3ee" strokeWidth={2.4} dot={false} isAnimationActive={false} />
          </LineChart>
        </RechartsFrame>
      ) : <EmptyChart />}
    </ChartShell>
  );
}
