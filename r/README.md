# StockProb-R Engine

Standalone R implementation of the StockProb orchestration and scoring contract.

```bash
Rscript tests/test_stockprob_engine.R
Rscript stockprob_cli.R --ticker MSFT --window-days 30 --as-of-date 2026-05-16 --risk-tolerance moderate --seed 42
```

The R engine is dependency-light and uses base R for deterministic scoring. Optional `jsonlite` enables JSON request files and live HTTP JSON providers.
