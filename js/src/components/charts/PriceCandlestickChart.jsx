import React, { useEffect, useMemo, useRef } from 'react';
import { CandlestickSeries, createChart, HistogramSeries, LineSeries } from 'lightweight-charts';
import { ChartShell, EmptyChart, chartTheme, useMeasuredFrame } from './ChartPrimitives.jsx';
import { betaToBenchmark, indicatorRows, relativeStrength } from '../../lib/math/technicals.js';

export default function PriceCandlestickChart({ data = [], benchmarkData = [], indicators = {}, isDemo, warnings }) {
  const [frameRef, size] = useMeasuredFrame();
  const chartRef = useRef(null);
  const candleData = useMemo(() => indicatorRows(data.filter((row) => row.time && Number.isFinite(row.close))), [data]);
  const indicatorStats = useMemo(() => {
    const latest = candleData.at(-1) || {};
    return {
      rsi: latest.rsi,
      macd: latest.macd,
      atr: latest.atr,
      volatility: latest.volatility,
      beta: betaToBenchmark(candleData, benchmarkData.map((row) => ({ close: Number(row.spyClose || row.benchmarkClose || row.spy || row.stockReturn || row.close || 0) })), 120),
      relativeStrength: relativeStrength(candleData, benchmarkData.map((row) => ({ close: Number(row.spyClose || row.benchmarkClose || row.spy || row.stockReturn || row.close || 0) })), 60),
    };
  }, [benchmarkData, candleData]);

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

    const addLine = (key, color, width = 1.4) => {
      const seriesData = candleData.filter((row) => Number.isFinite(row[key])).map((row) => ({ time: row.time, value: row[key] }));
      if (!seriesData.length) return;
      const line = chart.addSeries(LineSeries, { color, lineWidth: width, priceLineVisible: false, lastValueVisible: false });
      line.setData(seriesData);
    };
    if (indicators.sma20) addLine('sma20', '#22d3ee');
    if (indicators.sma50) addLine('sma50', '#60a5fa');
    if (indicators.sma200) addLine('sma200', '#f59e0b', 1.2);
    if (indicators.ema20) addLine('ema20', '#16c784');
    if (indicators.ema50) addLine('ema50', '#a78bfa');
    if (indicators.bollinger) {
      addLine('bbUpper', 'rgba(148,163,184,0.85)', 1);
      addLine('bbLower', 'rgba(148,163,184,0.85)', 1);
      addLine('bbMiddle', 'rgba(148,163,184,0.45)', 1);
    }

    if (indicators.volume !== false && candleData.some((row) => Number.isFinite(row.volume))) {
      const volume = chart.addSeries(HistogramSeries, { priceFormat: { type: 'volume' }, priceScaleId: '', color: 'rgba(34,211,238,0.26)' });
      volume.priceScale().applyOptions({ scaleMargins: { top: 0.82, bottom: 0 } });
      volume.setData(candleData.map((row) => ({ time: row.time, value: row.volume || 0, color: row.close >= row.open ? 'rgba(34,197,94,0.28)' : 'rgba(239,68,68,0.28)' })));
    }
    chart.timeScale().fitContent();
    chartRef.current = chart;
    return () => chart.remove();
  }, [candleData, frameRef, indicators, size.height, size.width]);

  useEffect(() => {
    chartRef.current?.applyOptions({ width: size.width, height: size.height });
  }, [size.width, size.height]);

  return (
    <ChartShell title="OHLC Price Action" subtitle="TradingView Lightweight Charts candlestick layer" isDemo={isDemo} warnings={warnings}>
      {candleData.length ? (
        <>
          <div ref={frameRef} className="lw-chart-frame" />
          <IndicatorStats indicators={indicators} stats={indicatorStats} />
        </>
      ) : <EmptyChart label="No OHLC data returned" />}
    </ChartShell>
  );
}

function IndicatorStats({ indicators, stats }) {
  const rows = [
    indicators.rsi && ['RSI', stats.rsi?.toFixed(1)],
    indicators.macd && ['MACD', stats.macd?.toFixed(2)],
    indicators.atr && ['ATR', stats.atr?.toFixed(2)],
    indicators.volatility && ['Vol', stats.volatility ? `${(stats.volatility * 100).toFixed(1)}%` : null],
    indicators.beta && ['Beta', stats.beta?.toFixed(2)],
    indicators.relativeStrength && ['RS', stats.relativeStrength ? `${(stats.relativeStrength * 100).toFixed(1)}%` : null],
  ].filter(Boolean);
  if (!rows.length) return null;
  return <div className="indicator-stat-strip">{rows.map(([label, value]) => <span key={label}><b>{label}</b>{value || 'n/a'}</span>)}</div>;
}
