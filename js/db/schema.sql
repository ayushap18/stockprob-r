create table if not exists universe (
  id bigserial primary key,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  source text not null,
  symbol text not null unique,
  name text,
  exchange text,
  sector text,
  industry text
);

create table if not exists price_bars (
  id bigserial primary key,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  source text not null,
  symbol text not null,
  interval text not null,
  as_of_date date not null,
  open numeric,
  high numeric,
  low numeric,
  close numeric,
  volume numeric
);

create table if not exists fundamentals_snapshots (id bigserial primary key, created_at timestamptz not null default now(), updated_at timestamptz not null default now(), source text not null, symbol text not null, as_of_date date not null, payload_json jsonb not null);
create table if not exists earnings_events (id bigserial primary key, created_at timestamptz not null default now(), updated_at timestamptz not null default now(), source text not null, symbol text not null, as_of_date date, event_date date, payload_json jsonb not null);
create table if not exists news_items (id bigserial primary key, created_at timestamptz not null default now(), updated_at timestamptz not null default now(), source text not null, symbol text not null, as_of_date date, published_at timestamptz, payload_json jsonb not null);
create table if not exists filings (id bigserial primary key, created_at timestamptz not null default now(), updated_at timestamptz not null default now(), source text not null, symbol text not null, as_of_date date, filed_at timestamptz, accession text, payload_json jsonb not null);
create table if not exists insider_transactions (id bigserial primary key, created_at timestamptz not null default now(), updated_at timestamptz not null default now(), source text not null, symbol text not null, as_of_date date, transaction_date date, payload_json jsonb not null);
create table if not exists options_snapshots (id bigserial primary key, created_at timestamptz not null default now(), updated_at timestamptz not null default now(), source text not null, symbol text not null, as_of_date date not null, payload_json jsonb not null);
create table if not exists macro_snapshots (id bigserial primary key, created_at timestamptz not null default now(), updated_at timestamptz not null default now(), source text not null, series_id text, as_of_date date not null, payload_json jsonb not null);
create table if not exists derived_features (id bigserial primary key, created_at timestamptz not null default now(), updated_at timestamptz not null default now(), source text not null, symbol text not null, as_of_date date not null, payload_json jsonb not null);
create table if not exists predictions (id bigserial primary key, created_at timestamptz not null default now(), updated_at timestamptz not null default now(), source text not null, symbol text not null, horizon_days integer not null, as_of_date date not null, payload_json jsonb not null);
create table if not exists monte_carlo_runs (id bigserial primary key, created_at timestamptz not null default now(), updated_at timestamptz not null default now(), source text not null, symbol text not null, horizon_days integer not null, as_of_date date, payload_json jsonb not null);
create table if not exists backtest_runs (id bigserial primary key, created_at timestamptz not null default now(), updated_at timestamptz not null default now(), source text not null, as_of_date date, payload_json jsonb not null);
create table if not exists provider_health (id bigserial primary key, created_at timestamptz not null default now(), updated_at timestamptz not null default now(), source text not null, provider text not null, last_success_at timestamptz, last_error_at timestamptz, payload_json jsonb not null);
create table if not exists job_runs (id bigserial primary key, created_at timestamptz not null default now(), updated_at timestamptz not null default now(), source text not null, type text not null, status text not null, payload_json jsonb not null);
create table if not exists system_snapshots (id bigserial primary key, created_at timestamptz not null default now(), updated_at timestamptz not null default now(), source text not null, as_of_date date, payload_json jsonb not null);

create index if not exists universe_symbol_idx on universe(symbol);
create index if not exists price_bars_symbol_interval_asof_idx on price_bars(symbol, interval, as_of_date);
create index if not exists fundamentals_symbol_asof_idx on fundamentals_snapshots(symbol, as_of_date);
create index if not exists news_items_symbol_published_idx on news_items(symbol, published_at);
create index if not exists filings_symbol_filed_idx on filings(symbol, filed_at);
create index if not exists insider_symbol_transaction_idx on insider_transactions(symbol, transaction_date);
create index if not exists options_snapshots_symbol_asof_idx on options_snapshots(symbol, as_of_date);
create index if not exists macro_snapshots_series_asof_idx on macro_snapshots(series_id, as_of_date);
create index if not exists derived_features_symbol_asof_idx on derived_features(symbol, as_of_date);
create index if not exists predictions_symbol_horizon_asof_idx on predictions(symbol, horizon_days, as_of_date);
create index if not exists monte_carlo_runs_symbol_horizon_created_idx on monte_carlo_runs(symbol, horizon_days, created_at);
create index if not exists provider_health_provider_success_idx on provider_health(provider, last_success_at);
create index if not exists job_runs_type_status_created_idx on job_runs(type, status, created_at);
