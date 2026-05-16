import React from 'react';
import { Area, CartesianGrid, ComposedChart, Line, ReferenceLine, Tooltip, XAxis, YAxis } from 'recharts';
import { ChartShell, EmptyChart, RechartsFrame, signedPct } from './ChartPrimitives.jsx';

export default function ExpectedReturnChart({ data = [], isDemo, warnings }) {
  return (
    <ChartShell title="Expected Return" subtitle="Expected return and expected excess return" isDemo={isDemo} warnings={warnings}>
      {data.length ? (
        <RechartsFrame height={250}>
          <ComposedChart data={data} margin={{ top: 16, right: 16, bottom: 8, left: 0 }}>
            <CartesianGrid stroke="rgba(148,163,184,0.13)" vertical={false} />
            <XAxis dataKey="date" tick={{ fill: '#8aa0ad', fontSize: 10 }} axisLine={false} tickLine={false} minTickGap={24} />
            <YAxis tickFormatter={(value) => signedPct(value)} tick={{ fill: '#8aa0ad', fontSize: 10 }} axisLine={false} tickLine={false} width={52} />
            <Tooltip formatter={(value) => signedPct(value)} contentStyle={{ background: '#071216', border: '1px solid #1e3a46' }} />
            <ReferenceLine y={0} stroke="#8aa0ad" strokeDasharray="4 4" />
            <Area dataKey="expectedReturn" fill="rgba(34,211,238,0.15)" stroke="#22d3ee" dot={false} isAnimationActive={false} />
            <Line dataKey="expectedExcessReturn" stroke="#22c55e" strokeWidth={2} dot={false} isAnimationActive={false} />
          </ComposedChart>
        </RechartsFrame>
      ) : <EmptyChart />}
    </ChartShell>
  );
}
