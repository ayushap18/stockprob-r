import React, { Component, Suspense, lazy, useEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import './styles.css';

const quickTickers = ['AAPL', 'MSFT', 'NVDA', 'TSLA', 'AMZN', 'GOOGL', 'META', 'JPM'];
const TICKER_SEARCH_LIMIT = 75;
const realtimeUrl = import.meta.env.VITE_REALTIME_URL || '';
const views = ['Dashboard', 'Rankings', 'Backtests', 'Data Health'];
const ChartRenderer = lazy(() => import('./charts.jsx'));
const CLIENT_CACHE_LIMIT = 120;
const CLIENT_CACHE = new Map();
const CLIENT_IN_FLIGHT = new Map();

const sampleAnalysis = {
  ticker: 'MSFT',
  company: 'Microsoft Corporation',
  current_price: 432.18,
  price_change: 0.31,
  as_of_date: '2026-05-16',
  horizon: '5d',
  probability_outperform_spy: 0.63,
  expected_return: 0.001,
  expected_excess_return: -0.01,
  risk_score: 0.28,
  risk_label: 'low',
  confidence: 0.46,
  technical_score: 0.6,
  fundamental_score: 0.51,
  news_sentiment_score: 0.5,
  macro_score: 0.94,
  alpha_score: 0.55,
  signal: 'neutral',
  main_drivers: [
    'Supportive macro and sector context',
    'Moderate risk level',
    'Above-average volume confirmation',
    'Model probability favors outperformance versus SPY',
    'Strong 20-day momentum',
  ],
  feature_importance: [
    { feature: 'momentum_score', value: 0.6, importance: 0.25 },
    { feature: 'news_sentiment_score', value: 0.5, importance: 0.2 },
    { feature: 'fundamental_quality_score', value: 0.51, importance: 0.2 },
    { feature: 'risk_score', value: 0.28, importance: 0.18 },
    { feature: 'macro_sector_score', value: 0.94, importance: 0.1 },
    { feature: 'mean_reversion_score', value: 0.91, importance: 0.07 },
  ],
  recent_news: [],
  provider_status: {
    bloomberg: 'disconnected',
    market: 'ok',
    news: 'degraded',
    fundamentals: 'degraded',
    qqq: 'ok',
    vix: 'ok',
  },
  warnings: [
    'Prediction is probabilistic, not guaranteed',
    'Bloomberg is not connected; fallback data providers are being used',
    'News data source is degraded',
    'Fundamentals data source is degraded',
    'News data unavailable or delayed; news score uses neutral fallback',
    'Fundamental data unavailable; fundamental score uses neutral fallback',
  ],
};

const rankingRows = [
  ['1', 'NVDA', '5D', 0.68, 0.018, 0.71, 0.44, 0.62, 'bullish', 'degraded'],
  ['2', 'MSFT', '5D', 0.63, -0.01, 0.55, 0.28, 0.46, 'neutral', 'degraded'],
  ['3', 'AAPL', '5D', 0.58, 0.004, 0.52, 0.34, 0.51, 'watchlist', 'ok'],
  ['4', 'AMZN', '10D', 0.55, 0.006, 0.49, 0.46, 0.43, 'neutral', 'fallback'],
  ['5', 'TSLA', '5D', 0.47, -0.021, 0.38, 0.77, 0.39, 'avoid', 'degraded'],
  ['6', 'JPM', '20D', 0.52, 0.002, 0.45, 0.31, 0.48, 'neutral', 'ok'],
].map(([rank, ticker, horizon, probability, excess, alpha, risk, confidence, signal, provider]) => ({
  rank,
  ticker,
  horizon,
  probability,
  excess,
  alpha,
  risk,
  confidence,
  signal,
  provider,
}));

const backtestMetrics = [
  ['CAGR', '+12.4%'],
  ['Sharpe', '1.08'],
  ['Sortino', '1.46'],
  ['Max DD', '-8.9%'],
  ['Win Rate', '57%'],
  ['Avg Trade', '+0.42%'],
  ['Profit Factor', '1.31'],
  ['Alpha vs SPY', '+3.2%'],
  ['Beta vs SPY', '0.92'],
  ['Info Ratio', '0.48'],
  ['Turnover', '38%'],
  ['Hit Rate', '61%'],
];

const newsItems = [
  { title: 'MSFT sentiment unavailable; neutral fallback applied', source: 'Provider status', sentiment: 'neutral', score: 0 },
  { title: 'Macro risk-on context supports large-cap software basket', source: 'Model context', sentiment: 'positive', score: 0.34 },
  { title: 'Fundamentals feed degraded; quality score remains neutral', source: 'FMP fallback', sentiment: 'neutral', score: 0 },
];

const equityCurve = [
  [0, 1, 1],
  [10, 1.012, 1.006],
  [20, 1.028, 1.014],
  [30, 1.019, 1.018],
  [40, 1.051, 1.026],
  [50, 1.068, 1.041],
  [60, 1.081, 1.052],
];

function App() {
  const [activeView, setActiveView] = useState('Dashboard');
  const [ticker, setTicker] = useState('MSFT');
  const [horizon, setHorizon] = useState(5);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [health, setHealth] = useState(null);
  const [suggestions, setSuggestions] = useState([]);
  const [suggestionsOpen, setSuggestionsOpen] = useState(false);
  const [universe, setUniverse] = useState(null);
  const [progress, setProgress] = useState('');
  const [rankingsData, setRankingsData] = useState(null);
  const [rankingsLoading, setRankingsLoading] = useState(false);
  const [rankingsError, setRankingsError] = useState('');
  const [backtestData, setBacktestData] = useState(null);
  const [backtestLoading, setBacktestLoading] = useState(false);
  const [backtestError, setBacktestError] = useState('');
  const [modelReport, setModelReport] = useState(null);
  const [modelReportLoading, setModelReportLoading] = useState(false);
  const [modelReportError, setModelReportError] = useState('');
  const comboboxRef = useRef(null);
  const activeRequestRef = useRef(0);
  const transportLabel = useMemo(() => (realtimeUrl ? 'WebSocket realtime' : 'HTTP fallback'), []);
  const analysis = useMemo(() => normalizeAnalysis(result || sampleAnalysis), [result]);

  useEffect(() => {
    cachedJson('/api/health', { ttlMs: 30_000 })
      .then(setHealth)
      .catch(() => setHealth({ ok: false, provider_summary: 'failed' }));
  }, []);

  useEffect(() => {
    function closeOnOutsideClick(event) {
      if (!comboboxRef.current?.contains(event.target)) setSuggestionsOpen(false);
    }
    document.addEventListener('mousedown', closeOnOutsideClick);
    return () => document.removeEventListener('mousedown', closeOnOutsideClick);
  }, []);

  useEffect(() => {
    if (!suggestionsOpen) return undefined;
    const query = ticker.trim();
    const controller = new AbortController();
    const timeout = setTimeout(() => {
      cachedJson(`/api/universe?q=${encodeURIComponent(query)}&limit=${TICKER_SEARCH_LIMIT}&include_etfs=false`, { signal: controller.signal, ttlMs: 86_400_000 })
        .then((payload) => {
          if (controller.signal.aborted) return;
          setUniverse(payload);
          setSuggestions(payload.results || []);
        })
        .catch(() => {
          if (controller.signal.aborted) return;
          setUniverse({ coverage: 'unavailable', warnings: ['Universe search unavailable'] });
          setSuggestions([]);
        });
    }, 220);
    return () => {
      clearTimeout(timeout);
      controller.abort();
    };
  }, [ticker, suggestionsOpen]);

  useEffect(() => {
    setRankingsData(null);
    setRankingsError('');
    setBacktestData(null);
    setBacktestError('');
    setModelReport(null);
    setModelReportError('');
  }, [horizon]);

  useEffect(() => {
    if (activeView !== 'Rankings' || rankingsData || rankingsLoading) return undefined;
    const controller = new AbortController();
    setRankingsLoading(true);
    setRankingsError('');
    cachedJson(`/api/rank?tickers=${encodeURIComponent(quickTickers.slice(0, 6).join(','))}&horizon=${horizon}`, { signal: controller.signal, ttlMs: 300_000 })
      .then((payload) => {
        if (controller.signal.aborted) return;
        if (payload.error) throw new Error(payload.error);
        setRankingsData(payload);
      })
      .catch((requestError) => {
        if (!controller.signal.aborted) setRankingsError(requestError.message || 'Rankings unavailable');
      })
      .finally(() => {
        if (!controller.signal.aborted) setRankingsLoading(false);
      });
    return () => controller.abort();
  }, [activeView, horizon, rankingsData, rankingsLoading]);

  useEffect(() => {
    if (!['Dashboard', 'Backtests'].includes(activeView) || backtestData || backtestLoading) return undefined;
    const controller = new AbortController();
    setBacktestLoading(true);
    setBacktestError('');
    cachedJson(`/api/backtest?universe=${encodeURIComponent(['MSFT', 'AAPL', 'NVDA'].join(','))}&horizon=${horizon}`, { signal: controller.signal, ttlMs: 600_000 })
      .then((payload) => {
        if (controller.signal.aborted) return;
        if (payload.error) throw new Error(payload.error);
        setBacktestData(payload);
      })
      .catch((requestError) => {
        if (!controller.signal.aborted) setBacktestError(requestError.message || 'Backtest unavailable');
      })
      .finally(() => {
        if (!controller.signal.aborted) setBacktestLoading(false);
      });
    return () => controller.abort();
  }, [activeView, horizon, backtestData, backtestLoading]);

  useEffect(() => {
    if (!['Dashboard', 'Backtests', 'Data Health'].includes(activeView) || modelReport || modelReportLoading) return undefined;
    const controller = new AbortController();
    setModelReportLoading(true);
    setModelReportError('');
    cachedJson(`/api/model/report?horizon=${horizon}`, { signal: controller.signal, ttlMs: 600_000 })
      .then((payload) => {
        if (controller.signal.aborted) return;
        if (payload.error) throw new Error(payload.error);
        setModelReport(payload);
      })
      .catch((requestError) => {
        if (!controller.signal.aborted) setModelReportError(requestError.message || 'Model diagnostics unavailable');
      })
      .finally(() => {
        if (!controller.signal.aborted) setModelReportLoading(false);
      });
    return () => controller.abort();
  }, [activeView, horizon, modelReport, modelReportLoading]);

  async function analyze(event) {
    event.preventDefault();
    setSuggestionsOpen(false);
    const requestNumber = activeRequestRef.current + 1;
    activeRequestRef.current = requestNumber;
    setLoading(true);
    setError('');
    setProgress(realtimeUrl ? 'Opening realtime stream...' : 'Fetching market data');
    try {
      const data = realtimeUrl
        ? await analyzeRealtimeWithFallback({ ticker, horizon, onProgress: (message) => isActive(requestNumber) && setProgress(message) })
        : await analyzeHttp({ ticker, horizon });
      if (!isActive(requestNumber)) return;
      setResult(data);
      setProgress('');
      setActiveView('Dashboard');
    } catch (requestError) {
      if (!isActive(requestNumber)) return;
      setError(requestError.message);
      setProgress('');
    } finally {
      if (isActive(requestNumber)) setLoading(false);
    }
  }

  return (
    <main className="terminal-shell">
      <TopNav activeView={activeView} setActiveView={setActiveView} health={health} />
      <section className="terminal-layout">
        <ControlBar
          ticker={ticker}
          setTicker={setTicker}
          horizon={horizon}
          setHorizon={setHorizon}
          analyze={analyze}
          loading={loading}
          health={health}
          transportLabel={transportLabel}
          suggestions={suggestions}
          suggestionsOpen={suggestionsOpen}
          setSuggestionsOpen={setSuggestionsOpen}
          selectTicker={selectTicker}
          comboboxRef={comboboxRef}
          universe={universe}
        />
        {!result && !loading && !error && <EmptyState />}
        {loading && <LoadingState progress={progress} />}
        {error && <ErrorState error={error} />}
        <WarningStrip warnings={analysis.warnings} />
        {activeView === 'Dashboard' && <Dashboard analysis={analysis} isSample={!result} backtestData={backtestData} backtestLoading={backtestLoading} modelReport={modelReport} modelReportLoading={modelReportLoading} modelReportError={modelReportError} />}
        {activeView === 'Rankings' && <Rankings data={rankingsData} loading={rankingsLoading} error={rankingsError} />}
        {activeView === 'Backtests' && <Backtests data={backtestData} loading={backtestLoading} error={backtestError} />}
        {activeView === 'Data Health' && <DataHealth health={health} providerStatus={analysis.provider_status} />}
      </section>
    </main>
  );

  function selectTicker(symbol) {
    setTicker(symbol);
    setSuggestions([]);
    setSuggestionsOpen(false);
  }

  function isActive(requestNumber) {
    return activeRequestRef.current === requestNumber;
  }
}

function TopNav({ activeView, setActiveView, health }) {
  return (
    <header className="top-nav">
      <div className="brand">
        <span className="brand-mark">∑</span>
        <div>
          <strong>StockProb-R</strong>
          <small>Quant outperformance terminal</small>
        </div>
      </div>
      <nav>
        {views.map((view) => (
          <button key={view} className={activeView === view ? 'active' : ''} onClick={() => setActiveView(view)} type="button">
            {view}
          </button>
        ))}
      </nav>
      <div className="nav-actions">
        <a href="https://github.com/ayushap18/stockprob-r" target="_blank" rel="noreferrer">GitHub</a>
        <a href="https://stockprob-r.vercel.app/api/health" target="_blank" rel="noreferrer">Docs</a>
        <span className={`market-pill ${health?.ok ? 'online' : 'offline'}`}>{health?.ok ? 'API online' : 'API checking'}</span>
      </div>
    </header>
  );
}

function ControlBar({ ticker, setTicker, horizon, setHorizon, analyze, loading, health, transportLabel, suggestions, suggestionsOpen, setSuggestionsOpen, selectTicker, comboboxRef, universe }) {
  return (
    <section className="control-bar">
      <form className="terminal-search" onSubmit={analyze}>
        <div className="ticker-combobox" ref={comboboxRef}>
          <label>Ticker <small>{universe?.total_universe ? `${universe.total_universe.toLocaleString()} listed stocks` : 'search all listed US stocks'}</small></label>
          <input
            value={ticker}
            placeholder="Search any US listed stock"
            onChange={(event) => {
              setTicker(event.target.value.toUpperCase());
              setSuggestionsOpen(true);
            }}
            onFocus={() => setSuggestionsOpen(true)}
            onKeyDown={(event) => {
              if (event.key === 'Escape') setSuggestionsOpen(false);
            }}
            role="combobox"
            aria-label="Ticker"
            aria-expanded={suggestionsOpen && suggestions.length > 0}
            aria-controls="ticker-suggestions"
            aria-autocomplete="list"
            autoComplete="off"
          />
          {suggestionsOpen && suggestions.length > 0 && (
            <div id="ticker-suggestions" className="suggestions" role="listbox">
              {suggestions.map((security) => (
                <button key={`${security.symbol}-${security.exchange}`} type="button" role="option" onMouseDown={(event) => event.preventDefault()} onClick={() => selectTicker(security.symbol)}>
                  <strong>{security.symbol}</strong>
                  <span>{security.name}</span>
                  <em>{security.exchange}</em>
                </button>
              ))}
              {universe?.total_universe && (
                <div className="suggestions-footer">
                  Showing {suggestions.length} matches from {universe.total_universe.toLocaleString()} listed US stocks
                </div>
              )}
            </div>
          )}
        </div>
        <div className="horizon-control" aria-label="Horizon">
          {[5, 10, 20].map((days) => (
            <button key={days} type="button" className={horizon === days ? 'selected' : ''} onClick={() => setHorizon(days)}>
              {days}D
            </button>
          ))}
        </div>
        <button className="run-button" disabled={loading}>{loading ? 'Running' : 'Run Analysis'}</button>
      </form>
      <div className="quick-row">
        {quickTickers.map((symbol) => <button key={symbol} type="button" onClick={() => selectTicker(symbol)}>{symbol}</button>)}
      </div>
      <div className="status-row">
        <StatusPill label="API" status={health?.ok ? 'ok' : 'checking'} />
        <StatusPill label="Providers" status={health?.provider_summary || 'checking'} />
        <StatusPill label={transportLabel} status={transportLabel.includes('WebSocket') ? 'ok' : 'fallback'} />
        {universe?.coverage && <span className="coverage-pill">{universe.total_universe || 'search'} listed securities · {universe.coverage}</span>}
      </div>
    </section>
  );
}

function Dashboard({ analysis, isSample, backtestData, backtestLoading, modelReport, modelReportLoading, modelReportError }) {
  const monteCarlo = useMemo(() => buildMonteCarlo(analysis), [analysis]);
  return (
    <section className="dashboard-grid">
      <TickerHeader analysis={analysis} isSample={isSample} />
      <section className="kpi-grid">
        <MetricCard label="Probability outperforming SPY" value={pct(analysis.probability_outperform_spy)} tone="primary" detail="Counted against benchmark distribution" />
        <MetricCard label="Expected return" value={signedPct(analysis.expected_return)} detail="Forward horizon expectation" />
        <MetricCard label="Excess vs SPY" value={signedPct(analysis.expected_excess_return)} tone={analysis.expected_excess_return >= 0 ? 'positive' : 'negative'} detail="Primary target differential" />
        <MetricCard label="Signal" value={title(analysis.signal)} tone={signalTone(analysis.signal)} detail="No buy/sell instruction" />
        <MetricCard label="Risk" value={`${Math.round(analysis.risk_score * 100)} · ${title(analysis.risk_label)}`} tone={riskTone(analysis.risk_score)} detail="Composite market + event risk" />
        <MetricCard label="Confidence" value={pct(analysis.confidence)} detail="Data completeness adjusted" />
      </section>
      <Panel title="Probability Gauge" className="span-4">
        <RadialGauge value={analysis.probability_outperform_spy} />
      </Panel>
      <Panel title="Score Breakdown" className="span-4">
        {scoreRows(analysis).map((row) => <ScoreBar key={row.label} {...row} />)}
      </Panel>
      <Panel title="Main Drivers" className="span-4">
        <ol className="driver-list">
          {analysis.main_drivers.map((driver, index) => <li key={driver}><span>{index + 1}</span>{driver}</li>)}
        </ol>
      </Panel>
      <Panel title="Feature Importance" className="span-5">
        <FeatureImportance rows={analysis.feature_importance} />
      </Panel>
      <Panel title="Recent News Sentiment" className="span-4">
        <NewsFeed items={analysis.recent_news?.length ? analysis.recent_news : newsItems} />
      </Panel>
      <Panel title="Provider Health" className="span-3">
        <ProviderGrid providerStatus={analysis.provider_status} />
      </Panel>
      <Panel title="Monte Carlo Preview" className="span-7">
        <MonteCarloPanel probability={analysis.probability_outperform_spy} simulation={monteCarlo} />
      </Panel>
      <Panel title="Backtest Summary" className="span-5">
        <BacktestPreview data={backtestData} loading={backtestLoading} />
      </Panel>
      <Panel title="Model Diagnostics" className="span-12">
        <ModelDiagnostics report={modelReport} loading={modelReportLoading} error={modelReportError} />
      </Panel>
    </section>
  );
}

function TickerHeader({ analysis, isSample }) {
  return (
    <section className="ticker-header">
      <div>
        <span className="micro-label">{isSample ? 'Reference sample' : 'Live analysis'} · {analysis.horizon?.toUpperCase()} horizon</span>
        <h1>{analysis.ticker} <small>{analysis.company || 'US listed equity'}</small></h1>
      </div>
      <div className="ticker-price">
        <strong>{money(analysis.current_price)}</strong>
        <span className={analysis.price_change >= 0 ? 'positive' : 'negative'}>{signedPct(analysis.price_change / 100)} today</span>
      </div>
      <SignalBadge signal={analysis.signal} />
      <span className="model-stamp">Model v1 · {analysis.as_of_date}</span>
    </section>
  );
}

function Rankings({ data, loading, error }) {
  const rows = data?.rankings?.length ? data.rankings.map((row, index) => normalizeRanking(row, index, data.horizon)) : rankingRows;
  return (
    <section className="view-stack">
      <SectionHeader eyebrow={data ? 'Live backend ranking' : 'Universe ranking'} title="Outperformance leaderboard" copy="Dense cross-sectional ranking view connected to /api/rank. Sample rows remain visible if provider calls are unavailable." />
      {loading && <StateInline label="Loading rankings" copy="Calling /api/rank and sorting by alpha score." />}
      {error && <StateInline label="Rankings fallback active" copy={error} tone="warn" />}
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              {['Rank', 'Ticker', 'Horizon', 'P(out SPY)', 'Excess', 'Alpha', 'Risk', 'Confidence', 'Signal', 'Providers'].map((heading) => <th key={heading}>{heading}</th>)}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.ticker}>
                <td>{row.rank}</td>
                <td><strong>{row.ticker}</strong></td>
                <td>{row.horizon}</td>
                <td><MiniBar value={row.probability} label={pct(row.probability)} /></td>
                <td className={row.excess >= 0 ? 'positive' : 'negative'}>{signedPct(row.excess)}</td>
                <td>{pct(row.alpha)}</td>
                <td>{pct(row.risk)}</td>
                <td>{pct(row.confidence)}</td>
                <td><SignalBadge signal={row.signal} /></td>
                <td><StatusPill label={row.provider} status={row.provider} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function Backtests({ data, loading, error }) {
  const metrics = data?.metrics ? backtestMetricRows(data.metrics) : backtestMetrics;
  const curve = data?.equity_curve?.length ? normalizeEquityCurve(data.equity_curve, data.benchmark_equity_curve) : equityCurve;
  return (
    <section className="view-stack">
      <SectionHeader eyebrow={data ? `Backend ${data.data_mode || 'backtest'}` : 'Walk-forward validation'} title="Backtest diagnostics" copy="Backtests are time-split and probabilistic. This view is connected to /api/backtest and keeps sample diagnostics as fallback." />
      {loading && <StateInline label="Loading backtest" copy="Calling /api/backtest and calculating walk-forward metrics." />}
      {error && <StateInline label="Backtest fallback active" copy={error} tone="warn" />}
      <div className="backtest-grid">
        <Panel title="Equity Curve vs SPY" className="span-7"><LineChart data={curve} /></Panel>
        <Panel title="Drawdown" className="span-5"><DrawdownChart curve={curve} /></Panel>
        <Panel title="Metrics Grid" className="span-7"><MetricGrid metrics={metrics} /></Panel>
        <Panel title="Confidence Buckets" className="span-5"><BucketChart buckets={data?.metrics?.hit_rate_by_confidence_bucket} /></Panel>
        <Panel title="Market Regime Performance" className="span-12"><RegimeBars regimes={data?.metrics?.performance_by_market_regime} /></Panel>
      </div>
    </section>
  );
}

function DataHealth({ health, providerStatus }) {
  return (
    <section className="view-stack">
      <SectionHeader eyebrow="Data quality" title="Provider state and fallback behavior" copy="Degraded providers are surfaced directly. Fallback data keeps the app usable but lowers confidence." />
      <div className="data-health-grid">
        <Panel title="Provider Grid" className="span-5"><ProviderGrid providerStatus={providerStatus} extended /></Panel>
        <Panel title="Provider Quality" className="span-7"><ProviderQualityChart health={health} providerStatus={providerStatus} /></Panel>
        <Panel title="Configured APIs" className="span-7"><ProviderReadiness health={health} /></Panel>
        <Panel title="System Capabilities" className="span-5"><CapabilityGrid health={health} /></Panel>
        <Panel title="Storage Layer" className="span-6"><StorageHealth health={health} /></Panel>
        <Panel title="Queue Layer" className="span-6"><QueueHealth health={health} /></Panel>
        <Panel title="Fallback Behavior" className="span-6">
          <ul className="plain-list">
            <li>Bloomberg uses official BLPAPI only; webpages are not scraped.</li>
            <li>Polygon and Yahoo fallback support public market data workflows.</li>
            <li>News and fundamentals can degrade to neutral scores with visible warnings.</li>
            <li>Insufficient history returns an explicit error instead of a fake prediction.</li>
          </ul>
        </Panel>
        <Panel title="Incident Log" className="span-6">
          <IncidentLog health={health} />
        </Panel>
      </div>
    </section>
  );
}

function StorageHealth({ health }) {
  const storage = health?.storage;
  if (!storage) return <StateInline label="Storage pending" copy="Health endpoint has not returned storage metadata yet." />;
  return (
    <div className="storage-health">
      <div>
        <span>mode</span>
        <StatusPill label={storage.kind} status={storage.persistent ? 'ok' : 'fallback'} />
      </div>
      <div>
        <span>persistence</span>
        <strong>{storage.persistent ? 'durable' : 'memory fallback'}</strong>
      </div>
      {storage.counts && Object.entries(storage.counts).map(([label, value]) => (
        <div key={label}>
          <span>{label.replaceAll('_', ' ')}</span>
          <strong>{value}</strong>
        </div>
      ))}
      <small>{storage.message}</small>
    </div>
  );
}

function QueueHealth({ health }) {
  const queue = health?.queue;
  if (!queue) return <StateInline label="Queue pending" copy="Health endpoint has not returned queue metadata yet." />;
  const counts = queue.counts || {};
  const worker = queue.worker_status || {};
  const workerQueues = queue.worker_plan?.queues || [];
  return (
    <div className="queue-health">
      <div>
        <span>mode</span>
        <StatusPill label={queue.kind} status={queue.distributed ? 'ok' : 'fallback'} />
      </div>
      <div>
        <span>execution</span>
        <strong>{queue.distributed ? 'distributed workers' : 'memory fallback'}</strong>
      </div>
      <div>
        <span>worker</span>
        <StatusPill label={worker.mode || queue.kind} status={worker.status === 'ready_for_distributed_worker' ? 'ok' : 'fallback'} />
      </div>
      {['queued', 'running', 'completed', 'failed'].map((label) => (
        <div key={label}>
          <span>{label}</span>
          <strong>{counts[label] ?? 0}</strong>
        </div>
      ))}
      <small>{queue.message}</small>
      {!!worker.required_processes?.length && <small>processes: {worker.required_processes.join(', ')}</small>}
      {!!workerQueues.length && (
        <div className="queue-plan">
          {workerQueues.slice(0, 5).map((workerQueue) => (
            <span key={workerQueue.name}>{workerQueue.name} c{workerQueue.concurrency}</span>
          ))}
        </div>
      )}
    </div>
  );
}

function ProviderReadiness({ health }) {
  const providers = health?.infrastructure?.providers || [];
  if (!providers.length) return <StateInline label="Readiness pending" copy="Health endpoint has not returned infrastructure metadata yet." />;
  return (
    <div className="readiness-list">
      {providers.map((provider) => (
        <div key={provider.key}>
          <StatusPill label={provider.label} status={provider.configured ? 'ok' : 'fallback'} />
          <span>{provider.category}</span>
          <small>{provider.configured ? 'configured' : `missing ${provider.missing_env.join(', ')}`}</small>
        </div>
      ))}
    </div>
  );
}

function CapabilityGrid({ health }) {
  const capabilities = health?.infrastructure?.capabilities || {};
  const cache = health?.infrastructure?.cache;
  return (
    <div className="capability-grid">
      {Object.entries(capabilities).map(([key, enabled]) => (
        <div key={key}>
          <span>{key.replaceAll('_', ' ')}</span>
          <StatusPill label={enabled ? 'ready' : 'missing'} status={enabled ? 'ok' : 'fallback'} />
        </div>
      ))}
      {cache && (
        <div>
          <span>server memory cache</span>
          <strong>{cache.entries} entries</strong>
        </div>
      )}
    </div>
  );
}

function WarningStrip({ warnings = [] }) {
  if (!warnings.length) return null;
  return (
    <section className="warning-strip">
      {warnings.slice(0, 6).map((warning) => <span key={warning}>{warning}</span>)}
    </section>
  );
}

function EmptyState() {
  return (
    <section className="state-panel">
      <strong>Enter a ticker to run the live model.</strong>
      <span>The screen below shows the production dashboard shape with MSFT sample values.</span>
    </section>
  );
}

function LoadingState({ progress }) {
  const steps = ['Fetching market data', 'Calculating technicals', 'Scoring news', 'Running model'];
  return (
    <section className="state-panel loading-state">
      <strong>{progress || 'Running analysis'}</strong>
      <div>{steps.map((step) => <span key={step}>{step}</span>)}</div>
    </section>
  );
}

function ErrorState({ error }) {
  const insufficient = /insufficient/i.test(error);
  return (
    <section className={`state-panel ${insufficient ? 'insufficient' : 'error-state'}`}>
      <strong>{insufficient ? 'Insufficient market history' : 'Analysis failed'}</strong>
      <span>{error}</span>
    </section>
  );
}

function StateInline({ label, copy, tone = '' }) {
  return <section className={`state-panel inline-state ${tone}`}><strong>{label}</strong><span>{copy}</span></section>;
}

function Panel({ title, children, className = '' }) {
  return <article className={`quant-panel ${className}`}><h2>{title}</h2>{children}</article>;
}

function MetricCard({ label, value, detail, tone = '' }) {
  return (
    <article className={`metric-card ${tone}`}>
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{detail}</small>
    </article>
  );
}

function ScoreBar({ label, value, tone = '' }) {
  const width = clamp01(value) * 100;
  return (
    <div className="score-bar">
      <div><span>{label}</span><b>{pct(value)}</b></div>
      <i><em className={tone} style={{ width: `${width}%` }} /></i>
    </div>
  );
}

function SignalBadge({ signal }) {
  return <span className={`signal-badge ${signalTone(signal)}`}>{title(signal)}</span>;
}

function StatusPill({ label, status }) {
  return <span className={`status-pill ${statusClass(status)}`}>{label}: {status}</span>;
}

function RadialGauge({ value }) {
  const radius = 74;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - clamp01(value));
  return (
    <div className="radial-wrap">
      <svg viewBox="0 0 190 190" role="img" aria-label="Probability gauge">
        <circle cx="95" cy="95" r={radius} className="gauge-track" />
        <circle cx="95" cy="95" r={radius} className="gauge-fill" strokeDasharray={circumference} strokeDashoffset={offset} />
      </svg>
      <div><strong>{pct(value)}</strong><span>Outperform SPY</span></div>
    </div>
  );
}

function FeatureImportance({ rows = [] }) {
  const max = Math.max(...rows.map((row) => Number(row.importance || 0)), 0.01);
  return (
    <div className="importance-list">
      {rows.map((row) => (
        <div key={row.feature}>
          <span>{row.feature.replaceAll('_', ' ')}</span>
          <i><em style={{ width: `${(Number(row.importance || 0) / max) * 100}%` }} /></i>
          <b>{Number(row.importance || 0).toFixed(2)}</b>
        </div>
      ))}
    </div>
  );
}

function NewsFeed({ items }) {
  return (
    <div className="news-feed">
      {items.slice(0, 5).map((item, index) => (
        <article key={`${item.title}-${index}`}>
          <span className={`sentiment ${item.sentiment || sentimentFromScore(item.sentiment_score ?? item.score)}`}>{item.sentiment || sentimentFromScore(item.sentiment_score ?? item.score)}</span>
          <strong>{item.title || item.headline}</strong>
          <small>{item.source || 'Public feed'} · score {Number(item.sentiment_score ?? item.score ?? 0).toFixed(2)}</small>
        </article>
      ))}
    </div>
  );
}

function ProviderGrid({ providerStatus = {}, extended = false }) {
  const providers = extended
    ? { bloomberg: providerStatus.bloomberg || 'disconnected', polygon: 'available', yahoo: 'fallback', alpha_vantage: providerStatus.news || 'degraded', fmp: providerStatus.fundamentals || 'degraded', qqq: providerStatus.qqq || 'ok', vix: providerStatus.vix || 'ok' }
    : providerStatus;
  return (
    <div className="provider-grid">
      {Object.entries(providers).map(([provider, status]) => <StatusPill key={provider} label={provider.replaceAll('_', ' ')} status={status} />)}
    </div>
  );
}

function MonteCarloPanel({ probability, simulation }) {
  return (
    <div className="monte-carlo">
      <FanChart simulation={simulation} />
      <div className="side-stats">
        <MetricCard label="P(out SPY)" value={pct(probability)} />
        <MetricCard label="P(up)" value={pct(simulation.probabilityUp)} />
        <MetricCard label="VaR 95%" value={signedPct(simulation.var95)} tone="negative" />
        <MetricCard label="CVaR 95%" value={signedPct(simulation.cvar95)} tone="negative" />
      </div>
    </div>
  );
}

function BacktestPreview({ data, loading }) {
  const metrics = data?.metrics ? backtestMetricRows(data.metrics).slice(0, 6) : backtestMetrics.slice(0, 6);
  const curve = data?.equity_curve?.length ? normalizeEquityCurve(data.equity_curve, data.benchmark_equity_curve) : equityCurve;
  return (
    <div className="backtest-preview">
      {loading && <StateInline label="Loading backtest" copy="Pulling backend walk-forward summary." />}
      <LineChart data={curve} compact />
      <MetricGrid metrics={metrics} compact />
    </div>
  );
}

function ModelDiagnostics({ report, loading, error }) {
  if (loading) return <StateInline label="Model diagnostics loading" copy="Fetching calibration and Brier score from /api/model/report." />;
  if (error) return <StateInline label="Model diagnostics fallback" copy={error} tone="warn" />;
  if (!report) return <StateInline label="Model diagnostics pending" copy="Calibration report has not loaded yet." />;
  const bins = (report.calibration_bins || []).filter((bin) => bin.count > 0).slice(0, 8);
  return (
    <div className="model-diagnostics">
      <div className="diagnostic-metrics">
        <MetricCard label="Brier score" value={formatNumber(report.metrics?.brier_score)} detail="Lower is better" />
        <MetricCard label="Hit rate" value={pct(report.metrics?.hit_rate)} detail={`${report.sample_size} scored outcomes`} />
        <MetricCard label="Calibration error" value={formatNumber(report.metrics?.mean_calibration_error)} detail={title(report.reliability)} />
        <MetricCard label="Data mode" value={title(report.data_mode)} detail={report.model_version} />
      </div>
      <div className="calibration-bars">
        {bins.map((bin) => (
          <div key={bin.bin}>
            <span>{Math.round(bin.lower * 100)}-{Math.round(bin.upper * 100)}%</span>
            <i><em style={{ width: `${clamp01(bin.observed_rate || 0) * 100}%` }} /></i>
            <b>{pct(bin.observed_rate)} · n={bin.count}</b>
          </div>
        ))}
      </div>
      <small>{report.warnings?.[0]}</small>
    </div>
  );
}

function LineChart({ data, compact = false }) {
  return (
    <Suspense fallback={<ChartSkeleton compact={compact} />}>
      <ChartRenderer type="line" data={data} compact={compact} />
    </Suspense>
  );
}

function DrawdownChart({ curve }) {
  return <BarStrip values={drawdownsFromCurve(curve)} negative />;
}

function BucketChart({ buckets }) {
  const entries = Object.entries(buckets || { low: 0, medium: 0, high: 0 });
  return <BarStrip values={entries.map(([, value]) => Number(value || 0))} labels={entries.map(([label]) => label)} />;
}

function RegimeBars({ regimes }) {
  const entries = Object.entries(regimes || { bullish: 0, sideways: 0, volatile: 0, bearish: 0 });
  return (
    <div className="regime-bars">
      {entries.map(([label, value]) => {
        const centered = clamp01(0.5 + Number(value || 0) * 10);
        return <ScoreBar key={label} label={title(label)} value={centered} tone={value > 0 ? 'positive' : value < 0 ? 'negative' : ''} />;
      })}
    </div>
  );
}

function ProviderQualityChart({ health, providerStatus = {} }) {
  const providers = {
    api: health?.ok ? 'ok' : 'failed',
    bloomberg: providerStatus.bloomberg || 'disconnected',
    market: providerStatus.market || health?.providers?.market || 'fallback',
    news: providerStatus.news || health?.providers?.news || 'fallback',
    fundamentals: providerStatus.fundamentals || health?.providers?.fundamentals || 'fallback',
    qqq: providerStatus.qqq || 'ok',
    vix: providerStatus.vix || 'ok',
  };
  const entries = Object.entries(providers);
  return <BarStrip values={entries.map(([, status]) => providerScore(status))} labels={entries.map(([label]) => label.slice(0, 4))} />;
}

function FanChart({ simulation }) {
  return (
    <Suspense fallback={<ChartSkeleton />}>
      <ChartRenderer type="fan" simulation={simulation} />
    </Suspense>
  );
}

function BarStrip({ values, labels = [], negative = false }) {
  return (
    <Suspense fallback={<ChartSkeleton bar />}>
      <ChartRenderer type="bar" values={values} labels={labels} negative={negative} />
    </Suspense>
  );
}

function ChartSkeleton({ compact = false, bar = false }) {
  return <div className={`chart-frame skeleton ${compact ? 'compact' : ''} ${bar ? 'bar' : ''}`}><span>Loading chart engine</span></div>;
}

function MetricGrid({ metrics, compact = false }) {
  return <div className={`metric-grid ${compact ? 'compact' : ''}`}>{metrics.map(([label, value]) => <MetricCard key={label} label={label} value={value} />)}</div>;
}

function IncidentLog({ health }) {
  const rows = [
    ['Amber', 'Bloomberg disconnected', 'Official BLPAPI not configured'],
    ['Amber', 'News degraded', 'Neutral fallback applied'],
    [health?.ok ? 'Green' : 'Red', health?.ok ? 'API online' : 'API unavailable', 'Health endpoint state'],
  ];
  return (
    <div className="incident-log">
      {rows.map(([severity, titleText, detail]) => <div key={titleText}><StatusPill label={severity} status={severity.toLowerCase()} /><strong>{titleText}</strong><span>{detail}</span></div>)}
    </div>
  );
}

function SectionHeader({ eyebrow, title, copy }) {
  return <header className="section-header"><span className="micro-label">{eyebrow}</span><h1>{title}</h1><p>{copy}</p></header>;
}

function MiniBar({ value, label }) {
  return <div className="mini-bar"><i><em style={{ width: `${clamp01(value) * 100}%` }} /></i><span>{label}</span></div>;
}

async function analyzeHttp({ ticker, horizon }) {
  return cachedJson(`/api/outperform?ticker=${encodeURIComponent(ticker)}&horizon=${horizon}`, { ttlMs: 60_000 });
}

async function analyzeRealtimeWithFallback({ ticker, horizon, onProgress }) {
  try {
    return await analyzeRealtime({ ticker, horizon, onProgress });
  } catch (error) {
    if (!error.fallbackEligible) throw error;
    onProgress?.('Realtime unavailable; using HTTP fallback...');
    return analyzeHttp({ ticker, horizon });
  }
}

function analyzeRealtime({ ticker, horizon, onProgress }) {
  return new Promise((resolve, reject) => {
    const socket = new WebSocket(realtimeUrl);
    const requestId = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    let settled = false;
    let intentionalClose = false;
    const timeout = setTimeout(() => {
      settled = true;
      intentionalClose = true;
      socket.close();
      reject(new Error('Realtime analysis timed out'));
    }, 60_000);
    const finish = (callback) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      callback();
    };

    socket.addEventListener('open', () => {
      socket.send(JSON.stringify({ type: 'analyze', request_id: requestId, payload: { ticker, horizon } }));
    });
    socket.addEventListener('message', (event) => {
      try {
        const message = JSON.parse(event.data);
        if (message.request_id && message.request_id !== requestId) return;
        if (message.type === 'analysis.progress' && typeof message.payload?.step === 'string') onProgress?.(message.payload.step.replaceAll('_', ' '));
        if (message.type === 'analysis.result') {
          finish(() => {
            intentionalClose = true;
            socket.close();
            resolve(message.payload);
          });
        }
        if (message.type === 'error' || message.type === 'analysis.failed') {
          finish(() => {
            intentionalClose = true;
            socket.close();
            reject(new Error(message.payload?.message || 'Realtime analysis failed'));
          });
        }
      } catch {
        finish(() => {
          intentionalClose = true;
          socket.close();
          reject(new Error('Invalid realtime message'));
        });
      }
    });
    socket.addEventListener('error', () => {
      finish(() => {
        const error = new Error('Realtime WebSocket unavailable');
        error.fallbackEligible = true;
        reject(error);
      });
    });
    socket.addEventListener('close', () => {
      if (settled || intentionalClose) return;
      finish(() => {
        const error = new Error('Realtime WebSocket closed before analysis completed');
        error.fallbackEligible = true;
        reject(error);
      });
    });
  });
}

async function readJson(response) {
  try {
    return await response.json();
  } catch {
    return { error: response.statusText || 'Request failed' };
  }
}

async function cachedJson(url, { ttlMs = 120_000, signal } = {}) {
  const now = Date.now();
  const cached = CLIENT_CACHE.get(url);
  if (cached && now - cached.storedAt < ttlMs) {
    CLIENT_CACHE.delete(url);
    CLIENT_CACHE.set(url, cached);
    return cached.value;
  }
  if (CLIENT_IN_FLIGHT.has(url)) return CLIENT_IN_FLIGHT.get(url);

  const request = fetch(url, { signal })
    .then(async (response) => {
      const data = await readJson(response);
      if (!response.ok || data.error) throw new Error(data.error || data.message || response.statusText || 'Request failed');
      CLIENT_CACHE.set(url, { value: data, storedAt: Date.now() });
      while (CLIENT_CACHE.size > CLIENT_CACHE_LIMIT) {
        CLIENT_CACHE.delete(CLIENT_CACHE.keys().next().value);
      }
      return data;
    })
    .finally(() => CLIENT_IN_FLIGHT.delete(url));
  CLIENT_IN_FLIGHT.set(url, request);
  return request;
}

function normalizeAnalysis(input) {
  return {
    ...sampleAnalysis,
    ...input,
    current_price: input.current_price || input.features?.technical?.current_price || sampleAnalysis.current_price,
    price_change: input.price_change ?? sampleAnalysis.price_change,
    company: input.company || sampleAnalysis.company,
    signal: input.signal || input.final_signal || 'neutral',
    risk_label: input.risk_label || 'moderate',
    main_drivers: input.main_drivers?.length ? input.main_drivers : sampleAnalysis.main_drivers,
    feature_importance: input.feature_importance?.length ? input.feature_importance : sampleAnalysis.feature_importance,
    provider_status: input.provider_status || sampleAnalysis.provider_status,
    warnings: input.warnings?.length ? input.warnings : sampleAnalysis.warnings,
  };
}

function normalizeRanking(row, index, fallbackHorizon) {
  const providerStatus = row.provider_status || {};
  const providerValues = Object.values(providerStatus);
  const provider = row.error ? 'failed' : providerValues.includes('degraded') ? 'degraded' : providerValues.includes('failed') ? 'failed' : providerValues.includes('disconnected') ? 'fallback' : 'ok';
  return {
    rank: String(index + 1),
    ticker: row.ticker,
    horizon: String(row.horizon || fallbackHorizon || '5d').toUpperCase(),
    probability: Number(row.probability_outperform_spy ?? 0),
    excess: Number(row.expected_excess_return ?? 0),
    alpha: Number(row.alpha_score ?? 0),
    risk: Number(row.risk_score ?? 1),
    confidence: Number(row.confidence ?? 0),
    signal: row.signal || 'avoid',
    provider,
  };
}

function backtestMetricRows(metrics) {
  return [
    ['CAGR', signedPct(metrics.cagr)],
    ['Sharpe', fixed(metrics.sharpe_ratio)],
    ['Sortino', fixed(metrics.sortino_ratio)],
    ['Max DD', signedPct(metrics.max_drawdown)],
    ['Win Rate', pct(metrics.win_rate)],
    ['Avg Trade', signedPct(metrics.average_return_per_trade)],
    ['Profit Factor', fixed(metrics.profit_factor)],
    ['Alpha vs SPY', signedPct(metrics.alpha_vs_spy)],
    ['Beta vs SPY', fixed(metrics.beta_vs_spy)],
    ['Info Ratio', fixed(metrics.information_ratio)],
    ['Turnover', pct(metrics.turnover)],
    ['Hit Rate', pct(metrics.hit_rate)],
  ];
}

function normalizeEquityCurve(curve, benchmarkCurve = []) {
  return curve.map((point, index) => [index, Number(point.equity || 1), Number(benchmarkCurve[index]?.equity || 1)]);
}

function buildMonteCarlo(analysis) {
  const horizon = Math.max(1, Number.parseInt(String(analysis.horizon || '5'), 10) || 5);
  const annualVol = firstFinite([
    analysis.features?.technical?.volatility_20d,
    analysis.features?.technical?.volatility_60d,
    0.28,
  ]);
  const dailyVol = Math.max(0.0025, Math.min(0.08, annualVol / Math.sqrt(252)));
  const expectedReturn = Number.isFinite(Number(analysis.expected_return)) ? Number(analysis.expected_return) : 0;
  const dailyDrift = Math.log1p(Math.max(-0.95, expectedReturn)) / horizon;
  const rng = seededRandom(`${analysis.ticker}-${analysis.as_of_date}-${analysis.horizon}-${analysis.expected_return}-${annualVol}`);
  const pathCount = 3000;
  const samplePaths = [];
  const valuesByDay = Array.from({ length: horizon + 1 }, () => []);
  const terminalReturns = [];

  for (let pathIndex = 0; pathIndex < pathCount; pathIndex += 1) {
    let price = 1;
    const path = [0];
    valuesByDay[0].push(0);
    for (let day = 1; day <= horizon; day += 1) {
      const shock = gaussian(rng);
      price *= Math.exp(dailyDrift - 0.5 * dailyVol ** 2 + dailyVol * shock);
      const returnValue = price - 1;
      valuesByDay[day].push(returnValue);
      path.push(returnValue);
    }
    terminalReturns.push(price - 1);
    if (samplePaths.length < 12) samplePaths.push(path);
  }

  const sortedTerminal = [...terminalReturns].sort((a, b) => a - b);
  const var95 = quantile(sortedTerminal, 0.05);
  const tail = sortedTerminal.filter((value) => value <= var95);
  return {
    pathsRun: pathCount,
    probabilityUp: terminalReturns.filter((value) => value > 0).length / pathCount,
    var95,
    cvar95: tail.length ? tail.reduce((sum, value) => sum + value, 0) / tail.length : var95,
    percentiles: valuesByDay.map((values, day) => {
      const sorted = values.sort((a, b) => a - b);
      return {
        day,
        p05: quantile(sorted, 0.05),
        p25: quantile(sorted, 0.25),
        p50: quantile(sorted, 0.5),
        p75: quantile(sorted, 0.75),
        p95: quantile(sorted, 0.95),
      };
    }),
    samplePaths,
  };
}

function drawdownsFromCurve(curve = []) {
  let peak = 1;
  return curve.map((row) => {
    const value = Array.isArray(row) ? Number(row[1]) : Number(row.equity);
    peak = Math.max(peak, value || 1);
    return Math.abs((value || 1) / peak - 1);
  });
}

function providerScore(status) {
  const normalized = String(status || '').toLowerCase();
  if (['ok', 'online', 'connected', 'available', 'green'].includes(normalized)) return 0.95;
  if (['degraded', 'fallback', 'disconnected', 'checking', 'amber'].includes(normalized)) return 0.45;
  if (['failed', 'offline', 'red'].includes(normalized)) return 0.08;
  return 0.3;
}

function chartScale(values, width, height, pad = 8) {
  const finiteValues = values.map(Number).filter(Number.isFinite);
  const min = Math.min(...finiteValues, 0);
  const max = Math.max(...finiteValues, 0);
  return {
    width,
    x: (index, length) => (index / Math.max(1, length - 1)) * width,
    y: (value) => height - ((Number(value) - min) / Math.max(0.0001, max - min)) * (height - pad * 2) - pad,
  };
}

function seriesPoints(rows, key, scale) {
  const maxDay = Math.max(...rows.map((row, index) => Number.isFinite(Number(row.day)) ? Number(row.day) : index), 1);
  return rows.map((row, index) => {
    const day = Number.isFinite(Number(row.day)) ? Number(row.day) : index;
    return `${((day / maxDay) * scale.width).toFixed(2)},${scale.y(row[key]).toFixed(2)}`;
  }).join(' ');
}

function quantile(sortedValues, q) {
  if (!sortedValues.length) return 0;
  const position = (sortedValues.length - 1) * q;
  const lower = Math.floor(position);
  const upper = Math.ceil(position);
  const weight = position - lower;
  return sortedValues[lower] * (1 - weight) + sortedValues[upper] * weight;
}

function seededRandom(seedText) {
  let seed = 2166136261;
  for (let index = 0; index < String(seedText).length; index += 1) {
    seed ^= String(seedText).charCodeAt(index);
    seed = Math.imul(seed, 16777619);
  }
  return () => {
    seed += 0x6D2B79F5;
    let value = seed;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function gaussian(rng) {
  const first = Math.max(Number.MIN_VALUE, rng());
  const second = rng();
  return Math.sqrt(-2 * Math.log(first)) * Math.cos(2 * Math.PI * second);
}

function firstFinite(values) {
  return values.map(Number).find(Number.isFinite);
}

function scoreRows(analysis) {
  return [
    { label: 'Technical', value: analysis.technical_score },
    { label: 'Fundamental', value: analysis.fundamental_score },
    { label: 'News Sentiment', value: analysis.news_sentiment_score },
    { label: 'Macro / Sector', value: analysis.macro_score, tone: 'positive' },
    { label: 'Composite Alpha', value: analysis.alpha_score },
  ];
}

function toPoints(values, width, height) {
  const min = Math.min(...values);
  const max = Math.max(...values);
  return values.map((value, index) => {
    const x = (index / Math.max(1, values.length - 1)) * width;
    const y = height - ((value - min) / Math.max(0.0001, max - min)) * (height - 10) - 5;
    return `${x.toFixed(2)},${y.toFixed(2)}`;
  }).join(' ');
}

function pct(value) {
  return Number.isFinite(Number(value)) ? `${Math.round(Number(value) * 100)}%` : 'n/a';
}

function signedPct(value) {
  if (!Number.isFinite(Number(value))) return 'n/a';
  const number = Number(value) * 100;
  return `${number >= 0 ? '+' : ''}${number.toFixed(1)}%`;
}

function fixed(value) {
  return Number.isFinite(Number(value)) ? Number(value).toFixed(2) : 'n/a';
}

function formatNumber(value) {
  return Number.isFinite(Number(value)) ? Number(value).toFixed(3) : 'n/a';
}

function money(value) {
  return Number.isFinite(Number(value)) ? `$${Number(value).toFixed(2)}` : 'n/a';
}

function title(value) {
  return String(value || 'n/a').replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function clamp01(value) {
  return Math.max(0, Math.min(1, Number(value || 0)));
}

function signalTone(signal) {
  if (['bullish', 'watchlist'].includes(String(signal).toLowerCase())) return 'positive';
  if (['bearish', 'avoid'].includes(String(signal).toLowerCase())) return 'negative';
  return 'neutral';
}

function riskTone(value) {
  if (Number(value) > 0.66) return 'negative';
  if (Number(value) > 0.42) return 'warning';
  return 'positive';
}

function statusClass(status) {
  const normalized = String(status || '').toLowerCase();
  if (['ok', 'online', 'connected', 'available', 'green'].includes(normalized)) return 'ok';
  if (['failed', 'offline', 'red'].includes(normalized)) return 'bad';
  if (['degraded', 'fallback', 'disconnected', 'checking', 'amber'].includes(normalized)) return 'warn';
  return 'neutral';
}

function sentimentFromScore(score) {
  const value = Number(score || 0);
  if (value > 0.15) return 'positive';
  if (value < -0.15) return 'negative';
  return 'neutral';
}

class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  render() {
    if (this.state.hasError) {
      return (
        <main className="terminal-shell">
          <section className="state-panel error-state">
            <strong>Dashboard failed safely.</strong>
            <span>Refresh the page or call `/api/health` to inspect service status.</span>
          </section>
        </main>
      );
    }
    return this.props.children;
  }
}

createRoot(document.getElementById('root')).render(
  <ErrorBoundary>
    <App />
  </ErrorBoundary>
);
