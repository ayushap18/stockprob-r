import React from 'react';
import { Area, AreaChart, CartesianGrid, ReferenceLine, Tooltip, XAxis, YAxis } from 'recharts';
import { ChartShell, EmptyChart, RechartsFrame, axisLabel, signedPct } from './ChartPrimitives.jsx';

export default function RelativeStrengthChart({ data = [], benchmark = 'SPY', isDemo }) {
  const rows = data.map((row) => ({ ...row, relativeStrength: Number(row.stockReturn || 0) - Number(row.spyReturn || 0) }));
  return (
    <ChartShell title="Relative Strength" subtitle={`Cumulative spread versus ${benchmark}`} isDemo={isDemo}>
      {rows.length ? <RechartsFrame height={260}><AreaChart data={rows}><CartesianGrid stroke="rgba(154,164,178,.12)" vertical={false} /><XAxis dataKey="date" tick={axisLabel()} minTickGap={24} /><YAxis tick={axisLabel()} tickFormatter={(v) => signedPct(v, 0)} /><Tooltip contentStyle={{ background: '#10131a', border: '1px solid #242a35' }} formatter={(v) => signedPct(v)} /><ReferenceLine y={0} stroke="#9aa4b2" strokeDasharray="4 4" /><Area dataKey="relativeStrength" stroke="#16c784" fill="rgba(22,199,132,.14)" /></AreaChart></RechartsFrame> : <EmptyChart />}
    </ChartShell>
  );
}
