import React from 'react';
import { Bar, BarChart, CartesianGrid, Tooltip, XAxis, YAxis } from 'recharts';
import { ChartShell, EmptyChart, RechartsFrame, axisLabel } from './ChartPrimitives.jsx';

export default function VolumeChart({ data = [], isDemo }) {
  const rows = data.filter((row) => Number.isFinite(Number(row.volume))).slice(-90);
  return (
    <ChartShell title="Volume" subtitle="Daily traded volume" isDemo={isDemo}>
      {rows.length ? <RechartsFrame height={220}><BarChart data={rows}><CartesianGrid stroke="rgba(154,164,178,.12)" vertical={false} /><XAxis dataKey="date" tick={axisLabel()} minTickGap={24} /><YAxis tick={axisLabel()} tickFormatter={(v) => `${Math.round(v / 1_000_000)}M`} /><Tooltip contentStyle={{ background: '#10131a', border: '1px solid #242a35' }} /><Bar dataKey="volume" fill="#3b82f6" /></BarChart></RechartsFrame> : <EmptyChart />}
    </ChartShell>
  );
}
