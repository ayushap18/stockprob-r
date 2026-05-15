# StockProb R Engine

The R engine lives in `r/stockprob_engine.R`. It mirrors the backend orchestration contract:

- price history
- volatility
- earnings
- sentiment
- macro
- Monte Carlo
- confidence and risk flags

It does not fabricate missing market data. If a provider is unavailable, the related agent returns `degraded` or `failed` and confidence is reduced.

## Run

Install R, then run:

```bash
Rscript r/stockprob_cli.R --ticker AAPL --window-days 30 --as-of-date 2026-05-13 --risk-tolerance moderate --seed 42
```

Or pass a JSON request file if `jsonlite` is installed:

```bash
Rscript r/stockprob_cli.R request.json
```

## Tests

```bash
Rscript tests/r/test_stockprob_engine.R
```

The tests use mocked agents, so they do not require live market APIs.

## Optional Providers

The deterministic math core is base R. Live JSON providers use optional `jsonlite`.

```r
install.packages("jsonlite")
```

Environment variables:

```bash
POLYGON_API_KEY=
ALPHA_VANTAGE_API_KEY=
SEC_USER_AGENT=StockProb/1.0 contact@example.com
```

FRED macro pulls use public CSV endpoints. If the network or source fails, macro fields remain null/NA and the macro agent fails or degrades instead of filling guessed values.
