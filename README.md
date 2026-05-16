<p align="center">
  <img src="assets/banner.png" alt="StockProb-R quantitative stock prediction banner" width="100%" />
</p>

# StockProb-R

StockProb-R is a serious quantitative US stock prediction and ranking system. It predicts whether a stock is likely to outperform SPY over a selected future horizon, with modular JavaScript and R implementations kept in separate folders.

> This is math, not advice. Outputs are probabilistic and must be validated with backtesting before use.

## Live Demo

Vercel deployment: [https://stockprob-r.vercel.app](https://stockprob-r.vercel.app)

## Repository Layout

```text
stockprob-r/
  assets/
    banner.png
  js/
    api/
      outperform.js
      universe.js
    server/
      data/
      features/
      models/
      realtime/
      backtesting/
    src/
    tests/
  r/
    stockprob_engine.R
    stockprob_cli.R
    tests/
  docs/
```

## What It Calculates

- Probability of outperforming SPY
- Expected return
- Expected excess return versus SPY
- Risk score and risk label
- Confidence score
- Technical score
- Fundamental quality score
- News sentiment score
- Macro and sector score
- Composite alpha score
- Final signal: `bullish`, `watchlist`, `neutral`, `bearish`, or `avoid`
- Main drivers and feature importance
- Walk-forward backtest metrics
- Provider health and graceful degradation warnings

## JavaScript App

```bash
cd js
npm install
npm test
npm run build
npm run dev
```

Local app:

```text
http://localhost:8080
```

API:

```bash
curl "http://localhost:8080/api/outperform?ticker=MSFT&horizon=5"
curl "http://localhost:8080/api/universe?q=micro&limit=10"
curl "http://localhost:8080/api/health"
```

Realtime WebSocket server for local or dedicated Node deployments:

```bash
cd js
npm run realtime
```

Then point the dashboard at it:

```bash
VITE_REALTIME_URL=ws://localhost:8091 npm run dev
```

Supported realtime messages are `analyze`, `rank`, `universe.search`, `cancel`, `ping`, and `metrics`. The realtime server includes payload limits, heartbeat cleanup, per-client rate limiting, request lifecycle tracking, cancellation, and bounded-concurrent ranking. Vercel serverless deployment keeps using HTTP fallback because Vercel functions are not long-lived WebSocket servers.

## Robustness Model

The app is designed to fail closed and explain data gaps instead of silently inventing numbers.

- Provider calls are isolated with retries, timeouts, and in-memory caching.
- Identical concurrent provider requests are coalesced and the process cache is bounded to prevent unbounded growth.
- If a paid data provider is unavailable, the response includes a provider warning and uses the next configured fallback where possible.
- If core price history for the ticker or SPY is insufficient, the API returns a structured `503` rather than a misleading prediction.
- The UI has an error boundary and a live API/provider health indicator.
- Serverless responses set cache headers for repeated public-data requests.
- The listed-symbol universe is loaded from NASDAQ Trader symbol directories for NASDAQ, NYSE, NYSE American, NYSE Arca, Cboe BZX, and related listed US securities.
- WebSocket analysis streams typed progress/result events in Node environments, while HTTP remains the safe deployment fallback.
- Realtime requests are keyed by `request_id`, can be cancelled, and expose lightweight server metrics for active work.

No market system can guarantee zero failures or perfect accuracy. StockProb-R reduces operational failure modes and makes uncertainty visible.

## R Engine

```bash
cd r
Rscript tests/test_stockprob_engine.R
Rscript stockprob_cli.R --ticker MSFT --window-days 30 --as-of-date 2026-05-16 --risk-tolerance moderate --seed 42
```

## Data Providers

Bloomberg is supported only through official Bloomberg API / BLPAPI-style configuration. The project does not scrape Bloomberg webpages.

Fallback providers:

- Polygon.io for adjusted OHLCV
- Yahoo Finance chart endpoint for development fallback
- NASDAQ Trader listed-symbol directories for searchable US security coverage
- Alpha Vantage for public news sentiment
- Financial Modeling Prep for fundamentals

Environment variables:

```bash
BLOOMBERG_API_ENABLED=false
BLOOMBERG_HOST=localhost
BLOOMBERG_PORT=8194
POLYGON_API_KEY=
ALPHA_VANTAGE_API_KEY=
FMP_API_KEY=
```

If Bloomberg or paid providers are not configured, the app remains usable with fallback sources and returns explicit provider warnings.

## Backtesting

The JavaScript engine includes a walk-forward backtest module that:

- Uses time-ordered feature windows
- Prevents lookahead bias by slicing features before exits
- Supports 5, 10, and 20 trading day horizons
- Compares selected stocks against SPY
- Includes transaction cost and slippage assumptions

## Accuracy and Calibration

Accuracy is not claimed by default. It must be measured per universe, horizon, rebalance schedule, and provider set.

Recommended validation before relying on a model:

1. Run walk-forward backtests over multiple market regimes.
2. Compare hit rate against SPY by confidence bucket.
3. Track calibration: predictions near 60% should win near 60% over a large sample.
4. Review performance by sector and volatility regime.
5. Refit or retune weights only with time-split training data.

The repository currently ships a transparent heuristic/logistic baseline. It is intentionally explainable and can be replaced later by trained logistic regression, random forest, XGBoost, LightGBM, or ensemble models after validated training data exists.

## Deployment

The Vercel app is deployed from the `js/` directory.

```bash
cd js
vercel --prod
```

## License

MIT
