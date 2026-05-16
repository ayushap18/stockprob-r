const memoryState = {
  predictions: [],
  backtests: [],
  providerSnapshots: [],
};

const MAX_MEMORY_RECORDS = 500;

export function createStorageAdapter({ env = process.env } = {}) {
  if (env.DATABASE_URL) return new PostgresStorageAdapter({ databaseUrl: env.DATABASE_URL });
  return new MemoryStorageAdapter();
}

export class MemoryStorageAdapter {
  constructor() {
    this.kind = 'memory';
    this.persistent = false;
  }

  async status() {
    return {
      kind: this.kind,
      status: 'fallback',
      persistent: false,
      message: 'Using in-process memory storage. Configure DATABASE_URL for durable Postgres/TimescaleDB storage.',
      counts: {
        predictions: memoryState.predictions.length,
        backtests: memoryState.backtests.length,
        provider_snapshots: memoryState.providerSnapshots.length,
      },
    };
  }

  async savePrediction(record) {
    const saved = normalizeRecord(record, 'prediction');
    pushBounded(memoryState.predictions, saved);
    return saved;
  }

  async saveBacktest(record) {
    const saved = normalizeRecord(record, 'backtest');
    pushBounded(memoryState.backtests, saved);
    return saved;
  }

  async saveProviderSnapshot(record) {
    const saved = normalizeRecord(record, 'provider_snapshot');
    pushBounded(memoryState.providerSnapshots, saved);
    return saved;
  }

  async recentPredictions(limit = 25) {
    return memoryState.predictions.slice(-limit).reverse();
  }

  async recentBacktests(limit = 25) {
    return memoryState.backtests.slice(-limit).reverse();
  }
}

export class PostgresStorageAdapter {
  constructor({ databaseUrl }) {
    this.kind = 'postgres';
    this.persistent = true;
    this.databaseUrl = databaseUrl;
  }

  async status() {
    return {
      kind: this.kind,
      status: 'configured',
      persistent: true,
      message: 'DATABASE_URL is configured. Install a Postgres driver and run migrations to enable durable writes.',
      schema_required: storageSchemaPlan().tables.map((table) => table.name),
    };
  }

  async savePrediction(record) {
    return normalizeRecord(record, 'prediction', { skipped: 'postgres_driver_not_installed' });
  }

  async saveBacktest(record) {
    return normalizeRecord(record, 'backtest', { skipped: 'postgres_driver_not_installed' });
  }

  async saveProviderSnapshot(record) {
    return normalizeRecord(record, 'provider_snapshot', { skipped: 'postgres_driver_not_installed' });
  }

  async recentPredictions() {
    return [];
  }

  async recentBacktests() {
    return [];
  }
}

export function storageSchemaPlan() {
  return {
    extension: 'timescaledb',
    tables: [
      {
        name: 'stockprob_predictions',
        time_column: 'created_at',
        columns: ['id', 'created_at', 'ticker', 'horizon', 'as_of_date', 'probability_outperform_spy', 'expected_return', 'expected_excess_return', 'risk_score', 'confidence', 'signal', 'payload_json'],
      },
      {
        name: 'stockprob_backtests',
        time_column: 'created_at',
        columns: ['id', 'created_at', 'universe', 'horizon', 'rebalance', 'top_n', 'data_mode', 'metrics_json', 'payload_json'],
      },
      {
        name: 'stockprob_provider_snapshots',
        time_column: 'created_at',
        columns: ['id', 'created_at', 'provider_summary', 'providers_json', 'infrastructure_json'],
      },
      {
        name: 'stockprob_feature_rows',
        time_column: 'as_of_date',
        columns: ['ticker', 'as_of_date', 'horizon', 'technical_json', 'fundamental_json', 'news_json', 'macro_json', 'risk_json'],
      },
    ],
    indexes: [
      'stockprob_predictions(ticker, horizon, created_at desc)',
      'stockprob_backtests(horizon, created_at desc)',
      'stockprob_feature_rows(ticker, as_of_date desc)',
    ],
  };
}

export function resetMemoryStorage() {
  memoryState.predictions.length = 0;
  memoryState.backtests.length = 0;
  memoryState.providerSnapshots.length = 0;
}

function normalizeRecord(record = {}, type, extra = {}) {
  return {
    id: record.id || `${type}-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    type,
    created_at: record.created_at || new Date().toISOString(),
    ...record,
    ...extra,
  };
}

function pushBounded(collection, record) {
  collection.push(record);
  while (collection.length > MAX_MEMORY_RECORDS) collection.shift();
}
