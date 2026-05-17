import React, { useEffect, useMemo, useState } from 'react';
import AppShell from '../components/ui/AppShell.jsx';
import ChartCard from '../components/ui/ChartCard.jsx';
import CompactTable from '../components/ui/CompactTable.jsx';
import MetricCard from '../components/ui/MetricCard.jsx';
import StatusBadge from '../components/ui/StatusBadge.jsx';
import { BacktestDrawdownChart, BacktestEquityCurve, CalibrationCurve, ConfidenceBucketChart } from '../components/charts/index.js';
import { fetchBacktestReport } from '../lib/backtestApi.js';

export default function BacktestPage() {
  const initial = new URLSearchParams(window.location.search).get('ticker') || 'MSFT';
  const [ticker, setTicker] = useState(initial.toUpperCase());
  const [horizon, setHorizon] = useState(5);
  const [threshold, setThreshold] = useState(0.55);
  const [rebalance, setRebalance] = useState('daily');
  const [strategy, setStrategy] = useState('probability_threshold');
  const [dateFrom, setDateFrom] = useState('2022-01-01');
  const [dateTo, setDateTo] = useState('2026-05-16');
  const [payload, setPayload] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetchBacktestReport(ticker, { horizon }).then((result) => {
      if (!cancelled) setPayload(result);
    }).finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [ticker, horizon]);

  const report = payload?.data;
  const metrics = report?.metrics || {};
  const rows = useMemo(() => report?.trades || [], [report?.trades]);
  const monthlyRows = useMemo(() => buildMonthlyHeatmap(report?.equity || []), [report?.equity]);

  return (
    <AppShell active="Backtest" rightSlot={<StatusBadge status={payload?.meta?.isDemo ? 'demo' : 'live'}>{payload?.meta?.source || 'backtest'}</StatusBadge>}>
      <section className="investment-command screen-command">
        <div>
          <span className="section-kicker">Backtest Controls</span>
          <div className="investment-search">
            <input className="investment-input" value={ticker} onChange={(event) => setTicker(event.target.value.toUpperCase())} aria-label="Ticker" />
            <button className="investment-button" type="button" onClick={() => fetchBacktestReport(ticker, { horizon }).then(setPayload)}>Run</button>
          </div>
        </div>
        <div className="investment-context">
          <label className="filter-field"><span>Horizon</span>
          <select className="investment-select" value={horizon} onChange={(event) => setHorizon(Number(event.target.value))}>
            <option value={5}>5 trading days</option>
            <option value={10}>10 trading days</option>
            <option value={20}>20 trading days</option>
          </select>
          </label>
          <label className="filter-field"><span>Date Range</span><input className="investment-input" type="date" value={dateFrom} onChange={(event) => setDateFrom(event.target.value)} /></label>
          <label className="filter-field"><span>To</span><input className="investment-input" type="date" value={dateTo} onChange={(event) => setDateTo(event.target.value)} /></label>
          <label className="filter-field"><span>Strategy</span><select className="investment-select" value={strategy} onChange={(event) => setStrategy(event.target.value)}><option value="probability_threshold">Probability Threshold</option><option value="top_decile">Top Decile</option><option value="long_short">Long / Short</option></select></label>
          <label className="filter-field"><span>Threshold</span><input className="investment-input" type="number" min="0" max="1" step="0.01" value={threshold} onChange={(event) => setThreshold(Number(event.target.value))} /></label>
          <label className="filter-field"><span>Rebalance</span><select className="investment-select" value={rebalance} onChange={(event) => setRebalance(event.target.value)}><option value="daily">Daily</option><option value="weekly">Weekly</option><option value="monthly">Monthly</option></select></label>
          <span className="source-badge">Walk-forward</span>
          <span className="source-badge">No lookahead</span>
          {loading && <span className="status-badge degraded">running</span>}
        </div>
        <a className="investment-button secondary" href={`/dashboard?ticker=${encodeURIComponent(ticker)}`}>Dashboard</a>
      </section>

      {payload?.meta?.warnings?.length ? <section className="warning-strip">{payload.meta.warnings.map((warning) => <span key={warning}>{warning}</span>)}</section> : null}

      <section className="investment-grid kpi-strip">
        <MetricCard label="Total" value={signedPct(metrics.totalReturn)} caption="strategy" tone={metrics.totalReturn >= 0 ? 'bull' : 'bear'} />
        <MetricCard label="SPY" value={signedPct(metrics.spyReturn)} caption="benchmark" tone={metrics.spyReturn >= 0 ? 'bull' : 'bear'} />
        <MetricCard label="Excess" value={signedPct(metrics.excessReturn)} caption="strategy minus SPY" tone={metrics.excessReturn >= 0 ? 'bull' : 'bear'} />
        <MetricCard label="CAGR" value={signedPct(metrics.cagr)} caption="annualized" tone={metrics.cagr >= 0 ? 'bull' : 'bear'} />
        <MetricCard label="Max DD" value={signedPct(metrics.maxDrawdown)} caption="peak to trough" tone="bear" />
        <MetricCard label="Hit Rate" value={pct(metrics.hitRate)} caption="directional" tone={metrics.hitRate >= 0.55 ? 'bull' : 'warn'} />
        <MetricCard label="Brier" value={Number(metrics.brierScore || 0).toFixed(3)} caption="lower is better" tone={metrics.brierScore < 0.2 ? 'bull' : 'warn'} />
        <MetricCard label="Sharpe" value={Number(metrics.sharpeRatio || 0).toFixed(2)} caption="risk adj" tone={(metrics.sharpeRatio || 0) > 1 ? 'bull' : 'warn'} />
        <MetricCard label="Profit Factor" value={Number(metrics.profitFactor || 0).toFixed(2)} caption="gross win/loss" tone={(metrics.profitFactor || 0) > 1.1 ? 'bull' : 'warn'} />
        <MetricCard label="Trades" value={String(metrics.tradeCount || 0)} caption={`PF ${Number(metrics.profitFactor || 0).toFixed(2)}`} tone="neutral" />
      </section>

      <section className="investment-grid two" style={{ marginTop: 10 }}>
        <ChartCard title="Equity Curve" caption="Strategy vs SPY">
          <BacktestEquityCurve data={report?.equity || []} isDemo={payload?.meta?.isDemo} />
        </ChartCard>
        <ChartCard title="Drawdown" caption="Validation risk">
          <BacktestDrawdownChart data={report?.drawdown || []} isDemo={payload?.meta?.isDemo} />
        </ChartCard>
      </section>

      <section className="investment-grid two" style={{ marginTop: 10 }}>
        <section className="table-card">
          <div className="section-title-row"><div><span className="section-kicker">Monthly Excess Return Heatmap</span><h2>{strategy.replace(/_/g, ' ')}</h2></div><span className="source-badge">{rebalance}</span></div>
          <CompactTable columns={[{ key: 'year', label: 'Year' }, ...['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'].map((month) => ({ key: month, label: month }))]} rows={monthlyRows} renderCell={renderMonth} />
        </section>
        <section className="table-card">
          <div className="section-title-row"><div><span className="section-kicker">Validation Notes</span><h2>Execution Assumptions</h2></div></div>
          <CompactTable columns={[{ key: 'metric', label: 'Input' }, { key: 'value', label: 'Value' }]} rows={[
            { metric: 'Threshold', value: pct(threshold) },
            { metric: 'Transaction Cost', value: '0.05%' },
            { metric: 'Slippage', value: '0.02%' },
            { metric: 'Date Range', value: `${dateFrom} → ${dateTo}` },
            { metric: 'Lookahead Guard', value: 'enabled' },
          ]} />
        </section>
      </section>

      <section className="investment-grid two" style={{ marginTop: 10 }}>
        <ChartCard title="Calibration" caption="Predicted vs realized">
          <CalibrationCurve data={report?.calibration || []} isDemo={payload?.meta?.isDemo} />
        </ChartCard>
        <ChartCard title="Confidence Buckets" caption="Hit rate and return">
          <ConfidenceBucketChart data={report?.confidenceBuckets || []} isDemo={payload?.meta?.isDemo} />
        </ChartCard>
      </section>

      <section className="table-card" style={{ marginTop: 10 }}>
        <div className="section-title-row"><div><span className="section-kicker">Signal Log</span><h2>Recent Out-of-Sample Rows</h2></div></div>
        <CompactTable
          columns={[
            { key: 'date', label: 'Date' },
            { key: 'prediction', label: 'Prediction' },
            { key: 'confidence', label: 'Conf' },
            { key: 'outcome', label: 'Outcome' },
            { key: 'return', label: 'Return' },
            { key: 'spyReturn', label: 'SPY' },
            { key: 'excessReturn', label: 'Excess' },
          ]}
          rows={rows}
          renderCell={renderTrade}
        />
      </section>
    </AppShell>
  );
}

function buildMonthlyHeatmap(equity = []) {
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const grouped = new Map();
  for (let index = 1; index < equity.length; index += 1) {
    const row = equity[index];
    const prev = equity[index - 1];
    const date = new Date(`${row.date}T00:00:00Z`);
    if (Number.isNaN(date.getTime())) continue;
    const year = String(date.getUTCFullYear());
    const month = months[date.getUTCMonth()];
    if (!grouped.has(year)) grouped.set(year, { year });
    const value = (Number(row.strategy || 1) / Number(prev.strategy || 1) - 1) - (Number(row.spy || 1) / Number(prev.spy || 1) - 1);
    grouped.get(year)[month] = Number(grouped.get(year)[month] || 0) + value;
  }
  return [...grouped.values()].slice(-4);
}

function renderMonth(row, column) {
  if (column.key === 'year') return <strong>{row.year}</strong>;
  const value = row[column.key];
  if (!Number.isFinite(Number(value))) return '·';
  return <span className={value >= 0 ? 'value-bull' : 'value-bear'}>{signedPct(value)}</span>;
}

function renderTrade(row, column) {
  if (column.key === 'confidence') return pct(row.confidence);
  if (['return', 'spyReturn', 'excessReturn'].includes(column.key)) return <span className={row[column.key] >= 0 ? 'value-bull' : 'value-bear'}>{signedPct(row[column.key])}</span>;
  if (column.key === 'outcome') return <StatusBadge status={row.outcome === 'hit' ? 'ok' : 'down'}>{row.outcome}</StatusBadge>;
  return row[column.key];
}

function pct(value) {
  return Number.isFinite(Number(value)) ? `${Math.round(Number(value) * 100)}%` : 'n/a';
}

function signedPct(value) {
  if (!Number.isFinite(Number(value))) return 'n/a';
  const n = Number(value) * 100;
  return `${n >= 0 ? '+' : ''}${n.toFixed(1)}%`;
}
