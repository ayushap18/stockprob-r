import React, { useEffect, useMemo, useRef } from 'react';
import { CandlestickSeries, createChart, HistogramSeries } from 'lightweight-charts';
import { ChartShell, EmptyChart, chartTheme, useMeasuredFrame } from './ChartPrimitives.jsx';

export default function PriceCandlestickChart({ data = [], isDemo, warnings }) {
  const [frameRef, size] = useMeasuredFrame();
  const chartRef = useRef(null);
  const candleData = useMemo(() => data.filter((row) => row.time && Number.isFinite(row.close)), [data]);

  useEffect(() => {
    if (!frameRef.current || !size.width || !candleData.length) return undefined;
    const t = chartTheme();
    const chart = createChart(frameRef.current, {
      width: size.width,
      height: size.height,
      layout: { background: { color: 'transparent' }, textColor: t.muted },
      grid: { vertLines: { color: 'rgba(148,163,184,0.08)' }, horzLines: { color: 'rgba(148,163,184,0.12)' } },
      rightPriceScale: { borderColor: t.border },
      timeScale: { borderColor: t.border, timeVisible: false },
      crosshair: { mode: 1 },
    });
    const candles = chart.addSeries(CandlestickSeries, {
      upColor: t.green,
      downColor: t.red,
      borderVisible: false,
      wickUpColor: t.green,
      wickDownColor: t.red,
    });
    candles.setData(candleData.map(({ time, open, high, low, close }) => ({ time, open, high, low, close })));
    if (candleData.some((row) => Number.isFinite(row.volume))) {
      const volume = chart.addSeries(HistogramSeries, { priceFormat: { type: 'volume' }, priceScaleId: '', color: 'rgba(34,211,238,0.26)' });
      volume.priceScale().applyOptions({ scaleMargins: { top: 0.82, bottom: 0 } });
      volume.setData(candleData.map((row) => ({ time: row.time, value: row.volume || 0, color: row.close >= row.open ? 'rgba(34,197,94,0.28)' : 'rgba(239,68,68,0.28)' })));
    }
    chart.timeScale().fitContent();
    chartRef.current = chart;
    return () => chart.remove();
  }, [candleData, frameRef, size.height, size.width]);

  useEffect(() => {
    chartRef.current?.applyOptions({ width: size.width, height: size.height });
  }, [size.width, size.height]);

  return (
    <ChartShell title="OHLC Price Action" subtitle="TradingView Lightweight Charts candlestick layer" isDemo={isDemo} warnings={warnings}>
      {candleData.length ? <div ref={frameRef} className="lw-chart-frame" /> : <EmptyChart label="No OHLC data returned" />}
    </ChartShell>
  );
}
