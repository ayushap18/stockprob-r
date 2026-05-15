# Operations

StockProb-R is built to degrade safely when external data providers fail.

## Health Check

```bash
curl https://stockprob-r.vercel.app/api/health
```

Expected response:

```json
{
  "ok": true,
  "service": "stockprob-r",
  "providers": {
    "bloomberg": "disconnected",
    "market": "fallback",
    "news": "fallback",
    "fundamentals": "fallback"
  },
  "provider_summary": "degraded"
}
```

`degraded` does not mean the service is down. It means at least one institutional or paid provider is not configured and a fallback path is active.

## Failure Policy

- Missing optional fundamentals/news: return neutral fallback scores with warnings.
- Missing VIX/QQQ: return degraded provider status and continue where possible.
- Missing ticker or SPY price history: return `503` with row counts and provider status.
- Invalid ticker or horizon: return `400`.

## Accuracy Policy

Do not advertise fixed accuracy without a dated backtest report. Use:

- hit rate by confidence bucket
- calibration curve
- alpha versus SPY
- information ratio
- market-regime breakdown
- out-of-sample walk-forward periods

## Provider Configuration

```bash
BLOOMBERG_API_ENABLED=false
BLOOMBERG_HOST=localhost
BLOOMBERG_PORT=8194
POLYGON_API_KEY=
ALPHA_VANTAGE_API_KEY=
FMP_API_KEY=
```

Bloomberg support is official API/BLPAPI only. Webpage scraping is intentionally unsupported.
