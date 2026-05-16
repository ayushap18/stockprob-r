# Operations

StockProb-R is built to degrade safely when external data providers fail.

## Health Check

```bash
curl https://stockprob-r.vercel.app/api/health
curl "https://stockprob-r.vercel.app/api/universe?q=MSFT&limit=5"
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
- Missing listed-symbol directory: return the fallback seed universe and report the universe provider warning.
- Failed custom universe client: return the fallback seed universe and report the provider failure.
- Empty provider response: mark the source degraded and include a warning.
- Invalid ticker or horizon: return `400`.

## Cache Policy

Provider fetches use an in-memory bounded cache in the Node process.

- Maximum default entries: `500`
- Identical concurrent cache misses are coalesced into one provider request.
- Expired entries are evicted on access.
- Cache stats are available internally through `cacheStats()` for diagnostics and tests.

## Realtime Mode

The Vercel app uses HTTP APIs. For faster local or dedicated Node deployments, run the WebSocket service:

```bash
cd js
npm run realtime
```

Dashboard opt-in:

```bash
VITE_REALTIME_URL=ws://localhost:8091 npm run dev
```

Protocol:

- `analyze`: streams `analysis.start`, ordered `analysis.progress`, `provider.status`, and `analysis.result`.
- `rank`: ranks up to 100 submitted tickers and streams `rank.item`, `rank.leaderboard`, and `rank.complete`.
- `universe.search`: searches the listed US symbol universe and returns `universe.results`.
- `watchlist.subscribe`: emits `watchlist.snapshot` and later `watchlist.update` events when signal/probability changes.
- `watchlist.unsubscribe`: stops a watchlist subscription.
- `backtest`: emits `backtest.start`, `backtest.progress`, `backtest.trade`, `backtest.metrics`, and `backtest.complete`.
- `agent.blank`: opens a neutral blank realtime agent channel for operational conversation, not trading advice.
- `cancel`: marks an active `request_id` as cancelled and suppresses late results.
- `ping`: returns `pong` and `heartbeat.pong` for client keepalive checks.
- `metrics`: returns active realtime request counts and ages.

The realtime server sends heartbeat pings and terminates dead sockets to avoid stale client buildup. It also enforces a 64 KB message limit, per-client rate limiting, and bounded-concurrent ranking work.

## Worker Mode

Queued rank, backtest, provider-refresh, and single-ticker analysis jobs use a shared worker contract. Local development uses the in-process memory queue:

```bash
cd js
npm run worker -- --status
npm run worker -- --once
```

Production deployments should set `REDIS_URL` and run `npm run worker` as a separate long-lived process beside the HTTP app and realtime server. The worker readiness object never exposes Redis secrets.

## Nightly Cron

Vercel is configured to call `/api/cron/nightly` at `07:00 UTC` on Monday-Friday. The endpoint enqueues:

- `provider-refresh`
- `rank`
- `backtest`

Configure `CRON_SECRET` in production and call the endpoint with `Authorization: Bearer $CRON_SECRET`. If `CRON_SECRET` is missing, the endpoint remains usable for local development and returns a warning.

Analysis progress steps:

- `fetching_prices`
- `fetching_spy`
- `fetching_news`
- `fetching_fundamentals`
- `calculating_features`
- `running_model`
- `complete`

Structured realtime error codes:

- `INVALID_TICKER`
- `RATE_LIMITED`
- `PROVIDER_FAILED`
- `INSUFFICIENT_HISTORY`
- `JOB_CANCELLED`
- `TIMEOUT`
- `INVALID_MESSAGE`

## Accuracy Policy

Do not advertise fixed accuracy without a dated backtest report. Use:

- hit rate by confidence bucket
- calibration curve
- alpha versus SPY
- information ratio
- market-regime breakdown
- out-of-sample walk-forward periods

Model diagnostics endpoint:

```bash
curl "http://localhost:8080/api/model/report?horizon=5"
```

POST realized prediction outcomes to the same endpoint to produce production calibration reports. GET returns demo diagnostics for UI/API shape only and includes a warning.

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
