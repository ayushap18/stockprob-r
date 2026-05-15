import React, { Component, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import './styles.css';

const sampleTickers = ['AAPL', 'MSFT', 'NVDA', 'TSLA'];

function App() {
  const [ticker, setTicker] = useState('MSFT');
  const [horizon, setHorizon] = useState(5);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [health, setHealth] = useState(null);

  useEffect(() => {
    fetch('/api/health')
      .then((response) => response.json())
      .then(setHealth)
      .catch(() => setHealth({ ok: false, provider_summary: 'failed' }));
  }, []);

  async function analyze(event) {
    event.preventDefault();
    setLoading(true);
    setError('');
    try {
      const response = await fetch(`/api/outperform?ticker=${encodeURIComponent(ticker)}&horizon=${horizon}`);
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Analysis failed');
      setResult(data);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main>
      <section className="hero">
        <div className="hero-content">
          <p className="eyebrow">Quantitative US equity research</p>
          <h1>StockProb-R</h1>
          <p className="lede">
            Predict probability of outperforming SPY with technicals, fundamentals, news sentiment, macro context, risk scoring, and walk-forward backtesting.
          </p>
          <form className="search" onSubmit={analyze}>
            <input value={ticker} onChange={(event) => setTicker(event.target.value.toUpperCase())} aria-label="Ticker" />
            <select value={horizon} onChange={(event) => setHorizon(Number(event.target.value))} aria-label="Horizon">
              <option value={5}>5D</option>
              <option value={10}>10D</option>
              <option value={20}>20D</option>
            </select>
            <button disabled={loading}>{loading ? 'Calculating...' : 'Run'}</button>
          </form>
          <div className="ticker-row">
            {sampleTickers.map((symbol) => (
              <button key={symbol} type="button" onClick={() => setTicker(symbol)}>{symbol}</button>
            ))}
          </div>
          <p className={`health ${health?.ok ? 'health-ok' : 'health-warn'}`}>
            API {health?.ok ? 'online' : 'checking'} · providers {health?.provider_summary || 'checking'}
          </p>
          {error && <p className="error">{error}</p>}
        </div>
      </section>
      <section className="dashboard">
        {result ? <Result result={result} /> : <EmptyState />}
      </section>
    </main>
  );
}

function Result({ result }) {
  return (
    <div className="result-grid">
      <article className="panel primary">
        <div className="split">
          <div>
            <p className="eyebrow">{result.ticker} · {result.horizon}</p>
            <h2>{result.signal}</h2>
          </div>
          <strong>{pct(result.probability_outperform_spy)} vs SPY</strong>
        </div>
        <div className="metrics">
          <Metric label="Expected return" value={signedPct(result.expected_return)} />
          <Metric label="Excess return" value={signedPct(result.expected_excess_return)} />
          <Metric label="Risk" value={`${pct(result.risk_score)} ${result.risk_label || ''}`} />
          <Metric label="Confidence" value={pct(result.confidence)} />
        </div>
      </article>
      <article className="panel">
        <h3>Scores</h3>
        <Score label="Technical" value={result.technical_score} />
        <Score label="Fundamental" value={result.fundamental_score} />
        <Score label="News" value={result.news_sentiment_score} />
        <Score label="Macro" value={result.macro_score} />
        <Score label="Alpha" value={result.alpha_score} />
      </article>
      <article className="panel">
        <h3>Main drivers</h3>
        <ol>
          {(result.main_drivers || []).map((driver) => <li key={driver}>{driver}</li>)}
        </ol>
      </article>
      <article className="panel wide">
        <h3>Warnings</h3>
        {(result.warnings || []).map((warning) => <p key={warning} className="warning">{warning}</p>)}
      </article>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="panel empty">
      <h2>Enter a ticker to run the outperformance model.</h2>
      <p>The deployed demo uses public fallback sources when institutional providers are not configured.</p>
    </div>
  );
}

function Metric({ label, value }) {
  return <div><span>{label}</span><b>{value}</b></div>;
}

function Score({ label, value }) {
  const width = Math.max(0, Math.min(100, Number(value || 0) * 100));
  return (
    <div className="score">
      <div><span>{label}</span><b>{pct(value)}</b></div>
      <i><em style={{ width: `${width}%` }} /></i>
    </div>
  );
}

function pct(value) {
  return Number.isFinite(Number(value)) ? `${Math.round(Number(value) * 100)}%` : 'n/a';
}

function signedPct(value) {
  if (!Number.isFinite(Number(value))) return 'n/a';
  const number = Number(value) * 100;
  return `${number >= 0 ? '+' : ''}${number.toFixed(1)}%`;
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
        <main className="dashboard">
          <div className="panel empty">
            <h2>Dashboard failed safely.</h2>
            <p>Refresh the page or call `/api/health` to inspect service status.</p>
          </div>
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
