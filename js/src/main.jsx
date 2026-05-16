import React, { Component, useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import './styles.css';

const quickTickers = ['AAPL', 'MSFT', 'NVDA', 'TSLA', 'AMZN', 'GOOGL', 'META', 'JPM'];
const realtimeUrl = import.meta.env.VITE_REALTIME_URL || '';

function App() {
  const [ticker, setTicker] = useState('MSFT');
  const [horizon, setHorizon] = useState(5);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [health, setHealth] = useState(null);
  const [suggestions, setSuggestions] = useState([]);
  const [universe, setUniverse] = useState(null);
  const [progress, setProgress] = useState('');
  const transportLabel = useMemo(() => (realtimeUrl ? 'WebSocket realtime' : 'HTTP fallback'), []);

  useEffect(() => {
    fetch('/api/health')
      .then((response) => response.json())
      .then(setHealth)
      .catch(() => setHealth({ ok: false, provider_summary: 'failed' }));
  }, []);

  useEffect(() => {
    const query = ticker.trim();
    if (!query) {
      setSuggestions([]);
      return undefined;
    }
    const timeout = setTimeout(() => {
      fetch(`/api/universe?q=${encodeURIComponent(query)}&limit=8`)
        .then((response) => response.json())
        .then((payload) => {
          setUniverse(payload);
          setSuggestions(payload.results || []);
        })
        .catch(() => {
          setUniverse({ coverage: 'unavailable', warnings: ['Universe search unavailable'] });
          setSuggestions([]);
        });
    }, 220);
    return () => clearTimeout(timeout);
  }, [ticker]);

  async function analyze(event) {
    event.preventDefault();
    setLoading(true);
    setError('');
    setProgress(realtimeUrl ? 'Opening realtime stream...' : 'Fetching model output...');
    try {
      const data = realtimeUrl ? await analyzeRealtime({ ticker, horizon, onProgress: setProgress }) : await analyzeHttp({ ticker, horizon });
      setResult(data);
      setProgress('');
    } catch (requestError) {
      setError(requestError.message);
      setProgress('');
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
            <div className="ticker-combobox">
              <input value={ticker} onChange={(event) => setTicker(event.target.value.toUpperCase())} aria-label="Ticker" autoComplete="off" />
              {suggestions.length > 0 && (
                <div className="suggestions">
                  {suggestions.map((security) => (
                    <button key={`${security.symbol}-${security.exchange}`} type="button" onClick={() => setTicker(security.symbol)}>
                      <strong>{security.symbol}</strong>
                      <span>{security.name}</span>
                      <em>{security.exchange}</em>
                    </button>
                  ))}
                </div>
              )}
            </div>
            <select value={horizon} onChange={(event) => setHorizon(Number(event.target.value))} aria-label="Horizon">
              <option value={5}>5D</option>
              <option value={10}>10D</option>
              <option value={20}>20D</option>
            </select>
            <button disabled={loading}>{loading ? 'Calculating...' : 'Run'}</button>
          </form>
          <div className="ticker-row">
            {quickTickers.map((symbol) => (
              <button key={symbol} type="button" onClick={() => setTicker(symbol)}>{symbol}</button>
            ))}
          </div>
          <p className={`health ${health?.ok ? 'health-ok' : 'health-warn'}`}>
            API {health?.ok ? 'online' : 'checking'} · providers {health?.provider_summary || 'checking'} · {transportLabel}
          </p>
          {universe?.coverage && <p className="coverage">Universe: {universe.coverage} · {universe.total_universe || 'search'} listed securities</p>}
          {progress && <p className="progress">{progress}</p>}
          {error && <p className="error">{error}</p>}
        </div>
      </section>
      <section className="dashboard">
        {result ? <Result result={result} /> : <EmptyState />}
      </section>
    </main>
  );
}

async function analyzeHttp({ ticker, horizon }) {
  const response = await fetch(`/api/outperform?ticker=${encodeURIComponent(ticker)}&horizon=${horizon}`);
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || data.message || 'Analysis failed');
  return data;
}

function analyzeRealtime({ ticker, horizon, onProgress }) {
  return new Promise((resolve, reject) => {
    const socket = new WebSocket(realtimeUrl);
    const requestId = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const timeout = setTimeout(() => {
      socket.close();
      reject(new Error('Realtime analysis timed out'));
    }, 60_000);

    socket.addEventListener('open', () => {
      socket.send(JSON.stringify({ type: 'analyze', request_id: requestId, payload: { ticker, horizon } }));
    });
    socket.addEventListener('message', (event) => {
      const message = JSON.parse(event.data);
      if (message.request_id && message.request_id !== requestId) return;
      if (message.type === 'analysis.progress') onProgress?.(message.payload.step.replaceAll('_', ' '));
      if (message.type === 'analysis.result') {
        clearTimeout(timeout);
        socket.close();
        resolve(message.payload);
      }
      if (message.type === 'error') {
        clearTimeout(timeout);
        socket.close();
        reject(new Error(message.payload.message || 'Realtime analysis failed'));
      }
    });
    socket.addEventListener('error', () => {
      clearTimeout(timeout);
      reject(new Error('Realtime WebSocket unavailable. Use HTTP fallback or start npm run realtime.'));
    });
  });
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
