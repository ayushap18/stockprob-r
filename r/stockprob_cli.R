#!/usr/bin/env Rscript

cli_full_args <- commandArgs(trailingOnly = FALSE)
cli_file_index <- grep("^--file=", cli_full_args)
cli_script_file <- if (length(cli_file_index)) sub("^--file=", "", cli_full_args[[cli_file_index[[1]]]]) else "r/stockprob_cli.R"
cli_script_dir <- dirname(normalizePath(cli_script_file, mustWork = FALSE))
source(file.path(cli_script_dir, "stockprob_engine.R"))

sp_cli_main <- function(args = commandArgs(trailingOnly = TRUE)) {
  request <- sp_cli_parse_args(args)
  seed <- request$seed
  request$seed <- NULL
  payload <- stockprob_analyze(request, seed = seed)
  cat(stockprob_to_json(payload, pretty = TRUE), "\n", sep = "")
}

sp_cli_parse_args <- function(args) {
  if (!length(args)) {
    stop(
      paste(
        "Usage:",
        "Rscript r/stockprob_cli.R --ticker AAPL --window-days 30 --as-of-date 2026-05-13 --risk-tolerance moderate",
        "or: Rscript r/stockprob_cli.R request.json",
        sep = "\n"
      ),
      call. = FALSE
    )
  }

  if (length(args) == 1L && file.exists(args[[1]])) {
    if (!requireNamespace("jsonlite", quietly = TRUE)) {
      stop("Reading JSON request files requires the jsonlite R package", call. = FALSE)
    }
    data <- jsonlite::fromJSON(args[[1]], simplifyVector = FALSE)
    return(data)
  }

  values <- list(
    ticker = NULL,
    window_days = 30L,
    as_of_date = format(Sys.Date(), "%Y-%m-%d"),
    risk_tolerance = "moderate",
    seed = NULL
  )

  index <- 1L
  while (index <= length(args)) {
    key <- args[[index]]
    value <- if (index < length(args)) args[[index + 1L]] else NULL
    if (is.null(value) || startsWith(value, "--")) {
      stop(sprintf("Missing value for %s", key), call. = FALSE)
    }

    if (key %in% c("--ticker", "-t")) {
      values$ticker <- value
    } else if (key %in% c("--window-days", "--window_days", "-w")) {
      values$window_days <- as.integer(value)
    } else if (key %in% c("--as-of-date", "--as_of_date", "-d")) {
      values$as_of_date <- value
    } else if (key %in% c("--risk-tolerance", "--risk_tolerance", "-r")) {
      values$risk_tolerance <- value
    } else if (key %in% c("--seed", "-s")) {
      values$seed <- as.integer(value)
    } else {
      stop(sprintf("Unknown argument: %s", key), call. = FALSE)
    }
    index <- index + 2L
  }

  values
}

if (identical(environment(), globalenv())) {
  tryCatch(
    sp_cli_main(),
    error = function(error) {
      message(conditionMessage(error))
      quit(status = 1L)
    }
  )
}
