import React from 'react';
import { Bar, BarChart, CartesianGrid, Tooltip, XAxis, YAxis } from 'recharts';
import { ChartShell, EmptyChart, RechartsFrame, signedPct } from './ChartPrimitives.jsx';

export default function BacktestDrawdownChart({ data = [], isDemo, warnings }) {
  return (
    <ChartShell title="Backtest Drawdown" subtitle="Peak-to-trough strategy drawdown" isDemo={isDemo} warnings={warnings}>
      {data.length ? (
        <RechartsFrame height={300}>
          <BarChart data={data} margin={{ top: 16, right: 16, bottom: 8, left: 0 }}>
            <CartesianGrid stroke="rgba(148,163,184,0.13)" vertical={false} />
            <XAxis dataKey="date" tick={{ fill: '#8aa0ad', fontSize: 10 }} axisLine={false} tickLine={false} minTickGap={26} />
            <YAxis tickFormatter={(value) => signedPct(value)} tick={{ fill: '#8aa0ad', fontSize: 10 }} axisLine={false} tickLine={false} width={52} />
            <Tooltip formatter={(value) => signedPct(value)} contentStyle={{ background: '#071216', border: '1px solid #1e3a46' }} />
            <Bar dataKey="drawdown" fill="#ef4444" isAnimationActive={false} />
          </BarChart>
        </RechartsFrame>
      ) : <EmptyChart />}
    </ChartShell>
  );
}
