import React from 'react';
import { Bar, BarChart, CartesianGrid, Tooltip, XAxis, YAxis } from 'recharts';
import { ChartShell, RechartsFrame, axisLabel, fmtPct } from './ChartPrimitives.jsx';

export default function ThresholdProbabilityChart({ simulation = {}, gainThreshold = 0.05, lossThreshold = -0.05, isDemo }) {
  const summary = simulation.summary || {};
  const rows = [
    { name: 'Profit', value: summary.probabilityProfit },
    { name: `Gain > ${fmtPct(gainThreshold, 0)}`, value: summary.probabilityGainGtThreshold },
    { name: `Loss < ${fmtPct(lossThreshold, 0)}`, value: summary.probabilityLossGtThreshold },
  ];
  return (
    <ChartShell title="Threshold Probabilities" subtitle="Simulation counted outcomes" isDemo={isDemo}>
      <RechartsFrame height={240}><BarChart data={rows}><CartesianGrid stroke="rgba(154,164,178,.12)" vertical={false} /><XAxis dataKey="name" tick={axisLabel()} /><YAxis tick={axisLabel()} domain={[0, 1]} tickFormatter={(v) => fmtPct(v, 0)} /><Tooltip contentStyle={{ background: '#10131a', border: '1px solid #242a35' }} formatter={(v) => fmtPct(v)} /><Bar dataKey="value" fill="#ff2d55" /></BarChart></RechartsFrame>
    </ChartShell>
  );
}
