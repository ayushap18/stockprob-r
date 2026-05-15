# StockProb R Engine
#
# A base-R implementation of the StockProb orchestration contract. The design is
# intentionally modular: each agent can be replaced by a mock, a live provider,
# or a production-grade data connector without changing aggregation semantics.

SP_AGENT_NAMES <- c(
  "PRICE_HISTORIAN",
  "VOLATILITY_ENGINE",
  "EARNINGS_ANALYST",
  "SENTIMENT_SCANNER",
  "MACRO_PULLER",
  "MONTE_CARLO"
)

SP_DEFAULT_PATHS <- 10000L
SP_TRADING_DAYS <- 252

SP_SECTOR_ETFS <- c(
  "technology" = "XLK",
  "financial services" = "XLF",
  "financials" = "XLF",
  "healthcare" = "XLV",
  "consumer cyclical" = "XLY",
  "consumer discretionary" = "XLY",
  "communication services" = "XLC",
  "industrials" = "XLI",
  "consumer defensive" = "XLP",
  "consumer staples" = "XLP",
  "energy" = "XLE",
  "utilities" = "XLU",
  "real estate" = "XLRE",
  "basic materials" = "XLB",
  "materials" = "XLB"
)

stockprob_empty_agent_data <- function(agent_name) {
  switch(
    agent_name,
    PRICE_HISTORIAN = list(
      total_sessions = 0L,
      current_price = NA_real_,
      log_return_mean_252d = NA_real_,
      log_return_std_252d = NA_real_,
      ma_50 = NA_real_,
      ma_200 = NA_real_,
      price_vs_ma200 = NA_character_,
      regime = NA_character_,
      raw_returns = numeric()
    ),
    VOLATILITY_ENGINE = list(
      realized_vol_10d = NA_real_,
      realized_vol_21d = NA_real_,
      realized_vol_63d = NA_real_,
      realized_vol_252d = NA_real_,
      parkinson_vol = NA_real_,
      garch_vol_1d_ahead = NA_real_,
      vix_current = NA_real_,
      vix_percentile_52w = NA_real_,
      beta_252d = NA_real_,
      vol_regime = NA_character_
    ),
    EARNINGS_ANALYST = list(
      earnings_dates = character(),
      post_earnings_returns_1d = numeric(),
      mean_reaction = NA_real_,
      median_reaction = NA_real_,
      pct_positive_reactions = NA_real_,
      next_earnings_date = NULL,
      earnings_in_window = FALSE,
      estimated_earnings_move = NA_real_,
      eps_surprise_trend = "mixed"
    ),
    SENTIMENT_SCANNER = list(
      headline_count = 0L,
      net_sentiment_score = NA_real_,
      sentiment_trend = NA_character_,
      last_10k_date = NULL,
      last_10q_date = NULL,
      insider_net_direction = NA_character_,
      short_interest_ratio = NA_real_
    ),
    MACRO_PULLER = list(
      fed_funds_rate = NA_real_,
      treasury_10y = NA_real_,
      treasury_2y = NA_real_,
      yield_curve_spread = NA_real_,
      cpi_yoy = NA_real_,
      unemployment_rate = NA_real_,
      macro_regime = NA_character_,
      sector_etf = NA_character_,
      sector_vs_spy_3m = NA_real_,
      sector_relative_strength = NA_character_,
      fred_pulled_at = NULL
    ),
    MONTE_CARLO = list(
      paths_run = SP_DEFAULT_PATHS,
      probability_up = NA_real_,
      p10_return = NA_real_,
      p25_return = NA_real_,
      p50_return = NA_real_,
      p75_return = NA_real_,
      p90_return = NA_real_,
      expected_return = NA_real_,
      median_max_drawdown = NA_real_,
      probability_loss_gt_10pct = NA_real_,
      probability_gain_gt_20pct = NA_real_
    ),
    stop(sprintf("Unknown StockProb agent: %s", agent_name), call. = FALSE)
  )
}

stockprob_analyze <- function(input,
                              agents = stockprob_default_agents(),
                              now = Sys.Date(),
                              seed = NULL) {
  request <- stockprob_validate_request(input, now = now)
  if (!is.null(seed)) {
    set.seed(seed)
  }

  outputs <- list()
  statuses <- list()

  price_result <- sp_run_agent("PRICE_HISTORIAN", agents$PRICE_HISTORIAN, request, outputs)
  outputs$PRICE_HISTORIAN <- price_result$data
  statuses$PRICE_HISTORIAN <- price_result$status

  for (agent_name in c("VOLATILITY_ENGINE", "EARNINGS_ANALYST", "SENTIMENT_SCANNER", "MACRO_PULLER")) {
    result <- sp_run_agent(agent_name, agents[[agent_name]], request, outputs)
    outputs[[agent_name]] <- result$data
    statuses[[agent_name]] <- result$status
  }

  mc_result <- sp_run_agent("MONTE_CARLO", agents$MONTE_CARLO, request, outputs)
  outputs$MONTE_CARLO <- mc_result$data
  statuses$MONTE_CARLO <- mc_result$status

  stockprob_assemble_payload(request, outputs, statuses, now = now)
}

stockprob_validate_request <- function(input, now = Sys.Date()) {
  if (is.null(input) || !is.list(input)) {
    stop("StockProb request must be a list", call. = FALSE)
  }

  ticker <- toupper(trimws(sp_scalar_character(input$ticker, "")))
  if (!nzchar(ticker)) {
    stop("ticker is required", call. = FALSE)
  }
  if (!grepl("^[A-Z0-9.^-]{1,16}$", ticker)) {
    stop("ticker can only include letters, numbers, dot, caret, or hyphen", call. = FALSE)
  }

  window_days <- sp_scalar_integer(input$window_days, 30L)
  if (is.na(window_days) || window_days < 1L || window_days > 756L) {
    stop("window_days must be an integer between 1 and 756", call. = FALSE)
  }

  as_of_date <- sp_scalar_character(input$as_of_date, format(as.Date(now), "%Y-%m-%d"))
  if (!grepl("^\\d{4}-\\d{2}-\\d{2}$", as_of_date)) {
    stop("as_of_date must be YYYY-MM-DD", call. = FALSE)
  }
  parsed_date <- suppressWarnings(as.Date(as_of_date))
  if (is.na(parsed_date)) {
    stop("as_of_date is not a valid calendar date", call. = FALSE)
  }

  risk_tolerance <- tolower(sp_scalar_character(input$risk_tolerance, "moderate"))
  if (!risk_tolerance %in% c("low", "moderate", "high")) {
    stop("risk_tolerance must be low, moderate, or high", call. = FALSE)
  }

  list(
    ticker = ticker,
    window_days = as.integer(window_days),
    as_of_date = format(parsed_date, "%Y-%m-%d"),
    risk_tolerance = risk_tolerance
  )
}

stockprob_default_agents <- function(providers = stockprob_default_providers()) {
  list(
    PRICE_HISTORIAN = function(request, context) sp_price_historian_agent(request, providers),
    VOLATILITY_ENGINE = function(request, context) sp_volatility_engine_agent(request, providers),
    EARNINGS_ANALYST = function(request, context) sp_earnings_analyst_agent(request, providers),
    SENTIMENT_SCANNER = function(request, context) sp_sentiment_scanner_agent(request, providers),
    MACRO_PULLER = function(request, context) sp_macro_puller_agent(request, providers),
    MONTE_CARLO = function(request, context) sp_monte_carlo_agent(request, context)
  )
}

stockprob_default_providers <- function() {
  list(
    fetch_ohlcv = function(ticker, as_of_date) sp_fetch_ohlcv(ticker, as_of_date),
    fetch_quote_summary = function(ticker, modules) sp_fetch_quote_summary(ticker, modules),
    fetch_news_sentiment = function(ticker, as_of_date) sp_fetch_news_sentiment(ticker, as_of_date),
    fetch_sec_company_facts = function(ticker) sp_fetch_sec_company_facts(ticker),
    fetch_fred_series = function(series_id, as_of_date) sp_fetch_fred_series(series_id, as_of_date)
  )
}

stockprob_assemble_payload <- function(request, outputs, statuses, now = Sys.Date()) {
  price <- sp_list_merge(stockprob_empty_agent_data("PRICE_HISTORIAN"), outputs$PRICE_HISTORIAN)
  vol <- sp_list_merge(stockprob_empty_agent_data("VOLATILITY_ENGINE"), outputs$VOLATILITY_ENGINE)
  earnings <- sp_list_merge(stockprob_empty_agent_data("EARNINGS_ANALYST"), outputs$EARNINGS_ANALYST)
  sentiment <- sp_list_merge(stockprob_empty_agent_data("SENTIMENT_SCANNER"), outputs$SENTIMENT_SCANNER)
  macro <- sp_list_merge(stockprob_empty_agent_data("MACRO_PULLER"), outputs$MACRO_PULLER)
  monte_carlo <- sp_list_merge(stockprob_empty_agent_data("MONTE_CARLO"), outputs$MONTE_CARLO)

  list(
    ticker = request$ticker,
    as_of_date = request$as_of_date,
    window_days = request$window_days,
    probability_up = sp_round_or_null(monte_carlo$probability_up, 3),
    confidence_score = sp_confidence_score(request, price, vol, earnings, sentiment, macro, statuses),
    signal_dashboard = list(
      risk = list(
        vol_regime = sp_null_if_missing(vol$vol_regime),
        beta = sp_round_or_null(vol$beta_252d, 2)
      ),
      trend = list(
        regime = sp_null_if_missing(price$regime),
        vs_ma200 = sp_null_if_missing(price$price_vs_ma200)
      ),
      earnings = list(
        in_window = isTRUE(earnings$earnings_in_window),
        trend = sp_null_if_missing(earnings$eps_surprise_trend)
      ),
      sentiment = list(
        score = sp_round_or_null(sentiment$net_sentiment_score, 3),
        insiders = sp_null_if_missing(sentiment$insider_net_direction)
      ),
      macro = list(
        regime = sp_null_if_missing(macro$macro_regime),
        yield_curve = sp_round_or_null(macro$yield_curve_spread, 2)
      )
    ),
    monte_carlo = list(
      paths = sp_scalar_integer(monte_carlo$paths_run, SP_DEFAULT_PATHS),
      p10 = sp_round_or_null(monte_carlo$p10_return, 3),
      p25 = sp_round_or_null(monte_carlo$p25_return, 3),
      p50 = sp_round_or_null(monte_carlo$p50_return, 3),
      p75 = sp_round_or_null(monte_carlo$p75_return, 3),
      p90 = sp_round_or_null(monte_carlo$p90_return, 3),
      prob_loss_gt_10pct = sp_round_or_null(monte_carlo$probability_loss_gt_10pct, 3),
      prob_gain_gt_20pct = sp_round_or_null(monte_carlo$probability_gain_gt_20pct, 3),
      median_max_drawdown = sp_round_or_null(monte_carlo$median_max_drawdown, 3)
    ),
    risk_flags = sp_risk_flags(request, vol, earnings, sentiment, macro, statuses, now = now),
    agent_status = sp_named_agent_status(statuses),
    disclaimer = "This is math. Not advice. Past distributions do not guarantee future outcomes."
  )
}

stockprob_to_json <- function(payload, pretty = FALSE) {
  if (requireNamespace("jsonlite", quietly = TRUE)) {
    return(jsonlite::toJSON(payload, auto_unbox = TRUE, null = "null", na = "null", pretty = pretty))
  }
  sp_to_json_base(payload, pretty = pretty)
}

sp_run_agent <- function(agent_name, agent_fn, request, outputs) {
  if (!is.function(agent_fn)) {
    return(list(status = "failed", data = stockprob_empty_agent_data(agent_name)))
  }

  result <- tryCatch(
    agent_fn(request, outputs),
    error = function(error) {
      structure(list(message = conditionMessage(error)), class = "stockprob_agent_error")
    }
  )

  if (inherits(result, "stockprob_agent_error")) {
    return(list(status = "failed", data = stockprob_empty_agent_data(agent_name)))
  }

  unwrapped <- sp_unwrap_agent_result(agent_name, result)
  list(
    status = unwrapped$status,
    data = sp_list_merge(stockprob_empty_agent_data(agent_name), unwrapped$data)
  )
}

sp_unwrap_agent_result <- function(agent_name, result) {
  if (!is.list(result)) {
    return(list(status = "failed", data = list()))
  }
  if (!is.null(result$data) && !is.null(result$status)) {
    return(list(status = result$status, data = result$data))
  }
  list(status = sp_infer_agent_status(agent_name, result), data = result)
}

sp_infer_agent_status <- function(agent_name, data) {
  if (!is.list(data)) {
    return("failed")
  }
  if (identical(agent_name, "PRICE_HISTORIAN") && sp_missing_number(data$current_price)) {
    return("failed")
  }
  if (identical(agent_name, "MONTE_CARLO") && sp_missing_number(data$probability_up)) {
    return("failed")
  }
  "ok"
}

sp_named_agent_status <- function(statuses) {
  out <- list()
  for (agent_name in SP_AGENT_NAMES) {
    status <- statuses[[agent_name]]
    if (is.null(status) || !nzchar(status)) {
      status <- "failed"
    }
    out[[agent_name]] <- status
  }
  out
}

sp_confidence_score <- function(request, price, vol, earnings, sentiment, macro, statuses) {
  score <- 80

  if (sp_scalar_integer(price$total_sessions, 0L) < 252L) {
    score <- score - 20
  }
  if (sp_scalar_integer(price$total_sessions, 0L) > 1000L) {
    score <- score + 10
  }
  if (isTRUE(earnings$earnings_in_window)) {
    score <- score - 10
  }
  if (identical(sp_scalar_character(vol$vol_regime, ""), "crisis")) {
    score <- score - 15
  }
  if (identical(sp_scalar_character(macro$macro_regime, ""), "recession")) {
    score <- score - 10
  }
  if (!sp_missing_number(sentiment$net_sentiment_score) && sentiment$net_sentiment_score < -0.5) {
    score <- score - 5
  }
  if (identical(sp_scalar_character(earnings$eps_surprise_trend, ""), "beat_streak")) {
    score <- score + 10
  }
  if (identical(sp_scalar_character(macro$sector_relative_strength, ""), "outperforming")) {
    score <- score + 5
  }
  if (identical(sp_scalar_character(sentiment$insider_net_direction, ""), "buying")) {
    score <- score + 5
  }

  for (status in unlist(statuses, use.names = FALSE)) {
    if (identical(status, "failed")) {
      score <- score - 20
    } else if (identical(status, "degraded")) {
      score <- score - 10
    }
  }

  if (request$window_days > 252L) {
    score <- min(score, 60)
  }
  as.integer(sp_clamp(round(score), 0, 100))
}

sp_risk_flags <- function(request, vol, earnings, sentiment, macro, statuses, now = Sys.Date()) {
  flags <- character()

  if (request$window_days > 252L) {
    flags <- c(flags, "Long horizons have compounding uncertainty. Confidence score capped at 60.")
  }
  if (isTRUE(earnings$earnings_in_window)) {
    flags <- c(flags, "Earnings report falls within your window. Expect fat tails.")
  }
  if (!sp_missing_number(macro$yield_curve_spread) && macro$yield_curve_spread < 0) {
    flags <- c(flags, "Yield curve inverted. Historically precedes contraction.")
  }
  if (!sp_missing_number(sentiment$short_interest_ratio) && sentiment$short_interest_ratio >= 5) {
    flags <- c(flags, "Short interest elevated. Squeeze risk or informed selling.")
  }
  if (identical(sp_scalar_character(vol$vol_regime, ""), "crisis")) {
    flags <- c(flags, "Vol regime: crisis. Simulation width is wide.")
  } else if (identical(sp_scalar_character(vol$vol_regime, ""), "elevated")) {
    flags <- c(flags, "Vol regime elevated. Widen your expected range.")
  }
  if (identical(sp_scalar_character(sentiment$insider_net_direction, ""), "selling")) {
    flags <- c(flags, "Insider net selling in last 90 days.")
  }
  if (!sp_missing_number(vol$beta_252d) && vol$beta_252d > 1.1) {
    flags <- c(flags, sprintf("Beta %.2f - moves harder than the market in both directions.", vol$beta_252d))
  }
  if (!is.null(macro$fred_pulled_at) && !is.na(macro$fred_pulled_at)) {
    age <- as.integer(as.Date(now) - as.Date(macro$fred_pulled_at))
    if (!is.na(age) && age > 7L) {
      flags <- c(flags, "Macro data stale. Refresh before trading.")
    }
  }
  for (agent_name in names(statuses)) {
    status <- statuses[[agent_name]]
    if (identical(status, "degraded")) {
      flags <- c(flags, sprintf("%s degraded. Missing source fields reduced confidence.", agent_name))
    } else if (identical(status, "failed")) {
      flags <- c(flags, sprintf("%s failed. Null fields reduced confidence.", agent_name))
    }
  }

  unique(flags)
}

sp_price_historian_agent <- function(request, providers) {
  rows <- providers$fetch_ohlcv(request$ticker, request$as_of_date)
  rows <- sp_clean_ohlcv(rows, request$as_of_date)
  if (nrow(rows) < 2L) {
    return(list(status = "failed", data = stockprob_empty_agent_data("PRICE_HISTORIAN")))
  }

  returns <- sp_log_returns(rows$close)
  current_price <- tail(rows$close, 1)
  ma_50 <- sp_moving_average(rows$close, 50L)
  ma_200 <- sp_moving_average(rows$close, 200L)
  latest_returns <- tail(returns, 252L)
  price_vs_ma200 <- if (sp_missing_number(ma_200)) NA_character_ else if (current_price >= ma_200) "above" else "below"
  regime <- sp_market_regime(current_price, ma_50, ma_200)

  list(
    status = if (nrow(rows) < 252L) "degraded" else "ok",
    data = list(
      total_sessions = as.integer(nrow(rows)),
      current_price = current_price,
      log_return_mean_252d = sp_mean(latest_returns),
      log_return_std_252d = sp_sample_sd(latest_returns),
      ma_50 = ma_50,
      ma_200 = ma_200,
      price_vs_ma200 = price_vs_ma200,
      regime = regime,
      raw_returns = tail(returns, 756L)
    )
  )
}

sp_volatility_engine_agent <- function(request, providers) {
  rows <- sp_clean_ohlcv(providers$fetch_ohlcv(request$ticker, request$as_of_date), request$as_of_date)
  spy_rows <- sp_clean_ohlcv(providers$fetch_ohlcv("SPY", request$as_of_date), request$as_of_date)
  vix_rows <- sp_clean_ohlcv(providers$fetch_ohlcv("^VIX", request$as_of_date), request$as_of_date)

  if (nrow(rows) < 22L) {
    return(list(status = "failed", data = stockprob_empty_agent_data("VOLATILITY_ENGINE")))
  }

  returns <- sp_log_returns(rows$close)
  vix_values <- vix_rows$close[is.finite(vix_rows$close)]
  vix_current <- if (length(vix_values)) tail(vix_values, 1) else NA_real_
  vix_52w <- tail(vix_values, 252L)
  data <- list(
    realized_vol_10d = sp_annualized_vol(returns, 10L),
    realized_vol_21d = sp_annualized_vol(returns, 21L),
    realized_vol_63d = sp_annualized_vol(returns, 63L),
    realized_vol_252d = sp_annualized_vol(returns, 252L),
    parkinson_vol = sp_parkinson_vol(tail(rows, 252L)),
    garch_vol_1d_ahead = if (nrow(rows) > 500L) sp_garch_daily_vol(returns) else NA_real_,
    vix_current = vix_current,
    vix_percentile_52w = if (!sp_missing_number(vix_current) && length(vix_52w)) sp_percentile_rank(vix_52w, vix_current) else NA_real_,
    beta_252d = sp_beta_vs_benchmark(rows, spy_rows, 252L),
    vol_regime = NA_character_
  )
  data$vol_regime <- sp_classify_vol_regime(data)
  status <- if (sp_any_missing_core(data, c("realized_vol_21d", "beta_252d", "vix_current"))) "degraded" else "ok"
  list(status = status, data = data)
}

sp_earnings_analyst_agent <- function(request, providers) {
  summary <- providers$fetch_quote_summary(request$ticker, c("calendarEvents", "earningsHistory"))
  rows <- sp_clean_ohlcv(providers$fetch_ohlcv(request$ticker, request$as_of_date), request$as_of_date)

  history <- sp_extract_earnings_history(summary)
  earnings_dates <- head(history$dates, 12L)
  surprise_values <- head(history$surprises, 3L)
  post_returns <- vapply(earnings_dates, function(date) sp_post_event_return(rows, date), numeric(1))
  post_returns <- post_returns[is.finite(post_returns)]
  next_date <- sp_extract_next_earnings_date(summary)
  days_until <- if (is.null(next_date)) NA_integer_ else as.integer(as.Date(next_date) - as.Date(request$as_of_date))
  earnings_in_window <- !is.na(days_until) && days_until >= 0L && days_until <= request$window_days

  data <- list(
    earnings_dates = earnings_dates,
    post_earnings_returns_1d = post_returns,
    mean_reaction = sp_mean(post_returns),
    median_reaction = sp_median(post_returns),
    pct_positive_reactions = if (length(post_returns)) mean(post_returns > 0) else NA_real_,
    next_earnings_date = next_date,
    earnings_in_window = earnings_in_window,
    estimated_earnings_move = if (length(post_returns)) mean(abs(post_returns)) else sp_fallback_earnings_move(rows),
    eps_surprise_trend = sp_eps_surprise_trend(surprise_values)
  )
  status <- if (length(earnings_dates) && length(post_returns)) "ok" else "degraded"
  list(status = status, data = data)
}

sp_sentiment_scanner_agent <- function(request, providers) {
  news <- providers$fetch_news_sentiment(request$ticker, request$as_of_date)
  sec <- providers$fetch_sec_company_facts(request$ticker)

  scores <- numeric()
  if (is.data.frame(news) && "score" %in% names(news)) {
    scores <- news$score[news$score %in% c(-1, 0, 1)]
  } else if (is.list(news) && length(news)) {
    scores <- unlist(lapply(news, function(item) item$score), use.names = FALSE)
    scores <- scores[scores %in% c(-1, 0, 1)]
  }
  positives <- sum(scores > 0)
  negatives <- sum(scores < 0)
  half <- ceiling(length(scores) / 2)
  older <- if (length(scores)) scores[seq_len(half)] else numeric()
  newer <- if (length(scores) > half) scores[(half + 1):length(scores)] else numeric()

  data <- list(
    headline_count = as.integer(length(scores)),
    net_sentiment_score = if (length(scores)) (positives - negatives) / length(scores) else NA_real_,
    sentiment_trend = if (length(scores) >= 6L) sp_sentiment_trend(older, newer) else NA_character_,
    last_10k_date = sec$last_10k_date %||% NULL,
    last_10q_date = sec$last_10q_date %||% NULL,
    insider_net_direction = sec$insider_net_direction %||% NA_character_,
    short_interest_ratio = sec$short_interest_ratio %||% NA_real_
  )
  status <- if (length(scores) || !is.null(data$last_10k_date) || !is.null(data$last_10q_date)) "degraded" else "failed"
  list(status = status, data = data)
}

sp_macro_puller_agent <- function(request, providers) {
  fed_funds <- providers$fetch_fred_series("FEDFUNDS", request$as_of_date)
  ten_year <- providers$fetch_fred_series("DGS10", request$as_of_date)
  two_year <- providers$fetch_fred_series("DGS2", request$as_of_date)
  cpi <- providers$fetch_fred_series("CPIAUCSL", request$as_of_date)
  unemployment <- providers$fetch_fred_series("UNRATE", request$as_of_date)
  pmi <- providers$fetch_fred_series("NAPM", request$as_of_date)
  profile <- providers$fetch_quote_summary(request$ticker, c("assetProfile"))

  ten <- sp_last_observation(ten_year)
  two <- sp_last_observation(two_year)
  cpi_latest <- sp_last_observation(cpi)
  cpi_year_ago <- sp_observation_months_ago(cpi, cpi_latest$date %||% NULL, 12L)
  sector <- profile$assetProfile$sector %||% NA_character_
  sector_etf <- sp_sector_etf_for(sector)
  sector_vs_spy <- if (!is.na(sector_etf)) sp_sector_vs_spy_return(providers, sector_etf, request$as_of_date) else NA_real_
  spread <- if (!sp_missing_number(ten$value) && !sp_missing_number(two$value)) ten$value - two$value else NA_real_
  pulled_at <- sp_latest_series_date(list(fed_funds, ten_year, two_year, cpi, unemployment, pmi))

  data <- list(
    fed_funds_rate = sp_last_observation(fed_funds)$value %||% NA_real_,
    treasury_10y = ten$value %||% NA_real_,
    treasury_2y = two$value %||% NA_real_,
    yield_curve_spread = spread,
    cpi_yoy = if (!sp_missing_number(cpi_latest$value) && !sp_missing_number(cpi_year_ago$value)) cpi_latest$value / cpi_year_ago$value - 1 else NA_real_,
    unemployment_rate = sp_last_observation(unemployment)$value %||% NA_real_,
    macro_regime = sp_classify_macro_regime(ten_year, two_year, cpi, unemployment, pmi),
    sector_etf = sector_etf,
    sector_vs_spy_3m = sector_vs_spy,
    sector_relative_strength = sp_sector_strength(sector_vs_spy),
    fred_pulled_at = pulled_at
  )
  status <- if (!is.na(data$macro_regime) && !is.null(data$fred_pulled_at)) {
    if (is.na(data$sector_etf)) "degraded" else "ok"
  } else {
    "failed"
  }
  list(status = status, data = data)
}

sp_monte_carlo_agent <- function(request, context) {
  price <- sp_list_merge(stockprob_empty_agent_data("PRICE_HISTORIAN"), context$PRICE_HISTORIAN)
  vol <- sp_list_merge(stockprob_empty_agent_data("VOLATILITY_ENGINE"), context$VOLATILITY_ENGINE)
  earnings <- sp_list_merge(stockprob_empty_agent_data("EARNINGS_ANALYST"), context$EARNINGS_ANALYST)
  sentiment <- sp_list_merge(stockprob_empty_agent_data("SENTIMENT_SCANNER"), context$SENTIMENT_SCANNER)
  macro <- sp_list_merge(stockprob_empty_agent_data("MACRO_PULLER"), context$MACRO_PULLER)

  if (sp_missing_number(price$current_price) || !length(price$raw_returns)) {
    return(list(status = "failed", data = stockprob_empty_agent_data("MONTE_CARLO")))
  }

  base_drift <- if (!sp_missing_number(price$log_return_mean_252d)) price$log_return_mean_252d else sp_mean(price$raw_returns)
  drift <- sp_adjusted_daily_drift(base_drift, sentiment, macro)
  sigma <- sp_daily_simulation_vol(price, vol)
  if (sp_missing_number(drift) || sp_missing_number(sigma) || sigma <= 0) {
    return(list(status = "failed", data = stockprob_empty_agent_data("MONTE_CARLO")))
  }

  returns <- numeric(SP_DEFAULT_PATHS)
  drawdowns <- numeric(SP_DEFAULT_PATHS)
  shock_day <- NULL
  if (isTRUE(earnings$earnings_in_window)) {
    days_until <- if (is.null(earnings$next_earnings_date)) NA_integer_ else as.integer(as.Date(earnings$next_earnings_date) - as.Date(request$as_of_date))
    shock_day <- if (is.na(days_until)) ceiling(request$window_days / 2) else max(1L, min(request$window_days, days_until))
  }

  for (path_index in seq_len(SP_DEFAULT_PATHS)) {
    path_price <- price$current_price
    peak <- path_price
    max_drawdown <- 0

    for (day in seq_len(request$window_days)) {
      daily_return <- drift + sigma * rnorm(1)
      if (!is.null(shock_day) && day == shock_day) {
        daily_return <- daily_return + sp_sample_earnings_shock(earnings$post_earnings_returns_1d, earnings$estimated_earnings_move)
      }
      path_price <- path_price * exp(daily_return)
      peak <- max(peak, path_price)
      max_drawdown <- min(max_drawdown, path_price / peak - 1)
    }

    returns[path_index] <- path_price / price$current_price - 1
    drawdowns[path_index] <- max_drawdown
  }

  sorted_returns <- sort(returns)
  list(
    status = "ok",
    data = list(
      paths_run = SP_DEFAULT_PATHS,
      probability_up = mean(returns > 0),
      p10_return = unname(stats::quantile(sorted_returns, 0.10, names = FALSE, type = 7)),
      p25_return = unname(stats::quantile(sorted_returns, 0.25, names = FALSE, type = 7)),
      p50_return = unname(stats::quantile(sorted_returns, 0.50, names = FALSE, type = 7)),
      p75_return = unname(stats::quantile(sorted_returns, 0.75, names = FALSE, type = 7)),
      p90_return = unname(stats::quantile(sorted_returns, 0.90, names = FALSE, type = 7)),
      expected_return = mean(returns),
      median_max_drawdown = stats::median(drawdowns),
      probability_loss_gt_10pct = mean(returns < -0.10),
      probability_gain_gt_20pct = mean(returns > 0.20)
    )
  )
}

sp_fetch_ohlcv <- function(ticker, as_of_date) {
  polygon_key <- Sys.getenv("POLYGON_API_KEY", unset = "")
  if (nzchar(polygon_key)) {
    polygon_rows <- sp_fetch_polygon_ohlcv(ticker, as_of_date, polygon_key)
    if (nrow(polygon_rows)) {
      return(polygon_rows)
    }
  }
  sp_fetch_yahoo_chart_ohlcv(ticker, as_of_date)
}

sp_fetch_polygon_ohlcv <- function(ticker, as_of_date, api_key) {
  if (!requireNamespace("jsonlite", quietly = TRUE)) {
    return(sp_empty_ohlcv())
  }
  url <- sprintf(
    "https://api.polygon.io/v2/aggs/ticker/%s/range/1/day/1900-01-01/%s?adjusted=true&sort=asc&limit=50000&apiKey=%s",
    utils::URLencode(ticker, reserved = TRUE),
    as_of_date,
    utils::URLencode(api_key, reserved = TRUE)
  )
  data <- sp_json_from_url(url)
  results <- data$results
  if (is.null(results) || !length(results)) {
    return(sp_empty_ohlcv())
  }
  values <- function(field) {
    as.numeric(unlist(lapply(results, function(item) item[[field]]), use.names = FALSE))
  }
  rows <- data.frame(
    date = as.Date(as.POSIXct(values("t") / 1000, origin = "1970-01-01", tz = "UTC")),
    open = values("o"),
    high = values("h"),
    low = values("l"),
    close = values("c"),
    volume = values("v")
  )
  sp_clean_ohlcv(rows, as_of_date)
}

sp_fetch_yahoo_chart_ohlcv <- function(ticker, as_of_date) {
  if (!requireNamespace("jsonlite", quietly = TRUE)) {
    return(sp_empty_ohlcv())
  }
  normalized <- if (identical(ticker, "^VIX")) "%5EVIX" else utils::URLencode(ticker, reserved = TRUE)
  period2 <- as.integer(as.POSIXct(as.Date(as_of_date) + 1, tz = "UTC"))
  url <- sprintf(
    "https://query1.finance.yahoo.com/v8/finance/chart/%s?period1=0&period2=%s&interval=1d&events=history&includeAdjustedClose=true",
    normalized,
    period2
  )
  data <- sp_json_from_url(url)
  result <- data$chart$result[[1]]
  if (is.null(result$timestamp)) {
    return(sp_empty_ohlcv())
  }
  quote <- result$indicators$quote[[1]]
  adjusted <- result$indicators$adjclose[[1]]$adjclose
  close <- if (!is.null(adjusted)) adjusted else quote$close
  rows <- data.frame(
    date = as.Date(as.POSIXct(unlist(result$timestamp), origin = "1970-01-01", tz = "UTC")),
    open = as.numeric(unlist(quote$open)),
    high = as.numeric(unlist(quote$high)),
    low = as.numeric(unlist(quote$low)),
    close = as.numeric(unlist(close)),
    volume = as.numeric(unlist(quote$volume))
  )
  sp_clean_ohlcv(rows, as_of_date)
}

sp_fetch_quote_summary <- function(ticker, modules) {
  if (!requireNamespace("jsonlite", quietly = TRUE) || !length(modules)) {
    return(list())
  }
  url <- sprintf(
    "https://query2.finance.yahoo.com/v10/finance/quoteSummary/%s?modules=%s",
    utils::URLencode(ticker, reserved = TRUE),
    paste(modules, collapse = ",")
  )
  data <- sp_json_from_url(url)
  result <- data$quoteSummary$result
  if (is.null(result) || !length(result)) {
    return(list())
  }
  result[[1]]
}

sp_fetch_news_sentiment <- function(ticker, as_of_date) {
  api_key <- Sys.getenv("ALPHA_VANTAGE_API_KEY", unset = "")
  if (!nzchar(api_key) || !requireNamespace("jsonlite", quietly = TRUE)) {
    return(data.frame(title = character(), score = numeric()))
  }
  from_date <- format(as.Date(as_of_date) - 30, "%Y%m%d")
  url <- sprintf(
    "https://www.alphavantage.co/query?function=NEWS_SENTIMENT&tickers=%s&time_from=%sT0000&sort=LATEST&limit=50&apikey=%s",
    utils::URLencode(ticker, reserved = TRUE),
    from_date,
    utils::URLencode(api_key, reserved = TRUE)
  )
  data <- sp_json_from_url(url)
  feed <- data$feed
  if (is.null(feed) || !length(feed)) {
    return(data.frame(title = character(), score = numeric()))
  }
  rows <- lapply(feed, function(item) {
    raw_score <- suppressWarnings(as.numeric(item$overall_sentiment_score %||% NA_real_))
    ticker_sentiment <- item$ticker_sentiment
    if (!is.null(ticker_sentiment) && length(ticker_sentiment)) {
      for (entry in ticker_sentiment) {
        if (identical(toupper(entry$ticker), toupper(ticker))) {
          raw_score <- suppressWarnings(as.numeric(entry$ticker_sentiment_score))
          break
        }
      }
    }
    score <- if (is.na(raw_score)) 0 else if (raw_score > 0.15) 1 else if (raw_score < -0.15) -1 else 0
    data.frame(title = item$title %||% "", score = score)
  })
  do.call(rbind, rows)
}

sp_fetch_sec_company_facts <- function(ticker) {
  user_agent <- Sys.getenv("SEC_USER_AGENT", unset = "")
  if (!nzchar(user_agent) || !requireNamespace("jsonlite", quietly = TRUE)) {
    return(list())
  }
  tickers <- sp_json_from_url(
    "https://www.sec.gov/files/company_tickers.json",
    headers = c("User-Agent" = user_agent)
  )
  if (!length(tickers)) {
    return(list())
  }
  matches <- Filter(function(entry) identical(toupper(entry$ticker), toupper(ticker)), tickers)
  if (!length(matches)) {
    return(list())
  }
  cik <- sprintf("%010d", as.integer(matches[[1]]$cik_str))
  submission <- sp_json_from_url(
    sprintf("https://data.sec.gov/submissions/CIK%s.json", cik),
    headers = c("User-Agent" = user_agent)
  )
  forms <- submission$filings$recent$form
  dates <- submission$filings$recent$filingDate
  if (is.null(forms) || is.null(dates)) {
    return(list())
  }
  last_form_date <- function(form) {
    index <- match(form, forms)
    if (is.na(index)) NULL else dates[[index]]
  }
  form4_count <- sum(forms == "4", na.rm = TRUE)
  list(
    last_10k_date = last_form_date("10-K"),
    last_10q_date = last_form_date("10-Q"),
    insider_net_direction = if (form4_count > 0) "neutral" else NA_character_,
    short_interest_ratio = NA_real_
  )
}

sp_fetch_fred_series <- function(series_id, as_of_date) {
  url <- sprintf("https://fred.stlouisfed.org/graph/fredgraph.csv?id=%s", utils::URLencode(series_id, reserved = TRUE))
  out <- tryCatch(
    {
      rows <- utils::read.csv(url, stringsAsFactors = FALSE)
      names(rows) <- c("date", "value")
      rows$date <- as.Date(rows$date)
      rows$value <- suppressWarnings(as.numeric(rows$value))
      rows <- rows[!is.na(rows$date) & is.finite(rows$value) & rows$date <= as.Date(as_of_date), , drop = FALSE]
      rows[order(rows$date), , drop = FALSE]
    },
    error = function(error) data.frame(date = as.Date(character()), value = numeric())
  )
  out
}

sp_json_from_url <- function(url, headers = character()) {
  if (!requireNamespace("jsonlite", quietly = TRUE)) {
    return(list())
  }
  tryCatch(
    {
      if (length(headers)) {
        handle <- base::url(url, open = "rb", headers = headers)
        on.exit(close(handle), add = TRUE)
        text <- paste(readLines(handle, warn = FALSE), collapse = "\n")
        jsonlite::fromJSON(text, simplifyVector = FALSE)
      } else {
        jsonlite::fromJSON(url, simplifyVector = FALSE)
      }
    },
    error = function(error) list()
  )
}

sp_empty_ohlcv <- function() {
  data.frame(
    date = as.Date(character()),
    open = numeric(),
    high = numeric(),
    low = numeric(),
    close = numeric(),
    volume = numeric()
  )
}

sp_clean_ohlcv <- function(rows, as_of_date) {
  if (!is.data.frame(rows) || !nrow(rows)) {
    return(sp_empty_ohlcv())
  }
  required <- c("date", "open", "high", "low", "close", "volume")
  for (name in setdiff(required, names(rows))) {
    rows[[name]] <- if (identical(name, "date")) as.Date(NA) else NA_real_
  }
  rows <- rows[required]
  rows$date <- as.Date(rows$date)
  for (name in setdiff(required, "date")) {
    rows[[name]] <- suppressWarnings(as.numeric(rows[[name]]))
  }
  rows <- rows[!is.na(rows$date) & rows$date <= as.Date(as_of_date) & is.finite(rows$close) & is.finite(rows$high) & is.finite(rows$low), , drop = FALSE]
  rows <- rows[order(rows$date), , drop = FALSE]
  row.names(rows) <- NULL
  rows
}

sp_log_returns <- function(prices) {
  prices <- as.numeric(prices)
  if (length(prices) < 2L) {
    return(numeric())
  }
  previous <- head(prices, -1L)
  current <- tail(prices, -1L)
  valid <- is.finite(previous) & is.finite(current) & previous > 0 & current > 0
  log(current[valid] / previous[valid])
}

sp_moving_average <- function(values, window) {
  values <- as.numeric(values)
  if (length(values) < window) {
    return(NA_real_)
  }
  sp_mean(tail(values, window))
}

sp_market_regime <- function(current_price, ma_50, ma_200) {
  if (sp_missing_number(current_price) || sp_missing_number(ma_50) || sp_missing_number(ma_200)) {
    return("transitional")
  }
  if (current_price >= ma_200 && ma_50 >= ma_200) {
    return("bull")
  }
  if (current_price < ma_200 && ma_50 < ma_200) {
    return("bear")
  }
  "transitional"
}

sp_annualized_vol <- function(returns, window) {
  sample <- tail(as.numeric(returns), window)
  if (length(sample) < min(window, 2L)) {
    return(NA_real_)
  }
  sp_sample_sd(sample) * sqrt(SP_TRADING_DAYS)
}

sp_parkinson_vol <- function(rows) {
  if (!is.data.frame(rows) || !nrow(rows)) {
    return(NA_real_)
  }
  valid <- is.finite(rows$high) & is.finite(rows$low) & rows$high > 0 & rows$low > 0
  if (!any(valid)) {
    return(NA_real_)
  }
  variance <- mean(log(rows$high[valid] / rows$low[valid])^2) / (4 * log(2))
  sqrt(variance * SP_TRADING_DAYS)
}

sp_garch_daily_vol <- function(returns) {
  returns <- as.numeric(returns)
  returns <- returns[is.finite(returns)]
  if (length(returns) < 500L) {
    return(NA_real_)
  }
  variance <- sp_sample_sd(tail(returns, 252L))^2
  alpha <- 0.05
  beta <- 0.90
  omega <- max(variance * (1 - alpha - beta), 0)
  conditional_variance <- variance
  for (value in tail(returns, 500L)) {
    conditional_variance <- omega + alpha * value^2 + beta * conditional_variance
  }
  sqrt(conditional_variance)
}

sp_beta_vs_benchmark <- function(rows, benchmark_rows, window) {
  asset_returns <- sp_returns_by_date(rows)
  market_returns <- sp_returns_by_date(benchmark_rows)
  if (!nrow(asset_returns) || !nrow(market_returns)) {
    return(NA_real_)
  }
  asset_returns <- tail(asset_returns, window)
  paired <- merge(asset_returns, market_returns, by = "date", suffixes = c("_asset", "_market"))
  if (nrow(paired) < 30L) {
    return(NA_real_)
  }
  variance <- stats::var(paired$return_market)
  if (!is.finite(variance) || variance == 0) {
    return(NA_real_)
  }
  stats::cov(paired$return_asset, paired$return_market) / variance
}

sp_returns_by_date <- function(rows) {
  if (!is.data.frame(rows) || nrow(rows) < 2L) {
    return(data.frame(date = as.Date(character()), return = numeric()))
  }
  returns <- sp_log_returns(rows$close)
  dates <- rows$date[-1L]
  length_min <- min(length(dates), length(returns))
  data.frame(date = tail(dates, length_min), return = tail(returns, length_min))
}

sp_classify_vol_regime <- function(data) {
  vix <- data$vix_current
  rv21 <- data$realized_vol_21d
  vix_pct <- data$vix_percentile_52w
  if ((!sp_missing_number(vix) && vix >= 30) || (!sp_missing_number(rv21) && rv21 >= 0.45)) {
    return("crisis")
  }
  if ((!sp_missing_number(vix) && vix >= 20) || (!sp_missing_number(rv21) && rv21 >= 0.25) || (!sp_missing_number(vix_pct) && vix_pct >= 0.7)) {
    return("elevated")
  }
  "low"
}

sp_extract_earnings_history <- function(summary) {
  if (is.null(summary$earningsHistory$history)) {
    return(list(dates = character(), surprises = numeric()))
  }
  history <- summary$earningsHistory$history
  dates <- character()
  surprises <- numeric()
  for (item in history) {
    date <- sp_yahoo_date(item$quarter)
    if (!is.null(date)) {
      dates <- c(dates, date)
    }
    surprise <- sp_yahoo_number(item$surprisePercent)
    if (is.finite(surprise)) {
      surprises <- c(surprises, surprise)
    }
  }
  list(dates = dates, surprises = surprises)
}

sp_yahoo_date <- function(value) {
  if (is.null(value)) {
    return(NULL)
  }
  if (!is.null(value$raw) && is.finite(as.numeric(value$raw))) {
    return(format(as.Date(as.POSIXct(as.numeric(value$raw), origin = "1970-01-01", tz = "UTC")), "%Y-%m-%d"))
  }
  if (!is.null(value$fmt)) {
    return(substr(value$fmt, 1, 10))
  }
  NULL
}

sp_yahoo_number <- function(value) {
  if (is.null(value)) {
    return(NA_real_)
  }
  if (!is.null(value$raw)) {
    return(suppressWarnings(as.numeric(value$raw)))
  }
  suppressWarnings(as.numeric(value))
}

sp_extract_next_earnings_date <- function(summary) {
  dates <- summary$calendarEvents$earnings$earningsDate
  if (is.null(dates) || !length(dates)) {
    return(NULL)
  }
  parsed <- unlist(lapply(dates, sp_yahoo_date), use.names = FALSE)
  parsed <- parsed[!is.na(parsed) & nzchar(parsed)]
  if (!length(parsed)) {
    return(NULL)
  }
  sort(parsed)[[1]]
}

sp_post_event_return <- function(rows, event_date) {
  if (!is.data.frame(rows) || nrow(rows) < 2L || is.null(event_date)) {
    return(NA_real_)
  }
  index <- which(rows$date > as.Date(event_date))[1]
  if (is.na(index) || index <= 1L) {
    return(NA_real_)
  }
  rows$close[[index]] / rows$close[[index - 1L]] - 1
}

sp_fallback_earnings_move <- function(rows) {
  returns <- tail(sp_log_returns(rows$close), 63L)
  if (length(returns) < 10L) {
    return(NA_real_)
  }
  sp_sample_sd(returns)
}

sp_eps_surprise_trend <- function(values) {
  values <- as.numeric(values)
  values <- values[is.finite(values)]
  if (length(values) < 3L) {
    return("mixed")
  }
  values <- head(values, 3L)
  if (all(values > 0)) {
    return("beat_streak")
  }
  if (all(values < 0)) {
    return("miss_streak")
  }
  "mixed"
}

sp_sentiment_trend <- function(older, newer) {
  older_score <- if (length(older)) mean(older) else 0
  newer_score <- if (length(newer)) mean(newer) else 0
  delta <- newer_score - older_score
  if (delta > 0.15) {
    return("improving")
  }
  if (delta < -0.15) {
    return("deteriorating")
  }
  "flat"
}

sp_last_observation <- function(series) {
  if (!is.data.frame(series) || !nrow(series)) {
    return(list(date = NULL, value = NA_real_))
  }
  row <- tail(series, 1L)
  list(date = as.character(row$date[[1]]), value = row$value[[1]])
}

sp_observation_months_ago <- function(series, date, months) {
  if (!is.data.frame(series) || !nrow(series) || is.null(date)) {
    return(list(date = NULL, value = NA_real_))
  }
  target <- as.Date(date)
  target_month <- as.POSIXlt(target)
  target_month$mon <- target_month$mon - months
  target_date <- as.Date(target_month)
  candidates <- series[series$date <= target_date, , drop = FALSE]
  if (!nrow(candidates)) {
    return(list(date = NULL, value = NA_real_))
  }
  sp_last_observation(candidates)
}

sp_latest_series_date <- function(series_list) {
  dates <- unlist(lapply(series_list, function(series) {
    observation <- sp_last_observation(series)
    observation$date
  }), use.names = FALSE)
  dates <- dates[!is.na(dates) & nzchar(dates)]
  if (!length(dates)) {
    return(NULL)
  }
  max(dates)
}

sp_classify_macro_regime <- function(ten_year, two_year, cpi, unemployment, pmi) {
  ten <- sp_last_observation(ten_year)
  two <- sp_last_observation(two_year)
  unrate <- sp_last_observation(unemployment)
  unrate_six_months_ago <- sp_observation_months_ago(unemployment, unrate$date, 6L)
  pmi_latest <- sp_last_observation(pmi)
  pmi_three_months_ago <- sp_observation_months_ago(pmi, pmi_latest$date, 3L)
  cpi_latest <- sp_last_observation(cpi)
  cpi_year_ago <- sp_observation_months_ago(cpi, cpi_latest$date, 12L)

  required <- c(ten$value, two$value, unrate$value, pmi_latest$value, cpi_latest$value, cpi_year_ago$value)
  if (any(!is.finite(required))) {
    return(NA_character_)
  }

  spread <- ten$value - two$value
  cpi_yoy <- cpi_latest$value / cpi_year_ago$value - 1
  unemployment_rising <- is.finite(unrate_six_months_ago$value) && unrate$value > unrate_six_months_ago$value + 0.2
  unemployment_falling <- is.finite(unrate_six_months_ago$value) && unrate$value < unrate_six_months_ago$value - 0.1
  pmi_rising <- is.finite(pmi_three_months_ago$value) && pmi_latest$value > pmi_three_months_ago$value
  inverted_six_months <- sp_yield_curve_inverted_for_six_months(ten_year, two_year)

  if (unemployment_rising && inverted_six_months) {
    return("recession")
  }
  if (cpi_yoy > 0.04 && pmi_latest$value < 50) {
    return("stagflation")
  }
  if (pmi_latest$value > 50 && spread > 0 && unemployment_falling) {
    return("expansion")
  }
  if (pmi_rising && is.finite(pmi_three_months_ago$value) && pmi_three_months_ago$value < 50 && !unemployment_rising) {
    return("recovery")
  }
  if (spread >= 0) "expansion" else "recession"
}

sp_yield_curve_inverted_for_six_months <- function(ten_year, two_year) {
  if (!is.data.frame(ten_year) || !is.data.frame(two_year) || !nrow(ten_year) || !nrow(two_year)) {
    return(FALSE)
  }
  merged <- merge(tail(ten_year, 126L), two_year, by = "date", suffixes = c("_ten", "_two"))
  if (nrow(merged) < 80L) {
    return(FALSE)
  }
  spreads <- merged$value_ten - merged$value_two
  mean(spreads < 0, na.rm = TRUE) > 0.8
}

sp_sector_etf_for <- function(sector) {
  if (is.null(sector) || is.na(sector) || !nzchar(sector)) {
    return(NA_character_)
  }
  key <- tolower(sector)
  value <- SP_SECTOR_ETFS[[key]]
  if (is.null(value)) NA_character_ else value
}

sp_sector_vs_spy_return <- function(providers, sector_etf, as_of_date) {
  sector_rows <- sp_clean_ohlcv(providers$fetch_ohlcv(sector_etf, as_of_date), as_of_date)
  spy_rows <- sp_clean_ohlcv(providers$fetch_ohlcv("SPY", as_of_date), as_of_date)
  sector_return <- sp_window_return(sector_rows, 63L)
  spy_return <- sp_window_return(spy_rows, 63L)
  if (sp_missing_number(sector_return) || sp_missing_number(spy_return)) {
    return(NA_real_)
  }
  sector_return - spy_return
}

sp_window_return <- function(rows, sessions) {
  if (!is.data.frame(rows) || nrow(rows) <= sessions) {
    return(NA_real_)
  }
  start <- rows$close[[nrow(rows) - sessions]]
  end <- rows$close[[nrow(rows)]]
  if (!is.finite(start) || start <= 0 || !is.finite(end)) {
    return(NA_real_)
  }
  end / start - 1
}

sp_sector_strength <- function(relative_return) {
  if (sp_missing_number(relative_return)) {
    return(NA_character_)
  }
  if (relative_return > 0.02) {
    return("outperforming")
  }
  if (relative_return < -0.02) {
    return("underperforming")
  }
  "inline"
}

sp_adjusted_daily_drift <- function(base_drift, sentiment, macro) {
  drift <- base_drift
  if (identical(sp_scalar_character(macro$macro_regime, ""), "expansion")) {
    drift <- drift + 0.002
  }
  if (identical(sp_scalar_character(macro$macro_regime, ""), "recession")) {
    drift <- drift - 0.002
  }
  if (!sp_missing_number(sentiment$net_sentiment_score) && sentiment$net_sentiment_score > 0.3) {
    drift <- drift + 0.001
  }
  if (!sp_missing_number(sentiment$net_sentiment_score) && sentiment$net_sentiment_score < -0.3) {
    drift <- drift - 0.001
  }
  if (identical(sp_scalar_character(macro$sector_relative_strength, ""), "outperforming")) {
    drift <- drift + 0.001
  }
  drift
}

sp_daily_simulation_vol <- function(price, vol) {
  if (!sp_missing_number(vol$garch_vol_1d_ahead) && vol$garch_vol_1d_ahead > 0) {
    if (vol$garch_vol_1d_ahead > 0.08) {
      return(vol$garch_vol_1d_ahead / sqrt(SP_TRADING_DAYS))
    }
    return(vol$garch_vol_1d_ahead)
  }
  if (!sp_missing_number(vol$realized_vol_21d) && vol$realized_vol_21d > 0) {
    return(vol$realized_vol_21d / sqrt(SP_TRADING_DAYS))
  }
  if (!sp_missing_number(price$log_return_std_252d) && price$log_return_std_252d > 0) {
    return(price$log_return_std_252d)
  }
  sp_sample_sd(price$raw_returns)
}

sp_sample_earnings_shock <- function(distribution, estimated_move) {
  distribution <- as.numeric(distribution)
  distribution <- distribution[is.finite(distribution)]
  if (length(distribution)) {
    return(sample(distribution, 1))
  }
  if (!sp_missing_number(estimated_move)) {
    return(estimated_move * rnorm(1))
  }
  0
}

sp_mean <- function(values) {
  values <- as.numeric(values)
  values <- values[is.finite(values)]
  if (!length(values)) {
    return(NA_real_)
  }
  mean(values)
}

sp_median <- function(values) {
  values <- as.numeric(values)
  values <- values[is.finite(values)]
  if (!length(values)) {
    return(NA_real_)
  }
  stats::median(values)
}

sp_sample_sd <- function(values) {
  values <- as.numeric(values)
  values <- values[is.finite(values)]
  if (length(values) < 2L) {
    return(NA_real_)
  }
  stats::sd(values)
}

sp_percentile_rank <- function(values, current) {
  values <- as.numeric(values)
  values <- values[is.finite(values)]
  if (!length(values) || sp_missing_number(current)) {
    return(NA_real_)
  }
  mean(values <= current)
}

sp_any_missing_core <- function(data, names) {
  any(vapply(names, function(name) {
    value <- data[[name]]
    if (is.numeric(value)) sp_missing_number(value) else is.null(value) || anyNA(value)
  }, logical(1)))
}

sp_list_merge <- function(base, override) {
  if (!is.list(override)) {
    return(base)
  }
  merged <- base
  for (name in names(override)) {
    merged[name] <- list(override[[name]])
  }
  merged
}

sp_scalar_character <- function(value, default) {
  if (is.null(value) || !length(value) || is.na(value[[1]])) {
    return(default)
  }
  as.character(value[[1]])
}

sp_scalar_integer <- function(value, default) {
  if (is.null(value) || !length(value) || is.na(value[[1]])) {
    return(as.integer(default))
  }
  as.integer(suppressWarnings(as.numeric(value[[1]])))
}

sp_missing_number <- function(value) {
  is.null(value) || !length(value) || is.na(value[[1]]) || !is.finite(suppressWarnings(as.numeric(value[[1]])))
}

sp_null_if_missing <- function(value) {
  if (is.null(value) || !length(value) || anyNA(value) || (is.character(value) && !nzchar(value[[1]]))) {
    return(NULL)
  }
  value[[1]]
}

sp_round_or_null <- function(value, digits) {
  if (sp_missing_number(value)) {
    return(NULL)
  }
  round(as.numeric(value[[1]]), digits)
}

sp_clamp <- function(value, minimum, maximum) {
  min(maximum, max(minimum, value))
}

`%||%` <- function(left, right) {
  if (is.null(left) || !length(left) || all(is.na(left))) right else left
}

sp_to_json_base <- function(value, pretty = FALSE, indent = 0L) {
  spacer <- if (pretty) paste(rep(" ", indent), collapse = "") else ""
  next_spacer <- if (pretty) paste(rep(" ", indent + 2L), collapse = "") else ""
  newline <- if (pretty) "\n" else ""
  separator <- if (pretty) ": " else ":"

  if (is.null(value) || (length(value) == 1L && anyNA(value))) {
    return("null")
  }
  if (is.logical(value) && length(value) == 1L) {
    return(if (isTRUE(value)) "true" else "false")
  }
  if (is.numeric(value) && length(value) == 1L) {
    if (!is.finite(value)) {
      return("null")
    }
    return(format(value, scientific = FALSE, trim = TRUE))
  }
  if (is.character(value) && length(value) == 1L) {
    return(sprintf("\"%s\"", sp_json_escape(value)))
  }
  if (is.atomic(value)) {
    items <- vapply(as.list(value), sp_to_json_base, character(1), pretty = pretty, indent = indent + 2L)
    return(paste0("[", paste(items, collapse = ","), "]"))
  }
  if (is.list(value)) {
    if (is.null(names(value)) || all(!nzchar(names(value)))) {
      items <- vapply(value, sp_to_json_base, character(1), pretty = pretty, indent = indent + 2L)
      return(paste0("[", paste(items, collapse = paste0(",", newline, next_spacer)), "]"))
    }
    fields <- character()
    for (name in names(value)) {
      fields <- c(fields, paste0(next_spacer, "\"", sp_json_escape(name), "\"", separator, sp_to_json_base(value[[name]], pretty = pretty, indent = indent + 2L)))
    }
    return(paste0("{", newline, paste(fields, collapse = paste0(",", newline)), newline, spacer, "}"))
  }
  "null"
}

sp_json_escape <- function(value) {
  value <- gsub("\\\\", "\\\\\\\\", value)
  value <- gsub("\"", "\\\\\"", value)
  value <- gsub("\n", "\\\\n", value)
  value <- gsub("\r", "\\\\r", value)
  value <- gsub("\t", "\\\\t", value)
  value
}
