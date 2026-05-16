# StockProb-R Production Power Plan

This is the implementation order for turning StockProb-R from a strong dashboard/backend prototype into a durable quant research platform.

## Phase 1: Data Provider Foundation

- Add provider readiness registry for Polygon, FMP, Alpha Vantage, FRED, Bloomberg, Redis, Postgres, object storage, and model worker.
- Expose configured/missing API keys through `/api/health` without leaking secret values.
- Keep the app usable with neutral/fallback scores when providers are missing.

Status: started.

## Phase 2: Storage And Cache

- Add Postgres/TimescaleDB schema for prices, features, predictions, provider status, and backtests.
- Add Redis for distributed cache, queue state, websocket fanout, and rate limiting.
- Persist raw provider payload metadata for auditability.

Status: storage adapter and in-process cache are implemented; Redis queue readiness is exposed with memory fallback.

## Phase 3: Jobs And Agents

- Add background jobs for nightly universe refresh, feature calculation, rankings, and backtests.
- Add bounded queue concurrency and provider rate-limit policies.
- Split agents into market, fundamentals, news, filings, macro, options, earnings, risk, model, and backtest workers.

Status: queue contract, rank/backtest job metadata, worker plan, health visibility, local worker runner, and nightly cron orchestration are implemented. Run `npm run worker -- --once` for local memory-queue draining or `npm run worker -- --status` to inspect worker readiness. Next production step is binding this runner to a BullMQ adapter when `REDIS_URL` is configured.

## Phase 4: Modeling

- Add Python model worker for LightGBM/XGBoost/CatBoost.
- Add model registry, calibration reports, Brier score, SHAP explanations, and walk-forward retraining.
- Store every prediction and score it later against realized SPY outperformance.

Status: baseline model diagnostics are implemented with Brier score, calibration bins, threshold metrics, `/api/model/report`, and dashboard diagnostics. Next production step is connecting persisted prediction outcomes from Postgres to this report and adding a Python model worker for tree models and SHAP.

## Phase 5: Product Hardening

- Add auth, saved watchlists, scheduled alerts, provider SLA monitoring, and incident history.
- Add production observability with Sentry/OpenTelemetry.
- Add chart code splitting and performance budgets.
