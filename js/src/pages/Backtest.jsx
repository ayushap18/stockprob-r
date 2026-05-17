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

  return (
    <AppShell active="Backtest" rightSlot={<StatusBadge status={payload?.meta?.isDemo ? 'demo' : 'live'}>{payload?.meta?.source || 'backtest'}</StatusBadge>}>
      <section className="investment-command">
        <div>
          <span className="section-kicker">Backtest Controls</span>
          <div className="investment-search">
            <input className="investment-input" value={ticker} onChange={(event) => setTicker(event.target.value.toUpperCase())} aria-label="Ticker" />
            <button className="investment-button" type="button" onClick={() => fetchBacktestReport(ticker, { horizon }).then(setPayload)}>Run</button>
          </div>
        </div>
        <div className="investment-context">
          <select className="investment-select" value={horizon} onChange={(event) => setHorizon(Number(event.target.value))}>
            <option value={5}>5 trading days</option>
            <option value={10}>10 trading days</option>
            <option value={20}>20 trading days</option>
          </select>
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
