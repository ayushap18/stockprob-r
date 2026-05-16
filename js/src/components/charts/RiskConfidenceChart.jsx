import React from 'react';
import { CartesianGrid, Line, LineChart, Tooltip, XAxis, YAxis } from 'recharts';
import { ChartShell, EmptyChart, RechartsFrame, fmtPct } from './ChartPrimitives.jsx';

export default function RiskConfidenceChart({ data = [], isDemo, warnings }) {
  return (
    <ChartShell title="Risk / Confidence" subtitle="Confidence should rise only with data quality and calibration" isDemo={isDemo} warnings={warnings}>
      {data.length ? (
        <RechartsFrame height={250}>
          <LineChart data={data} margin={{ top: 16, right: 16, bottom: 8, left: 0 }}>
            <CartesianGrid stroke="rgba(148,163,184,0.13)" vertical={false} />
            <XAxis dataKey="date" tick={{ fill: '#8aa0ad', fontSize: 10 }} axisLine={false} tickLine={false} minTickGap={24} />
            <YAxis domain={[0, 1]} tickFormatter={(value) => fmtPct(value, 0)} tick={{ fill: '#8aa0ad', fontSize: 10 }} axisLine={false} tickLine={false} width={44} />
            <Tooltip formatter={(value) => fmtPct(value)} contentStyle={{ background: '#071216', border: '1px solid #1e3a46' }} />
            <Line dataKey="risk" stroke="#ef4444" strokeWidth={2} dot={false} isAnimationActive={false} />
            <Line dataKey="confidence" stroke="#22c55e" strokeWidth={2} dot={false} isAnimationActive={false} />
          </LineChart>
        </RechartsFrame>
      ) : <EmptyChart />}
    </ChartShell>
  );
}
