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
    server/
      data/
      features/
      models/
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
```

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

## Deployment

The Vercel app is deployed from the `js/` directory.

```bash
cd js
vercel --prod
```

## License

MIT
