import { calculateFundamentalFeatures } from '../features/fundamental.js';
import { calculateMacroFeatures } from '../features/macro.js';
import { calculateNewsFeatures } from '../features/news.js';
import { calculateRiskFeatures } from '../features/risk.js';
import { calculateTechnicalFeatures } from '../features/technical.js';
import { cleanRows, finite, round } from '../features/math.js';
import {
  calculateAlphaScore,
  confidenceScore,
  expectedReturns,
  featureImportance,
  logisticOutperformanceProbability,
  signalFor,
  topDrivers,
} from './scoring.js';
import { createCompositeDataClient } from '../data/clients.js';

export async function predictOutperformance({
  ticker,
  horizon = 5,
  asOfDate = new Date().toISOString().slice(0, 10),
  riskTolerance = 'moderate',
  marketData,
  dataClient = createCompositeDataClient(),
  weights,
} = {}) {
  const normalizedTicker = String(ticker || '').trim().toUpperCase();
  if (!normalizedTicker) throw Object.assign(new Error('ticker is required'), { status: 400 });
  if (![5, 10, 20].includes(Number(horizon))) throw Object.assign(new Error('horizon must be 5, 10, or 20 trading days'), { status: 400 });

  const data = marketData || (await dataClient.fetchPredictionDataset({ ticker: normalizedTicker, asOfDate }));
  const stockRows = cleanRows(data.stockRows);
  const spyRows = cleanRows(data.spyRows);
  const qqqRows = cleanRows(data.qqqRows || data.spyRows);
  const vixRows = cleanRows(data.vixRows || []);
  const sectorRows = cleanRows(data.sectorRows || data.spyRows);
  const providerStatus = data.providerStatus || dataClient.status?.() || {};
  const warnings = buildWarnings(providerStatus, data);

  const technical = calculateTechnicalFeatures({ stockRows, spyRows, sectorRows });
  const fundamental = calculateFundamentalFeatures(data.fundamentals || {});
  const news = calculateNewsFeatures({ ticker: normalizedTicker, asOfDate: `${asOfDate}T23:59:59Z`, articles: data.news || [] });
  const macro = calculateMacroFeatures({ spyRows, qqqRows, vixRows, sectorRows, macro: data.macro || {}, sector: data.sector || 'technology' });
  const risk = calculateRiskFeatures({ technical, news, macro, stockRows, earnings: data.earnings || {} });
  const alphaScore = calculateAlphaScore({ technical, fundamental, news, macro, risk, weights });
  const probability = logisticOutperformanceProbability({ technical, fundamental, news, macro, risk, alphaScore });
  const returns = expectedReturns({ technical, macro, news, risk, probability, horizon: Number(horizon) });
  const completeness = featureCompleteness({ technical, fundamental, news, macro });
  const confidence = confidenceScore({ providerStatus, featureCompleteness: completeness, alphaScore, risk });
  const signal = signalFor({ probability, expectedExcessReturn: returns.expected_excess_return, riskScore: risk.risk_score, confidence });

  return {
    ticker: normalizedTicker,
    as_of_date: asOfDate,
    horizon: `${Number(horizon)}d`,
    prediction_target: 'stock_return_gt_spy_return',
    probability_outperform_spy: probability,
    expected_return: returns.expected_return,
    expected_excess_return: returns.expected_excess_return,
    risk_score: round(risk.risk_score, 4),
    risk_label: risk.risk_label,
    confidence,
    technical_score: round(technical.momentum_score, 4),
    fundamental_score: round(fundamental.fundamental_quality_score, 4),
    news_sentiment_score: round(news.news_sentiment_score, 4),
    macro_score: round(macro.macro_sector_score, 4),
    alpha_score: alphaScore,
    final_signal: signal,
    signal,
    main_drivers: topDrivers({ technical, fundamental, news, macro, risk, probability }),
    feature_importance: featureImportance({ technical, fundamental, news, macro, risk }),
    recent_news: news.recent_headlines,
    features: { technical, fundamental, news, macro, risk },
    provider_status: providerStatus,
    warnings,
    disclaimer: 'Prediction is probabilistic, not guaranteed. This is not investment advice.',
  };
}

export async function rankUniverse({ tickers = [], horizon = 5, asOfDate, dataClient, marketDataByTicker = {} }) {
  const predictions = [];
  for (const ticker of tickers) {
    try {
      predictions.push(
        await predictOutperformance({
          ticker,
          horizon,
          asOfDate,
          dataClient,
          marketData: marketDataByTicker[ticker],
        })
      );
    } catch (error) {
      predictions.push({ ticker: String(ticker).toUpperCase(), error: error.message, signal: 'avoid', warnings: [error.message] });
    }
  }
  return {
    horizon: `${Number(horizon)}d`,
    rankings: predictions.sort((first, second) => (second.alpha_score ?? -1) - (first.alpha_score ?? -1)),
  };
}

function buildWarnings(providerStatus, data) {
  const warnings = ['Prediction is probabilistic, not guaranteed'];
  if (providerStatus.bloomberg === 'disconnected') warnings.push('Bloomberg is not connected; fallback data providers are being used');
  for (const [provider, status] of Object.entries(providerStatus)) {
    if (['failed', 'degraded'].includes(status)) warnings.push(`${provider} data source is ${status}`);
  }
  if (!data.news?.length) warnings.push('News data unavailable or delayed; news score uses neutral fallback');
  if (!data.fundamentals || Object.keys(data.fundamentals).length === 0) warnings.push('Fundamental data unavailable; fundamental score uses neutral fallback');
  return [...new Set(warnings)];
}

function featureCompleteness(groups) {
  const values = Object.values(groups).flatMap((group) => Object.values(group));
  const numeric = values.filter((value) => typeof value === 'number' || value === null);
  if (!numeric.length) return 0;
  return numeric.filter(finite).length / numeric.length;
}
