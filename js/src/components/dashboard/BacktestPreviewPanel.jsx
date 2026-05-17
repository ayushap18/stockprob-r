import React from 'react';
import { BacktestEquityCurve, BacktestDrawdownChart } from '../charts/index.js';
import MetricCard from '../ui/MetricCard.jsx';

export default function BacktestPreviewPanel({ backtest = {}, isDemo }) {
  const metrics = backtest.metrics || {};
  return (
    <section className="chart-card">
      <div className="section-title-row"><div><span className="section-kicker">Validation Preview</span><h2>Backtest</h2></div><a className="source-badge" href="/backtest">Open</a></div>
      <div className="mini-metric-grid">
        <MetricCard label="CAGR" value={signedPct(metrics.cagr)} caption="annualized" tone={metrics.cagr >= 0 ? 'bull' : 'bear'} />
        <MetricCard label="Hit Rate" value={pct(metrics.hitRate || metrics.winRate)} caption="directional" tone={(metrics.hitRate || metrics.winRate) >= 0.55 ? 'bull' : 'warn'} />
        <MetricCard label="Max DD" value={signedPct(metrics.maxDrawdown)} caption="drawdown" tone="bear" />
      </div>
      <div className="investment-grid two">
        <BacktestEquityCurve data={backtest.equity || []} isDemo={isDemo} />
        <BacktestDrawdownChart data={backtest.drawdown || []} isDemo={isDemo} />
      </div>
    </section>
  );
}

function pct(value) { return Number.isFinite(Number(value)) ? `${Math.round(Number(value) * 100)}%` : 'n/a'; }
function signedPct(value) {
  if (!Number.isFinite(Number(value))) return 'n/a';
  const n = Number(value) * 100;
  return `${n >= 0 ? '+' : ''}${n.toFixed(1)}%`;
}
