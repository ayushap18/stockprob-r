source("stockprob_engine.R")

assert_equal <- function(actual, expected, label) {
  if (!identical(actual, expected)) {
    stop(sprintf("%s\nExpected: %s\nActual: %s", label, paste(capture.output(str(expected)), collapse = "\n"), paste(capture.output(str(actual)), collapse = "\n")))
  }
}

assert_true <- function(value, label) {
  if (!isTRUE(value)) {
    stop(sprintf("%s\nExpected TRUE, got: %s", label, paste(capture.output(str(value)), collapse = "\n")))
  }
}

mock_agents <- list(
  PRICE_HISTORIAN = function(request, context) {
    list(
      total_sessions = 1300L,
      current_price = 190,
      log_return_mean_252d = 0.0004,
      log_return_std_252d = 0.018,
      ma_50 = 185,
      ma_200 = 172,
      price_vs_ma200 = "above",
      regime = "bull",
      raw_returns = rep(0.001, 756)
    )
  },
  VOLATILITY_ENGINE = function(request, context) {
    list(
      realized_vol_10d = 0.22,
      realized_vol_21d = 0.24,
      realized_vol_63d = 0.21,
      realized_vol_252d = 0.28,
      parkinson_vol = 0.19,
      garch_vol_1d_ahead = 0.018,
      vix_current = 18.5,
      vix_percentile_52w = 0.55,
      beta_252d = 1.18,
      vol_regime = "elevated"
    )
  },
  EARNINGS_ANALYST = function(request, context) {
    list(
      earnings_dates = c("2026-02-01", "2025-10-31"),
      post_earnings_returns_1d = c(0.02, -0.01, 0.035),
      mean_reaction = 0.015,
      median_reaction = 0.02,
      pct_positive_reactions = 0.67,
      next_earnings_date = NULL,
      earnings_in_window = FALSE,
      estimated_earnings_move = 0.035,
      eps_surprise_trend = "beat_streak"
    )
  },
  SENTIMENT_SCANNER = function(request, context) {
    list(
      headline_count = 18L,
      net_sentiment_score = 0.21,
      sentiment_trend = "flat",
      last_10k_date = "2025-11-01",
      last_10q_date = "2026-02-01",
      insider_net_direction = "neutral",
      short_interest_ratio = 2.1
    )
  },
  MACRO_PULLER = function(request, context) {
    list(
      fed_funds_rate = 4.5,
      treasury_10y = 4.2,
      treasury_2y = 3.86,
      yield_curve_spread = 0.34,
      cpi_yoy = 0.029,
      unemployment_rate = 4,
      macro_regime = "expansion",
      sector_etf = "XLK",
      sector_vs_spy_3m = 0.04,
      sector_relative_strength = "outperforming",
      fred_pulled_at = "2026-05-13"
    )
  },
  MONTE_CARLO = function(request, context) {
    list(
      paths_run = 10000L,
      probability_up = 0.623,
      p10_return = -0.087,
      p25_return = -0.031,
      p50_return = 0.019,
      p75_return = 0.068,
      p90_return = 0.142,
      expected_return = 0.024,
      median_max_drawdown = -0.063,
      probability_loss_gt_10pct = 0.091,
      probability_gain_gt_20pct = 0.044
    )
  }
)

payload <- stockprob_analyze(
  list(ticker = "aapl", window_days = 30, as_of_date = "2026-05-13", risk_tolerance = "moderate"),
  agents = mock_agents,
  now = as.Date("2026-05-13")
)

assert_equal(payload$ticker, "AAPL", "ticker is normalized")
assert_equal(payload$probability_up, 0.623, "probability comes from Monte Carlo")
assert_equal(payload$confidence_score, 100L, "confidence includes deterministic boosts")
assert_equal(payload$signal_dashboard$risk$vol_regime, "elevated", "risk dashboard maps volatility")
assert_equal(payload$signal_dashboard$trend$regime, "bull", "trend dashboard maps regime")
assert_equal(payload$agent_status$PRICE_HISTORIAN, "ok", "agent status is surfaced")

risky_agents <- mock_agents
risky_agents$VOLATILITY_ENGINE <- function(request, context) {
  data <- mock_agents$VOLATILITY_ENGINE(request, context)
  data$vol_regime <- "crisis"
  data$beta_252d <- 1.35
  data
}
risky_agents$EARNINGS_ANALYST <- function(request, context) {
  data <- mock_agents$EARNINGS_ANALYST(request, context)
  data$next_earnings_date <- "2026-06-01"
  data$earnings_in_window <- TRUE
  data
}
risky_agents$SENTIMENT_SCANNER <- function(request, context) {
  data <- mock_agents$SENTIMENT_SCANNER(request, context)
  data$insider_net_direction <- "selling"
  data$short_interest_ratio <- 8.2
  data
}
risky_agents$MACRO_PULLER <- function(request, context) {
  data <- mock_agents$MACRO_PULLER(request, context)
  data$macro_regime <- "recession"
  data$yield_curve_spread <- -0.42
  data$sector_relative_strength <- "underperforming"
  data$fred_pulled_at <- "2026-05-01"
  data
}

risky_payload <- stockprob_analyze(
  list(ticker = "MSFT", window_days = 300, as_of_date = "2026-05-13", risk_tolerance = "low"),
  agents = risky_agents,
  now = as.Date("2026-05-13")
)

assert_true(risky_payload$confidence_score <= 60L, "long horizons cap confidence")
assert_true(any(grepl("Long horizons", risky_payload$risk_flags)), "long-horizon risk flag exists")
assert_true(any(grepl("Earnings report", risky_payload$risk_flags)), "earnings risk flag exists")
assert_true(any(grepl("Yield curve inverted", risky_payload$risk_flags)), "yield curve flag exists")
assert_true(any(grepl("Short interest elevated", risky_payload$risk_flags)), "short-interest flag exists")
assert_true(any(grepl("Vol regime: crisis", risky_payload$risk_flags)), "crisis vol flag exists")
assert_true(any(grepl("Macro data stale", risky_payload$risk_flags)), "stale macro flag exists")

bad_input <- tryCatch(
  stockprob_validate_request(list(ticker = "", window_days = 0)),
  error = function(error) error
)
assert_true(inherits(bad_input, "error"), "invalid inputs are rejected")

cat("stockprob_engine tests passed\n")
