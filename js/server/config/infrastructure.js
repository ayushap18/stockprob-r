const PROVIDERS = [
  {
    key: 'bloomberg',
    label: 'Bloomberg BLPAPI',
    category: 'institutional',
    env: ['BLOOMBERG_API_ENABLED', 'BLOOMBERG_HOST'],
    required_for: ['institutional prices', 'fundamentals', 'news', 'estimates'],
    fallback: 'public providers',
  },
  {
    key: 'polygon',
    label: 'Polygon.io',
    category: 'market_data',
    env: ['POLYGON_API_KEY'],
    required_for: ['reliable OHLCV', 'options data', 'market status'],
    fallback: 'Yahoo Finance development fallback',
  },
  {
    key: 'fmp',
    label: 'Financial Modeling Prep',
    category: 'fundamentals',
    env: ['FMP_API_KEY'],
    required_for: ['fundamentals', 'ratios', 'financial growth'],
    fallback: 'neutral fundamental score',
  },
  {
    key: 'alpha_vantage',
    label: 'Alpha Vantage',
    category: 'news',
    env: ['ALPHA_VANTAGE_API_KEY'],
    required_for: ['news sentiment fallback'],
    fallback: 'neutral news score',
  },
  {
    key: 'fred',
    label: 'FRED',
    category: 'macro',
    env: ['FRED_API_KEY'],
    required_for: ['rates', 'inflation', 'unemployment', 'macro regime'],
    fallback: 'market-implied macro proxy',
  },
  {
    key: 'redis',
    label: 'Redis',
    category: 'infrastructure',
    env: ['REDIS_URL'],
    required_for: ['shared cache', 'queues', 'websocket fanout', 'rate limits'],
    fallback: 'in-process memory cache',
  },
  {
    key: 'postgres',
    label: 'Postgres / TimescaleDB',
    category: 'storage',
    env: ['DATABASE_URL'],
    required_for: ['feature store', 'prediction history', 'backtest history'],
    fallback: 'stateless serverless responses',
  },
  {
    key: 'object_storage',
    label: 'S3 / R2 Object Storage',
    category: 'storage',
    env: ['OBJECT_STORAGE_URL'],
    required_for: ['raw provider payload archive', 'model artifacts'],
    fallback: 'no raw payload archive',
  },
  {
    key: 'python_model_worker',
    label: 'Python Model Worker',
    category: 'modeling',
    env: ['MODEL_WORKER_URL'],
    required_for: ['LightGBM/XGBoost', 'SHAP', 'walk-forward training'],
    fallback: 'JavaScript baseline model',
  },
];

const ADDONS = [
  { key: 'queue', label: 'BullMQ / Inngest queue', depends_on: ['redis'], status_when_missing: 'local_only' },
  { key: 'feature_store', label: 'Dated feature store', depends_on: ['postgres'], status_when_missing: 'missing' },
  { key: 'model_registry', label: 'Model registry', depends_on: ['postgres', 'object_storage'], status_when_missing: 'missing' },
  { key: 'observability', label: 'Sentry / OpenTelemetry', depends_on: ['SENTRY_DSN'], status_when_missing: 'missing' },
];

export function infrastructureReadiness({ cacheStats } = {}) {
  const providers = PROVIDERS.map((provider) => {
    const configured = provider.env.every((name) => Boolean(process.env[name]));
    return {
      ...provider,
      configured,
      status: configured ? 'configured' : 'missing',
      missing_env: provider.env.filter((name) => !process.env[name]),
    };
  });
  const byKey = Object.fromEntries(providers.map((provider) => [provider.key, provider]));
  const addons = ADDONS.map((addon) => {
    const configured = addon.depends_on.every((dependency) => byKey[dependency]?.configured || Boolean(process.env[dependency]));
    return {
      ...addon,
      configured,
      status: configured ? 'ready' : addon.status_when_missing,
    };
  });
  return {
    providers,
    addons,
    cache: cacheStats || null,
    capabilities: {
      live_market_data: byKey.polygon.configured || byKey.bloomberg.configured,
      live_fundamentals: byKey.fmp.configured || byKey.bloomberg.configured,
      live_news: byKey.alpha_vantage.configured || byKey.bloomberg.configured,
      live_macro: byKey.fred.configured || byKey.bloomberg.configured,
      persistent_feature_store: byKey.postgres.configured,
      distributed_jobs: byKey.redis.configured,
      advanced_model_worker: byKey.python_model_worker.configured,
    },
    next_required: providers
      .filter((provider) => !provider.configured)
      .slice(0, 5)
      .map((provider) => ({ key: provider.key, label: provider.label, env: provider.env, fallback: provider.fallback })),
  };
}

export function requiredProviderPlan() {
  return {
    phase_1: ['POLYGON_API_KEY', 'FMP_API_KEY', 'ALPHA_VANTAGE_API_KEY'],
    phase_2: ['DATABASE_URL', 'REDIS_URL', 'FRED_API_KEY'],
    phase_3: ['MODEL_WORKER_URL', 'OBJECT_STORAGE_URL', 'SENTRY_DSN'],
    institutional: ['BLOOMBERG_API_ENABLED', 'BLOOMBERG_HOST'],
  };
}
