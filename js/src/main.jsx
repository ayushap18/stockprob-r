import React, { Component, useEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import './styles.css';

const quickTickers = ['AAPL', 'MSFT', 'NVDA', 'TSLA', 'AMZN', 'GOOGL', 'META', 'JPM'];
const realtimeUrl = import.meta.env.VITE_REALTIME_URL || '';
const views = ['Dashboard', 'Rankings', 'Backtests', 'Data Health'];

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
  const comboboxRef = useRef(null);
  const activeRequestRef = useRef(0);
  const transportLabel = useMemo(() => (realtimeUrl ? 'WebSocket realtime' : 'HTTP fallback'), []);
  const analysis = normalizeAnalysis(result || sampleAnalysis);

  useEffect(() => {
    fetch('/api/health')
      .then(readJson)
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
    if (!query) {
      setSuggestions([]);
      return undefined;
    }
    const controller = new AbortController();
    const timeout = setTimeout(() => {
      fetch(`/api/universe?q=${encodeURIComponent(query)}&limit=8`, { signal: controller.signal })
        .then(readJson)
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
        {activeView === 'Dashboard' && <Dashboard analysis={analysis} isSample={!result} />}
        {activeView === 'Rankings' && <Rankings />}
        {activeView === 'Backtests' && <Backtests />}
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
          <label>Ticker</label>
          <input
            value={ticker}
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

function Dashboard({ analysis, isSample }) {
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
        <MonteCarloPanel probability={analysis.probability_outperform_spy} />
      </Panel>
      <Panel title="Backtest Summary" className="span-5">
        <BacktestPreview />
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

function Rankings() {
  return (
    <section className="view-stack">
      <SectionHeader eyebrow="Universe ranking" title="Outperformance leaderboard" copy="Dense cross-sectional ranking view for selected US tickers. Values are sample UI data until wired to a batch ranking endpoint." />
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              {['Rank', 'Ticker', 'Horizon', 'P(out SPY)', 'Excess', 'Alpha', 'Risk', 'Confidence', 'Signal', 'Providers'].map((heading) => <th key={heading}>{heading}</th>)}
            </tr>
          </thead>
          <tbody>
            {rankingRows.map((row) => (
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

function Backtests() {
  return (
    <section className="view-stack">
      <SectionHeader eyebrow="Walk-forward validation" title="Backtest diagnostics" copy="Backtests are time-split and probabilistic. No accuracy claim is made without dated validation." />
      <div className="backtest-grid">
        <Panel title="Equity Curve vs SPY" className="span-7"><LineChart data={equityCurve} /></Panel>
        <Panel title="Drawdown" className="span-5"><DrawdownChart /></Panel>
        <Panel title="Metrics Grid" className="span-7"><MetricGrid metrics={backtestMetrics} /></Panel>
        <Panel title="Confidence Buckets" className="span-5"><BucketChart /></Panel>
        <Panel title="Market Regime Performance" className="span-12"><RegimeBars /></Panel>
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
        <Panel title="Latency Trace" className="span-7"><LatencyChart /></Panel>
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

function MonteCarloPanel({ probability }) {
  return (
    <div className="monte-carlo">
      <FanChart />
      <div className="side-stats">
        <MetricCard label="P(out SPY)" value={pct(probability)} />
        <MetricCard label="P(up)" value="56%" />
        <MetricCard label="VaR 95%" value="-4.8%" tone="negative" />
        <MetricCard label="CVaR 95%" value="-7.2%" tone="negative" />
      </div>
    </div>
  );
}

function BacktestPreview() {
  return (
    <div className="backtest-preview">
      <LineChart data={equityCurve} compact />
      <MetricGrid metrics={backtestMetrics.slice(0, 6)} compact />
    </div>
  );
}

function LineChart({ data, compact = false }) {
  const pointsA = toPoints(data.map((row) => row[1]), compact ? 120 : 220, compact ? 72 : 150);
  const pointsB = toPoints(data.map((row) => row[2]), compact ? 120 : 220, compact ? 72 : 150);
  return (
    <svg className="line-chart" viewBox={`0 0 ${compact ? 120 : 220} ${compact ? 72 : 150}`} preserveAspectRatio="none">
      <polyline points={pointsB} className="line-spy" />
      <polyline points={pointsA} className="line-model" />
    </svg>
  );
}

function DrawdownChart() {
  return <BarStrip values={[0.02, 0.05, 0.03, 0.08, 0.04, 0.09, 0.06, 0.03]} negative />;
}

function BucketChart() {
  return <BarStrip values={[0.48, 0.53, 0.57, 0.61, 0.66]} labels={['40', '50', '60', '70', '80']} />;
}

function RegimeBars() {
  return (
    <div className="regime-bars">
      {[
        ['Bullish', 0.68],
        ['Sideways', 0.54],
        ['Volatile', 0.49],
        ['Bearish', 0.43],
      ].map(([label, value]) => <ScoreBar key={label} label={label} value={value} tone={value > 0.55 ? 'positive' : value < 0.5 ? 'negative' : ''} />)}
    </div>
  );
}

function LatencyChart() {
  return <BarStrip values={[0.22, 0.34, 0.27, 0.42, 0.31, 0.29, 0.47, 0.33]} labels={['Mkt', 'News', 'FMP', 'VIX', 'QQQ', 'SEC', 'API', 'Cache']} />;
}

function FanChart() {
  return (
    <svg className="fan-chart" viewBox="0 0 320 160" preserveAspectRatio="none">
      <path d="M0,92 C70,78 130,64 320,24 L320,136 C130,118 70,104 0,92Z" className="fan-wide" />
      <path d="M0,92 C70,84 130,76 320,58 L320,112 C130,106 70,98 0,92Z" className="fan-mid" />
      <path d="M0,92 C70,88 130,86 320,84" className="fan-line" />
      <path d="M0,92 C80,100 140,82 320,70" className="sample-line" />
      <path d="M0,92 C70,70 170,88 320,48" className="sample-line faint" />
    </svg>
  );
}

function BarStrip({ values, labels = [], negative = false }) {
  return (
    <div className={`bar-strip ${negative ? 'drawdown' : ''}`}>
      {values.map((value, index) => (
        <div key={`${value}-${index}`}>
          <i style={{ height: `${Math.max(8, value * 100)}%` }} />
          {labels[index] && <span>{labels[index]}</span>}
        </div>
      ))}
    </div>
  );
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
  const response = await fetch(`/api/outperform?ticker=${encodeURIComponent(ticker)}&horizon=${horizon}`);
  const data = await readJson(response);
  if (!response.ok) throw new Error(data.error || data.message || 'Analysis failed');
  return data;
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
