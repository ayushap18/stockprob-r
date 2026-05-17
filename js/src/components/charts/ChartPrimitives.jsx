import React, { useLayoutEffect, useMemo, useRef, useState } from 'react';
import ReactECharts from 'echarts-for-react';
import createPlotlyComponentModule from 'react-plotly.js/factory.js';
import Plotly from 'plotly.js-dist-min';
import { ResponsiveContainer } from 'recharts';

const createPlotlyComponent = createPlotlyComponentModule.default?.default || createPlotlyComponentModule.default || createPlotlyComponentModule;
const Plot = createPlotlyComponent(Plotly);

export function ChartShell({ title, subtitle, isDemo, warnings = [], children, className = '' }) {
  return (
    <article className={`analytics-card ${className}`}>
      {(title || subtitle || isDemo) && (
        <header>
          <div>
            {title && <h2>{title}</h2>}
            {subtitle && <p>{subtitle}</p>}
          </div>
          {isDemo && <span className="demo-pill">demo fallback</span>}
        </header>
      )}
      {warnings.slice(0, 1).map((warning) => <div className="chart-warning" key={warning}>{warning}</div>)}
      {children}
    </article>
  );
}

export function EmptyChart({ label = 'No chart data available' }) {
  return <div className="empty-chart">{label}</div>;
}

export function RechartsFrame({ children, height = 280 }) {
  return <div className="analytics-chart-frame" style={{ height }}><ResponsiveContainer width="100%" height="100%">{children}</ResponsiveContainer></div>;
}

export function EChart({ option, height = 300 }) {
  const stableOption = useMemo(() => option, [option]);
  return <ReactECharts option={stableOption} style={{ height, width: '100%' }} notMerge lazyUpdate opts={{ renderer: 'canvas' }} />;
}

export function PlotlyChart({ data, layout, config, height = 330 }) {
  return (
    <Plot
      data={data}
      layout={{ ...plotlyBaseLayout(height), ...layout }}
      config={{ displayModeBar: false, responsive: true, ...config }}
      useResizeHandler
      style={{ width: '100%', height }}
    />
  );
}

export function useMeasuredFrame() {
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
  return [ref, size];
}

export function chartTheme() {
  return {
    bg: '#04070a',
    panel: '#071017',
    border: '#1f2b37',
    text: '#f4f7fb',
    muted: '#9aa4b2',
    cyan: '#22d3ee',
    green: '#22c55e',
    red: '#ef4444',
    amber: '#f59e0b',
    purple: '#8b5cf6',
    grid: 'rgba(154, 164, 178, 0.11)',
  };
}

export function axisLabel(color = chartTheme().muted) {
  return { color, fontSize: 11, fontFamily: 'Inter, ui-sans-serif, system-ui' };
}

export function echartGrid() {
  return { left: 42, right: 18, top: 28, bottom: 34 };
}

export function fmtPct(value, digits = 1) {
  if (!Number.isFinite(Number(value))) return 'n/a';
  return `${(Number(value) * 100).toFixed(digits)}%`;
}

export function signedPct(value, digits = 1) {
  if (!Number.isFinite(Number(value))) return 'n/a';
  const number = Number(value) * 100;
  return `${number >= 0 ? '+' : ''}${number.toFixed(digits)}%`;
}

export function fmtMoney(value) {
  if (!Number.isFinite(Number(value))) return 'n/a';
  return `$${Number(value).toFixed(2)}`;
}

function plotlyBaseLayout(height) {
  const t = chartTheme();
  return {
    height,
    paper_bgcolor: 'rgba(0,0,0,0)',
    plot_bgcolor: 'rgba(0,0,0,0)',
    margin: { l: 48, r: 24, t: 20, b: 42 },
    font: { color: t.text, size: 11 },
    xaxis: { gridcolor: t.grid, zerolinecolor: t.border, tickfont: { color: t.muted } },
    yaxis: { gridcolor: t.grid, zerolinecolor: t.border, tickfont: { color: t.muted } },
    legend: { orientation: 'h', y: 1.1, font: { color: t.muted } },
  };
}
