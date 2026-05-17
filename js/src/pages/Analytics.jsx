import React, { useEffect, useMemo, useState } from 'react';
import { generateDemoProbabilityTrend } from '../lib/demoChartData.js';
import { loadAnalyticsBundle } from '../lib/chartApi.js';
import {
  BacktestDrawdownChart,
  BacktestEquityCurve,
  CalibrationCurve,
  ChartZoomModal,
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
  RangeSelector,
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
import { useChartZoom } from '../hooks/useChartZoom.js';
import { filterByRange } from '../lib/chartRanges.js';

export default function Analytics() {
  const initialTicker = new URLSearchParams(window.location.search).get('ticker') || 'MSFT';
  const [ticker, setTicker] = useState(initialTicker.toUpperCase());
  const [input, setInput] = useState(initialTicker.toUpperCase());
  const [bundle, setBundle] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [chartRange, setChartRange] = useState('1Y');
  const zoom = useChartZoom();

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
  const rangedTrend = useMemo(() => filterByRange(trend, chartRange, 'date'), [chartRange, trend]);
  const rangedPrice = useMemo(() => filterByRange(bundle?.price?.data || [], chartRange, 'date'), [bundle?.price?.data, chartRange]);
  const rangedComparison = useMemo(() => filterByRange(bundle?.comparison?.data || [], chartRange, 'date'), [bundle?.comparison?.data, chartRange]);
  const rangedEquity = useMemo(() => filterByRange(bundle?.backtest?.data?.equity || [], chartRange, 'date'), [bundle?.backtest?.data?.equity, chartRange]);
  const rangedDrawdown = useMemo(() => filterByRange(bundle?.backtest?.data?.drawdown || [], chartRange, 'date'), [bundle?.backtest?.data?.drawdown, chartRange]);
  const rangeControls = <RangeSelector value={chartRange} onChange={setChartRange} />;
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
                <ZoomableAnalyticsChart title="Candlestick Price" controls={rangeControls} zoom={zoom}><PriceCandlestickChart data={rangedPrice} isDemo={bundle.price.isDemo} warnings={bundle.price.warnings} /></ZoomableAnalyticsChart>
                <ZoomableAnalyticsChart title="Benchmark Comparison" controls={rangeControls} zoom={zoom}><SpyComparisonChart data={rangedComparison} isDemo={bundle.comparison.isDemo} warnings={bundle.comparison.warnings} /></ZoomableAnalyticsChart>
              </div>
            </AnalyticsSection>

            <AnalyticsSection title="Prediction Analysis">
              <div className="analytics-grid thirds">
                <ZoomableAnalyticsChart title="Probability Trend" controls={rangeControls} zoom={zoom}><ProbabilityTrendChart data={rangedTrend} isDemo /></ZoomableAnalyticsChart>
                <ZoomableAnalyticsChart title="Expected Return" controls={rangeControls} zoom={zoom}><ExpectedReturnChart data={rangedTrend} isDemo /></ZoomableAnalyticsChart>
                <ZoomableAnalyticsChart title="Risk / Confidence" controls={rangeControls} zoom={zoom}><RiskConfidenceChart data={rangedTrend} isDemo /></ZoomableAnalyticsChart>
              </div>
            </AnalyticsSection>

            <AnalyticsSection title="Monte Carlo Simulation">
              <div className="analytics-grid two-one">
                <ZoomableAnalyticsChart title="Monte Carlo Fan" zoom={zoom}><MonteCarloFanChart simulation={bundle.monteCarlo.data} isDemo={bundle.monteCarlo.isDemo} warnings={bundle.monteCarlo.warnings} /></ZoomableAnalyticsChart>
                <MonteCarloRiskCards simulation={bundle.monteCarlo.data} probabilityOutperformSpy={prediction?.probability} isDemo={bundle.monteCarlo.isDemo} />
              </div>
              <div className="analytics-grid single">
                <ZoomableAnalyticsChart title="Monte Carlo Histogram" zoom={zoom}><MonteCarloHistogram simulation={bundle.monteCarlo.data} isDemo={bundle.monteCarlo.isDemo} /></ZoomableAnalyticsChart>
              </div>
            </AnalyticsSection>

            <AnalyticsSection title="Feature Analysis">
              <div className="analytics-grid thirds">
                <ZoomableAnalyticsChart title="Feature Importance" zoom={zoom}><FeatureImportanceChart data={bundle.features.data} isDemo={bundle.features.isDemo} warnings={bundle.features.warnings} /></ZoomableAnalyticsChart>
                <ZoomableAnalyticsChart title="Technical Breakdown" zoom={zoom}><TechnicalBreakdownChart prediction={prediction} isDemo={bundle.prediction.isDemo} /></ZoomableAnalyticsChart>
                <ZoomableAnalyticsChart title="Fundamental Breakdown" zoom={zoom}><FundamentalBreakdownChart prediction={prediction} isDemo={bundle.prediction.isDemo} /></ZoomableAnalyticsChart>
              </div>
              <div className="analytics-grid halves">
                <ZoomableAnalyticsChart title="News Sentiment" controls={rangeControls} zoom={zoom}><NewsSentimentChart prediction={prediction} trend={rangedTrend} isDemo={bundle.prediction.isDemo} /></ZoomableAnalyticsChart>
                <ZoomableAnalyticsChart title="Macro Regime" zoom={zoom}><MacroRegimeChart data={bundle.macro.data} isDemo={bundle.macro.isDemo} warnings={bundle.macro.warnings} /></ZoomableAnalyticsChart>
              </div>
            </AnalyticsSection>

            <AnalyticsSection title="Market Ranking">
              <div className="analytics-grid halves">
                <ZoomableAnalyticsChart title="Sector Heatmap" zoom={zoom}><SectorHeatmap data={bundle.rankings.data} isDemo={bundle.rankings.isDemo} warnings={bundle.rankings.warnings} /></ZoomableAnalyticsChart>
                <ZoomableAnalyticsChart title="Ranking Scatter" zoom={zoom}><RankingScatterChart data={bundle.rankings.data} isDemo={bundle.rankings.isDemo} /></ZoomableAnalyticsChart>
              </div>
            </AnalyticsSection>

            <AnalyticsSection title="Backtest">
              <div className="analytics-grid halves">
                <ZoomableAnalyticsChart title="Backtest Equity Curve" controls={rangeControls} zoom={zoom}><BacktestEquityCurve data={rangedEquity} isDemo={bundle.backtest.isDemo} warnings={bundle.backtest.warnings} /></ZoomableAnalyticsChart>
                <ZoomableAnalyticsChart title="Drawdown Chart" controls={rangeControls} zoom={zoom}><BacktestDrawdownChart data={rangedDrawdown} isDemo={bundle.backtest.isDemo} /></ZoomableAnalyticsChart>
              </div>
              <div className="analytics-grid halves">
                <ZoomableAnalyticsChart title="Calibration Curve" zoom={zoom}><CalibrationCurve data={bundle.backtest.data.calibration} isDemo={bundle.backtest.isDemo} /></ZoomableAnalyticsChart>
                <ZoomableAnalyticsChart title="Confidence Buckets" zoom={zoom}><ConfidenceBucketChart data={bundle.backtest.data.confidenceBuckets} isDemo={bundle.backtest.isDemo} /></ZoomableAnalyticsChart>
              </div>
            </AnalyticsSection>

            <AnalyticsSection title="Provider Health">
              <div className="analytics-grid halves">
                <ZoomableAnalyticsChart title="Provider Health" zoom={zoom}><ProviderHealthChart data={bundle.providerHealth.data} isDemo={bundle.providerHealth.isDemo} warnings={bundle.providerHealth.warnings} /></ZoomableAnalyticsChart>
                <ZoomableAnalyticsChart title="System Coverage" zoom={zoom}><SystemCoverageChart isDemo={bundle.providerHealth.isDemo} warnings={bundle.providerHealth.warnings} /></ZoomableAnalyticsChart>
              </div>
              <div className="analytics-grid single">
                <MemoryStatusPanel />
              </div>
            </AnalyticsSection>
          </>
        )}
      </section>
      <ChartZoomModal chart={zoom.zoomedChart} onClose={zoom.closeChart} />
    </main>
  );
}

function ZoomableAnalyticsChart({ title, controls = null, zoom, children }) {
  return (
    <div className="analytics-zoom-wrap">
      <button type="button" className="chart-expand-button analytics-expand-button" onClick={() => zoom.openChart({ title, controls, content: children })} aria-label={`Expand ${title}`}>⛶</button>
      {controls && <div className="chart-card-controls">{controls}</div>}
      {children}
    </div>
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
