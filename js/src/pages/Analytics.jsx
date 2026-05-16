import React, { useEffect, useMemo, useState } from 'react';
import { generateDemoProbabilityTrend } from '../lib/demoChartData.js';
import { loadAnalyticsBundle } from '../lib/chartApi.js';
import {
  BacktestDrawdownChart,
  BacktestEquityCurve,
  CalibrationCurve,
  ConfidenceBucketChart,
  ExpectedReturnChart,
  FeatureImportanceChart,
  FundamentalBreakdownChart,
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
  TechnicalBreakdownChart,
} from '../components/charts/index.js';
import MemoryStatusPanel from '../components/dashboard/MemoryStatusPanel.jsx';
import LiveProviderHealthPanel from '../components/live/LiveProviderHealthPanel.jsx';
import LiveQuoteTicker from '../components/live/LiveQuoteTicker.jsx';
import LiveStatusBadge from '../components/live/LiveStatusBadge.jsx';
import LiveSystemPanel from '../components/live/LiveSystemPanel.jsx';
import { useLiveProbabilities } from '../hooks/useLiveProbabilities.js';

export default function Analytics() {
  const initialTicker = new URLSearchParams(window.location.search).get('ticker') || 'MSFT';
  const [ticker, setTicker] = useState(initialTicker.toUpperCase());
  const [input, setInput] = useState(initialTicker.toUpperCase());
  const [bundle, setBundle] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError('');
    loadAnalyticsBundle(ticker)
      .then((payload) => {
        if (!cancelled) setBundle(payload);
      })
      .catch((requestError) => {
        if (!cancelled) setError(requestError.message || 'Analytics unavailable');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [ticker]);

  const prediction = bundle?.prediction?.data;
  const liveProbabilities = useLiveProbabilities([ticker], 5);
  const liveProbability = liveProbabilities.data?.[ticker]?.probabilityOutperformSpy ?? prediction?.probability;
  const trend = useMemo(() => generateDemoProbabilityTrend(ticker), [ticker]);
  const demoSources = bundle ? Object.values(bundle).filter((section) => section?.isDemo).map((section) => section.source) : [];

  function submit(event) {
    event.preventDefault();
    const nextTicker = input.trim().toUpperCase();
    if (!/^[A-Z][A-Z0-9.-]{0,14}$/.test(nextTicker)) {
      setError('INVALID_TICKER: enter a valid US listed symbol');
      return;
    }
    window.history.replaceState(null, '', `/analytics?ticker=${encodeURIComponent(nextTicker)}`);
    setTicker(nextTicker);
  }

  return (
    <main className="terminal-shell analytics-shell">
      <AnalyticsNav />
      <section className="analytics-layout">
        <header className="analytics-header">
          <div>
            <span className="micro-label">Advanced Analytics</span>
            <h1>{ticker} Quant Charting Layer</h1>
            <p>Probabilistic outperformance research: price, model, Monte Carlo, features, ranking, backtest, provider and macro views.</p>
          </div>
          <form onSubmit={submit} className="analytics-search">
            <input value={input} onChange={(event) => setInput(event.target.value.toUpperCase())} aria-label="Analytics ticker" />
            <button type="submit">Load</button>
          </form>
        </header>

        {loading && <section className="state-panel loading-state"><strong>Loading analytics</strong><div><span>Fetching prediction</span><span>Loading OHLC</span><span>Building simulations</span><span>Normalizing charts</span></div></section>}
        {error && <section className="state-panel error-state"><strong>Analytics error</strong><span>{error}</span></section>}
        {!!demoSources.length && <section className="analytics-demo-banner">Some sections are using deterministic demo/fallback data: {demoSources.join(', ')}. The UI remains stable when providers fail.</section>}

        <section className="analytics-kpis">
          <Kpi label="P(outperform SPY)" value={pct(liveProbability)} detail={<LiveStatusBadge status={liveProbabilities.status} source={liveProbabilities.source} isDemo={liveProbabilities.isDemo} lastUpdated={liveProbabilities.lastUpdated} />} />
          <Kpi label="Expected Return" value={signedPct(prediction?.expectedReturn)} />
          <Kpi label="Excess vs SPY" value={signedPct(prediction?.expectedExcessReturn)} />
          <Kpi label="Confidence" value={pct(prediction?.confidence)} />
          <Kpi label="Risk" value={`${pct(prediction?.riskScore)} · ${prediction?.riskLabel || 'n/a'}`} />
          <Kpi label="Signal" value={prediction?.signal || 'neutral'} />
        </section>
        <section className="analytics-grid thirds">
          <LiveQuoteTicker symbols={[ticker, 'SPY', 'QQQ']} />
          <LiveSystemPanel />
          <LiveProviderHealthPanel />
        </section>

        {bundle && (
          <>
            <AnalyticsSection title="Price Analysis">
              <div className="analytics-grid two-one">
                <PriceCandlestickChart data={bundle.price.data} isDemo={bundle.price.isDemo} warnings={bundle.price.warnings} />
                <SpyComparisonChart data={bundle.comparison.data} isDemo={bundle.comparison.isDemo} warnings={bundle.comparison.warnings} />
              </div>
            </AnalyticsSection>

            <AnalyticsSection title="Prediction Analysis">
              <div className="analytics-grid thirds">
                <ProbabilityTrendChart data={trend} isDemo />
                <ExpectedReturnChart data={trend} isDemo />
                <RiskConfidenceChart data={trend} isDemo />
              </div>
            </AnalyticsSection>

            <AnalyticsSection title="Monte Carlo Simulation">
              <div className="analytics-grid two-one">
                <MonteCarloFanChart simulation={bundle.monteCarlo.data} isDemo={bundle.monteCarlo.isDemo} warnings={bundle.monteCarlo.warnings} />
                <MonteCarloRiskCards simulation={bundle.monteCarlo.data} probabilityOutperformSpy={prediction?.probability} isDemo={bundle.monteCarlo.isDemo} />
              </div>
              <div className="analytics-grid single">
                <MonteCarloHistogram simulation={bundle.monteCarlo.data} isDemo={bundle.monteCarlo.isDemo} />
              </div>
            </AnalyticsSection>

            <AnalyticsSection title="Feature Analysis">
              <div className="analytics-grid thirds">
                <FeatureImportanceChart data={bundle.features.data} isDemo={bundle.features.isDemo} warnings={bundle.features.warnings} />
                <TechnicalBreakdownChart prediction={prediction} isDemo={bundle.prediction.isDemo} />
                <FundamentalBreakdownChart prediction={prediction} isDemo={bundle.prediction.isDemo} />
              </div>
              <div className="analytics-grid halves">
                <NewsSentimentChart prediction={prediction} trend={trend} isDemo={bundle.prediction.isDemo} />
                <MacroRegimeChart data={bundle.macro.data} isDemo={bundle.macro.isDemo} warnings={bundle.macro.warnings} />
              </div>
            </AnalyticsSection>

            <AnalyticsSection title="Market Ranking">
              <div className="analytics-grid halves">
                <SectorHeatmap data={bundle.rankings.data} isDemo={bundle.rankings.isDemo} warnings={bundle.rankings.warnings} />
                <RankingScatterChart data={bundle.rankings.data} isDemo={bundle.rankings.isDemo} />
              </div>
            </AnalyticsSection>

            <AnalyticsSection title="Backtest">
              <div className="analytics-grid halves">
                <BacktestEquityCurve data={bundle.backtest.data.equity} isDemo={bundle.backtest.isDemo} warnings={bundle.backtest.warnings} />
                <BacktestDrawdownChart data={bundle.backtest.data.drawdown} isDemo={bundle.backtest.isDemo} />
              </div>
              <div className="analytics-grid halves">
                <CalibrationCurve data={bundle.backtest.data.calibration} isDemo={bundle.backtest.isDemo} />
                <ConfidenceBucketChart data={bundle.backtest.data.confidenceBuckets} isDemo={bundle.backtest.isDemo} />
              </div>
            </AnalyticsSection>

            <AnalyticsSection title="Provider Health">
              <div className="analytics-grid halves">
                <ProviderHealthChart data={bundle.providerHealth.data} isDemo={bundle.providerHealth.isDemo} warnings={bundle.providerHealth.warnings} />
                <SystemCoverageChart isDemo={bundle.providerHealth.isDemo} warnings={bundle.providerHealth.warnings} />
              </div>
              <div className="analytics-grid single">
                <MemoryStatusPanel />
              </div>
            </AnalyticsSection>
          </>
        )}
      </section>
    </main>
  );
}

function AnalyticsNav() {
  return (
    <header className="top-nav">
      <a className="brand" href="/stockprob">
        <span className="brand-mark">∑</span>
        <div><strong>StockProb-R</strong><small>Advanced analytics</small></div>
      </a>
      <nav>
        <a href="/stockprob">Dashboard</a>
        <a href={`/dashboard?ticker=${encodeURIComponent(new URLSearchParams(window.location.search).get('ticker') || 'MSFT')}`}>Connected</a>
        <a className="active" href="/analytics">Advanced Analytics</a>
        <a href="https://github.com/ayushap18/stockprob-r" target="_blank" rel="noreferrer">GitHub</a>
      </nav>
      <div className="nav-actions"><span className="market-pill online">API <b>online</b></span></div>
    </header>
  );
}

function AnalyticsSection({ title, children }) {
  return <section className="analytics-section"><h2>{title}</h2>{children}</section>;
}

function Kpi({ label, value, detail = null }) {
  return <article><span>{label}</span><strong>{value}</strong>{detail}</article>;
}

function pct(value) {
  return Number.isFinite(Number(value)) ? `${Math.round(Number(value) * 100)}%` : 'n/a';
}

function signedPct(value) {
  if (!Number.isFinite(Number(value))) return 'n/a';
  const number = Number(value) * 100;
  return `${number >= 0 ? '+' : ''}${number.toFixed(1)}%`;
}
