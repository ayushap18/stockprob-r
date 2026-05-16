import React, { useLayoutEffect, useRef, useState } from 'react';
import {
  Area,
  Bar,
  BarChart,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  LineChart as RechartsLineChart,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

export default function ChartRenderer({ type, ...props }) {
  if (type === 'line') return <LineChart {...props} />;
  if (type === 'fan') return <FanChart {...props} />;
  if (type === 'bar') return <BarStrip {...props} />;
  return null;
}

function LineChart({ data, compact = false }) {
  const chartData = data.map((row) => ({
    period: row[0],
    model: Number(row[1] || 1),
    spy: Number(row[2] || 1),
  }));
  return (
    <MeasuredChartFrame className={`chart-frame ${compact ? 'compact' : ''}`}>
      {({ width, height }) => (
        <RechartsLineChart width={width} height={height} data={chartData} margin={{ top: 12, right: 12, bottom: 8, left: 0 }}>
          <CartesianGrid stroke="rgba(148, 163, 184, 0.13)" vertical={false} />
          <XAxis dataKey="period" tick={{ fill: '#94a3b8', fontSize: 10 }} axisLine={false} tickLine={false} />
          <YAxis domain={['dataMin', 'dataMax']} tickFormatter={(value) => `${Number(value).toFixed(2)}x`} tick={{ fill: '#94a3b8', fontSize: 10 }} axisLine={false} tickLine={false} width={44} />
          <Tooltip content={<ChartTooltip formatter={(value) => `${Number(value).toFixed(4)}x`} />} />
          <Legend wrapperStyle={{ color: '#94a3b8', fontSize: 11 }} />
          <Line type="monotone" dataKey="spy" name="SPY" stroke="rgba(148, 163, 184, 0.82)" dot={false} strokeWidth={2} isAnimationActive={false} />
          <Line type="monotone" dataKey="model" name="Model" stroke="#22d3ee" dot={false} strokeWidth={2.5} isAnimationActive={false} />
        </RechartsLineChart>
      )}
    </MeasuredChartFrame>
  );
}

function FanChart({ simulation }) {
  const chartData = simulation.percentiles.map((point, index) => ({
    day: point.day,
    p05: point.p05,
    p25: point.p25,
    p50: point.p50,
    p75: point.p75,
    p95: point.p95,
    sample1: simulation.samplePaths[0]?.[index],
    sample2: simulation.samplePaths[1]?.[index],
    sample3: simulation.samplePaths[2]?.[index],
  }));
  return (
    <MeasuredChartFrame className="chart-frame fan">
      {({ width, height }) => (
        <ComposedChart width={width} height={height} data={chartData} margin={{ top: 12, right: 12, bottom: 8, left: 0 }}>
          <CartesianGrid stroke="rgba(148, 163, 184, 0.13)" vertical={false} />
          <XAxis dataKey="day" tick={{ fill: '#94a3b8', fontSize: 10 }} axisLine={false} tickLine={false} />
          <YAxis tickFormatter={(value) => signedPct(value)} tick={{ fill: '#94a3b8', fontSize: 10 }} axisLine={false} tickLine={false} width={52} />
          <Tooltip content={<ChartTooltip formatter={(value) => signedPct(value)} />} />
          <Legend wrapperStyle={{ color: '#94a3b8', fontSize: 11 }} />
          <Area type="monotone" dataKey="p95" name="P95" fill="rgba(34, 211, 238, 0.10)" stroke="rgba(103, 232, 249, 0.34)" dot={false} isAnimationActive={false} />
          <Line type="monotone" dataKey="p75" name="P75" stroke="rgba(103, 232, 249, 0.46)" dot={false} strokeWidth={1.4} isAnimationActive={false} />
          <Line type="monotone" dataKey="p50" name="Median" stroke="#67e8f9" dot={false} strokeWidth={2.5} isAnimationActive={false} />
          <Line type="monotone" dataKey="p25" name="P25" stroke="rgba(103, 232, 249, 0.46)" dot={false} strokeWidth={1.4} isAnimationActive={false} />
          <Line type="monotone" dataKey="p05" name="P05" stroke="rgba(103, 232, 249, 0.34)" dot={false} strokeWidth={1.2} isAnimationActive={false} />
          <Line type="monotone" dataKey="sample1" name="Path A" stroke="rgba(134, 239, 172, 0.8)" dot={false} strokeWidth={1.2} isAnimationActive={false} />
          <Line type="monotone" dataKey="sample2" name="Path B" stroke="rgba(251, 191, 36, 0.65)" dot={false} strokeWidth={1.1} isAnimationActive={false} />
          <Line type="monotone" dataKey="sample3" name="Path C" stroke="rgba(148, 163, 184, 0.55)" dot={false} strokeWidth={1} isAnimationActive={false} />
        </ComposedChart>
      )}
    </MeasuredChartFrame>
  );
}

function BarStrip({ values, labels = [], negative = false }) {
  const chartData = values.map((value, index) => ({
    label: labels[index] || String(index + 1),
    value: Number(value || 0),
  }));
  return (
    <MeasuredChartFrame className={`chart-frame bar ${negative ? 'drawdown' : ''}`}>
      {({ width, height }) => (
        <BarChart width={width} height={height} data={chartData} margin={{ top: 12, right: 12, bottom: 8, left: 0 }}>
          <CartesianGrid stroke="rgba(148, 163, 184, 0.13)" vertical={false} />
          <XAxis dataKey="label" tick={{ fill: '#94a3b8', fontSize: 10 }} axisLine={false} tickLine={false} />
          <YAxis tickFormatter={(value) => pct(value)} tick={{ fill: '#94a3b8', fontSize: 10 }} axisLine={false} tickLine={false} width={44} />
          <Tooltip content={<ChartTooltip formatter={(value) => pct(value)} />} />
          <Bar dataKey="value" name={negative ? 'Drawdown' : 'Value'} fill={negative ? '#f43f5e' : '#22d3ee'} radius={[5, 5, 0, 0]} isAnimationActive={false} />
        </BarChart>
      )}
    </MeasuredChartFrame>
  );
}

function MeasuredChartFrame({ className, children }) {
  const ref = useRef(null);
  const [size, setSize] = useState({ width: 0, height: 0 });

  useLayoutEffect(() => {
    if (!ref.current) return undefined;
    const update = () => {
      const rect = ref.current.getBoundingClientRect();
      setSize({ width: Math.max(1, Math.floor(rect.width)), height: Math.max(1, Math.floor(rect.height)) });
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);

  return <div ref={ref} className={className}>{size.width > 1 && size.height > 1 ? children(size) : null}</div>;
}

function ChartTooltip({ active, payload, label, formatter = (value) => value }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="chart-tooltip">
      <strong>{label}</strong>
      {payload.map((entry) => (
        <span key={entry.dataKey} style={{ color: entry.color }}>
          {entry.name}: {formatter(entry.value)}
        </span>
      ))}
    </div>
  );
}

function pct(value) {
  return Number.isFinite(Number(value)) ? `${Math.round(Number(value) * 100)}%` : 'n/a';
}

function signedPct(value) {
  if (!Number.isFinite(Number(value))) return 'n/a';
  const number = Number(value) * 100;
  return `${number >= 0 ? '+' : ''}${number.toFixed(1)}%`;
}
