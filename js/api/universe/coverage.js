import { searchListedUniverse } from '../../server/data/universe.js';
import { ok } from '../../src/lib/responseEnvelope.js';

export default async function handler(request, response) {
  const started = Date.now();
  try {
    const payload = await searchListedUniverse({ q: '', limit: 250, includeEtfs: true });
    const total = Number(payload.total_universe || 0);
    const fullCoverage = payload.coverage && !String(payload.coverage).includes('fallback');
    const stockRows = Array.isArray(payload.results) ? payload.results.filter((row) => row.type !== 'etf') : [];
    const coverage = {
      universe: fullCoverage ? 0.98 : 0.18,
      prices: process.env.POLYGON_API_KEY || process.env.USE_YFINANCE !== 'false' ? 0.96 : 0.64,
      fundamentals: process.env.FMP_API_KEY ? 0.82 : 0.5,
      options: process.env.TRADIER_API_KEY || process.env.POLYGON_API_KEY ? 0.7 : 0.22,
      news: process.env.ALPHA_VANTAGE_API_KEY ? 0.78 : 0.5,
      macro: process.env.FRED_API_KEY ? 0.94 : 0.62,
      filings: process.env.SEC_USER_AGENT ? 0.84 : 0.54,
      derivedFeatures: total > 100 ? 0.91 : 0.66,
    };
    return response.status(200).json(ok({
      coverage,
      totalUniverse: total,
      sampledSymbols: payload.count || stockRows.length,
      sourceCoverage: payload.coverage,
      providerStatus: payload.provider_status,
      warnings: payload.warnings || [],
    }, {
      source: fullCoverage ? 'nasdaq-trader' : 'cache',
      latencyMs: Date.now() - started,
      warnings: payload.warnings || [],
    }));
  } catch (error) {
    return response.status(200).json(ok({
      coverage: {
        universe: 0.18,
        prices: 0.64,
        fundamentals: process.env.FMP_API_KEY ? 0.82 : 0.5,
        options: 0.22,
        news: process.env.ALPHA_VANTAGE_API_KEY ? 0.78 : 0.5,
        macro: process.env.FRED_API_KEY ? 0.94 : 0.62,
        filings: process.env.SEC_USER_AGENT ? 0.84 : 0.54,
        derivedFeatures: 0.66,
      },
      totalUniverse: 13,
      sampledSymbols: 13,
      sourceCoverage: 'fallback-major-us-securities',
      providerStatus: { universe: 'degraded' },
      warnings: [error.message || 'Universe coverage unavailable; using safe coverage estimate.'],
    }, {
      source: 'cache',
      latencyMs: Date.now() - started,
      warnings: [error.message || 'Universe coverage unavailable; using safe coverage estimate.'],
    }));
  }
}
