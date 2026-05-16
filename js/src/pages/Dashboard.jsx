import React, { useMemo, useState } from 'react';
import DashboardShell from '../components/dashboard/DashboardShell.jsx';
import TickerSearch from '../components/dashboard/TickerSearch.jsx';
import {
  BacktestDrawdownChart,
  BacktestEquityCurve,
  FeatureImportanceChart,
  MacroRegimeChart,
  MonteCarloFanChart,
  MonteCarloHistogram,
  MonteCarloRiskCards,
  NewsSentimentChart,
  PriceCandlestickChart,
  ProbabilityTrendChart,
  ProviderHealthChart,
  RankingScatterChart,
  RiskConfidenceChart,
  SectorHeatmap,
  SpyComparisonChart,
  SystemCoverageChart,
} from '../components/charts/index.js';
import { useDashboardLiveData } from '../hooks/useDashboardLiveData.js';

export default function DashboardPage() {
  const initialTicker = new URLSearchParams(window.location.search).get('ticker') || 'MSFT';
  const [input, setInput] = useState(initialTicker.toUpperCase());
  const [symbol, setSymbol] = useState(initialTicker.toUpperCase());
  const live = useDashboardLiveData([symbol, 'SPY', 'QQQ'], { horizonDays: 5 });
  const snapshot = live.snapshot;
  const meta = useMemo(() => ({ source: live.source, isDemo: live.isDemo, warnings: live.warnings, asOf: live.lastUpdated }), [live.source, live.isDemo, live.warnings, live.lastUpdated]);

  function submit(event) {
    event.preventDefault();
    const next = input.trim().toUpperCase();
    if (/^[A-Z0-9.-]{1,12}$/.test(next)) setSymbol(next);
  }

  if (!snapshot) return <main className="terminal-shell"><section className="state-panel loading-state"><strong>Loading connected dashboard</strong></section></main>;

  return (
    <main className="terminal-shell analytics-shell">
      <section className="analytics-layout">
        <TickerSearch value={input} onChange={setInput} onSubmit={submit} />
        <DashboardShell snapshot={snapshot} meta={meta}>
          <section className="analytics-grid halves">
            <PriceCandlestickChart data={snapshot.candles} isDemo={live.isDemo} warnings={live.warnings} />
            <SpyComparisonChart data={snapshot.benchmark} isDemo={live.isDemo} />
          </section>
          <section className="analytics-grid thirds">
            <ProbabilityTrendChart data={snapshot.probabilityHistory} isDemo={live.isDemo} />
            <RiskConfidenceChart data={snapshot.probabilityHistory} isDemo={live.isDemo} />
            <FeatureImportanceChart data={snapshot.features} isDemo={live.isDemo} />
          </section>
          <section className="analytics-grid two-one">
            <MonteCarloFanChart simulation={snapshot.monteCarlo} isDemo={live.isDemo} />
            <MonteCarloRiskCards simulation={snapshot.monteCarlo} probabilityOutperformSpy={snapshot.probabilities.probabilityOutperformSpy} isDemo={live.isDemo} />
          </section>
          <section className="analytics-grid halves">
            <MonteCarloHistogram simulation={snapshot.monteCarlo} isDemo={live.isDemo} />
            <NewsSentimentChart prediction={snapshot.probabilities} trend={snapshot.sentiment} isDemo={live.isDemo} />
          </section>
          <section className="analytics-grid halves">
            <MacroRegimeChart data={snapshot.macro} isDemo={live.isDemo} />
            <ProviderHealthChart data={snapshot.providerHealth} isDemo={live.isDemo} />
          </section>
          <section className="analytics-grid single">
            <SystemCoverageChart isDemo={live.isDemo} warnings={live.warnings} />
          </section>
          <section className="analytics-grid halves">
            <SectorHeatmap data={snapshot.rankings} isDemo={live.isDemo} />
            <RankingScatterChart data={snapshot.rankings} isDemo={live.isDemo} />
          </section>
          <section className="analytics-grid halves">
            <BacktestEquityCurve data={snapshot.backtest.equity} isDemo={live.isDemo} />
            <BacktestDrawdownChart data={snapshot.backtest.drawdown} isDemo={live.isDemo} />
          </section>
        </DashboardShell>
      </section>
    </main>
  );
}
