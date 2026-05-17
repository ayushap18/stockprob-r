export function normalizePriceHistory(raw) {
  const rows = Array.isArray(raw?.rows) ? raw.rows : Array.isArray(raw) ? raw : [];
  return rows
    .map((row) => ({
      time: dateString(row.time || row.date),
      date: dateString(row.date || row.time),
      open: number(row.open ?? row.o ?? row.close),
      high: number(row.high ?? row.h ?? row.close),
      low: number(row.low ?? row.l ?? row.close),
      close: number(row.close ?? row.c),
      volume: number(row.volume ?? row.v),
    }))
    .filter((row) => row.date && finite(row.close) && finite(row.open) && finite(row.high) && finite(row.low))
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
}

export function normalizePrediction(raw) {
  const features = raw?.features || {};
  return {
    ticker: text(raw?.ticker, 'MSFT'),
    asOfDate: text(raw?.as_of_date || raw?.asOfDate, new Date().toISOString().slice(0, 10)),
    probability: clamp(raw?.probability_outperform_spy ?? raw?.probability),
    expectedReturn: safe(raw?.expected_return),
    expectedExcessReturn: safe(raw?.expected_excess_return),
    riskScore: clamp(raw?.risk_score),
    riskLabel: text(raw?.risk_label, 'medium'),
    confidence: clamp(raw?.confidence),
    signal: text(raw?.signal || raw?.final_signal, 'neutral'),
    technicalScore: clamp(raw?.technical_score),
    fundamentalScore: clamp(raw?.fundamental_score),
    newsScore: clamp(raw?.news_sentiment_score),
    macroScore: clamp(raw?.macro_score),
    alphaScore: clamp(raw?.alpha_score),
    featureImportance: normalizeFeatureAnalysis(raw),
    recentNews: Array.isArray(raw?.recent_news) ? raw.recent_news : [],
    features,
    providerStatus: raw?.provider_status || {},
    warnings: Array.isArray(raw?.warnings) ? raw.warnings : [],
  };
}

export function normalizeMonteCarlo(raw) {
  const percentiles = Array.isArray(raw?.percentiles) ? raw.percentiles : [];
  return {
    paths: Array.isArray(raw?.paths) ? raw.paths : [],
    percentiles: percentiles.map((row) => ({
      day: number(row.day),
      p5: safe(row.p5 ?? row.p05),
      p25: safe(row.p25),
      p50: safe(row.p50),
      p75: safe(row.p75),
      p95: safe(row.p95),
    })).filter((row) => finite(row.day)),
    finalValues: (raw?.finalValues || []).filter(finite).map(Number),
    finalReturns: (raw?.finalReturns || []).filter(finite).map(Number),
    summary: raw?.summary || {},
    probabilityOutperformSpy: clamp(raw?.probabilityOutperformSpy),
  };
}

export function normalizeFeatureAnalysis(raw) {
  const rows = Array.isArray(raw?.feature_importance) ? raw.feature_importance : Array.isArray(raw) ? raw : [];
  return rows
    .map((row) => ({
      feature: text(row.feature || row.name, 'feature'),
      importance: Math.abs(safe(row.importance ?? row.value)),
      impact: safe(row.impact ?? row.value),
    }))
    .filter((row) => row.feature && finite(row.importance))
    .sort((first, second) => Math.abs(second.importance) - Math.abs(first.importance));
}

export function normalizeRankings(raw) {
  const rows = Array.isArray(raw?.rankings) ? raw.rankings : Array.isArray(raw) ? raw : [];
  return rows.map((row, index) => ({
    rank: number(row.rank) || index + 1,
    ticker: text(row.ticker, 'N/A'),
    sector: text(row.sector, 'Unknown'),
    probability: clamp(row.probability_outperform_spy ?? row.probability),
    expectedReturn: safe(row.expected_return ?? row.expectedReturn),
    expectedExcessReturn: safe(row.expected_excess_return ?? row.expectedExcessReturn),
    alphaScore: clamp(row.alpha_score ?? row.alphaScore),
    risk: clamp(row.risk_score ?? row.risk),
    confidence: clamp(row.confidence),
    signal: text(row.signal || row.final_signal, 'neutral'),
    providerStatus: text(row.provider_status?.market || row.providerStatus, 'unknown'),
  })).filter((row) => row.ticker && row.ticker !== 'N/A');
}

export function normalizeBacktest(raw) {
  const equity = Array.isArray(raw?.equity_curve) ? raw.equity_curve : Array.isArray(raw?.equity) ? raw.equity : [];
  const benchmark = Array.isArray(raw?.benchmark_equity_curve) ? raw.benchmark_equity_curve : [];
  const normalizedEquity = equity.map((row, index) => ({
    date: dateString(row.date || index),
    strategy: safe(row.equity ?? row.strategy ?? row.model ?? row.value ?? 1),
    spy: safe(benchmark[index]?.equity ?? row.spy ?? row.benchmark ?? 1),
    cumulativeReturn: safe((row.equity ?? row.strategy ?? 1) - 1),
  })).filter((row) => row.date && finite(row.strategy)).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  return {
    equity: normalizedEquity,
    drawdown: normalizedEquity.map((row, index) => {
      const peak = Math.max(...normalizedEquity.slice(0, index + 1).map((point) => point.strategy || 1));
      return { date: row.date, drawdown: peak ? row.strategy / peak - 1 : 0 };
    }),
    metrics: raw?.metrics || {},
    calibration: raw?.calibration || raw?.calibration_bins || [],
    confidenceBuckets: raw?.confidenceBuckets || raw?.metrics?.hit_rate_by_confidence_bucket || [],
  };
}

export function normalizeProviderHealth(raw) {
  const providers = raw?.infrastructure?.providers || raw?.providers || [];
  if (Array.isArray(providers)) {
    return providers.map((provider) => ({
      provider: text(provider.label || provider.provider || provider.key, 'Provider'),
      status: text(provider.status, provider.configured ? 'ok' : 'missing'),
      latencyMs: safe(provider.latencyMs),
      fallbackCount: number(provider.fallbackCount),
      warningCount: number(provider.warningCount || provider.missing_env?.length),
      lastRefresh: text(provider.lastRefresh, ''),
    }));
  }
  return Object.entries(providers).map(([provider, status]) => ({ provider, status, latencyMs: null, fallbackCount: 0, warningCount: status === 'ok' ? 0 : 1 }));
}

export function normalizeMacro(raw) {
  const rows = Array.isArray(raw) ? raw : Array.isArray(raw?.rows) ? raw.rows : [];
  return rows.map((row) => ({
    date: dateString(row.date),
    fedFunds: safe(row.fedFunds ?? row.fed_funds_rate),
    treasury10y: safe(row.treasury10y ?? row.treasury_10y),
    treasury2y: safe(row.treasury2y ?? row.treasury_2y),
    cpiYoY: safe(row.cpiYoY ?? row.cpi_yoy),
    unemployment: safe(row.unemployment ?? row.unemployment_rate),
    macroScore: clamp(row.macroScore ?? row.macro_sector_score),
    regime: text(row.regime || row.market_regime, 'sideways'),
  })).filter((row) => row.date).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
}

function dateString(value) {
  if (!value && value !== 0) return '';
  if (typeof value === 'number') {
    const date = new Date(value > 10_000_000_000 ? value : value * 1000);
    return Number.isFinite(date.getTime()) ? date.toISOString().slice(0, 10) : String(value);
  }
  const textValue = String(value);
  const date = new Date(textValue);
  if (Number.isFinite(date.getTime())) return date.toISOString().slice(0, 10);
  return textValue.length >= 10 ? textValue.slice(0, 10) : textValue;
}

function text(value, fallback) {
  return value === null || value === undefined || value === '' ? fallback : String(value);
}

function number(value) {
  return finite(value) ? Number(value) : null;
}

function safe(value) {
  return finite(value) ? Number(value) : 0;
}

function clamp(value, min = 0, max = 1) {
  return Math.min(max, Math.max(min, safe(value)));
}

function finite(value) {
  return value !== null && value !== undefined && value !== '' && Number.isFinite(Number(value));
}
