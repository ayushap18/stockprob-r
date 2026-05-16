import React, { useMemo } from 'react';
import { ChartShell, EChart, EmptyChart, axisLabel, chartTheme, echartGrid } from './ChartPrimitives.jsx';

export default function NewsSentimentChart({ prediction, trend = [], isDemo, warnings }) {
  const news = prediction?.recentNews || [];
  const data = news.length ? news.map((item, index) => ({ date: item.published_at?.slice(0, 10) || trend[index]?.date || String(index + 1), score: Number(item.score ?? item.sentiment_score ?? 0), title: item.title })) : trend.map((row) => ({ date: row.date, score: (row.probability - 0.5) * 2, title: 'fallback sentiment proxy' }));
  const option = useMemo(() => {
    const t = chartTheme();
    return {
      grid: echartGrid(),
      xAxis: { type: 'category', data: data.map((row) => row.date), axisLabel: axisLabel(), axisLine: { lineStyle: { color: t.border } } },
      yAxis: { type: 'value', min: -1, max: 1, axisLabel: axisLabel(), splitLine: { lineStyle: { color: t.grid } } },
      tooltip: { trigger: 'axis', backgroundColor: t.bg, borderColor: t.border, textStyle: { color: t.text } },
      series: [{ type: 'line', smooth: true, data: data.map((row) => row.score), symbolSize: 7, lineStyle: { color: t.cyan }, itemStyle: { color: t.cyan }, markLine: { data: [{ yAxis: 0 }], lineStyle: { color: t.amber, type: 'dashed' } } }],
    };
  }, [data]);
  return <ChartShell title="News Sentiment" subtitle="Timeline with catalyst-sensitive sentiment scores" isDemo={isDemo} warnings={warnings}>{data.length ? <EChart option={option} height={280} /> : <EmptyChart />}</ChartShell>;
}
