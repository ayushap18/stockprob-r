import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateTechnicalFeatures } from '../server/features/technical.js';
import { calculateNewsFeatures } from '../server/features/news.js';
import { predictOutperformance } from '../server/models/predict.js';
import { runWalkForwardBacktest } from '../server/backtesting/backtest.js';
import { parseOutperformancePayload } from '../server/routes/stockprob.js';

function series(values, start = '2026-01-01') {
  const startDate = new Date(`${start}T00:00:00Z`);
  return values.map((close, index) => {
    const date = new Date(startDate);
    date.setUTCDate(startDate.getUTCDate() + index);
    const drift = index % 3 === 0 ? 1.01 : 0.995;
    return {
      date: date.toISOString().slice(0, 10),
      open: close / drift,
      high: close * 1.015,
      low: close * 0.985,
      close,
      volume: 1_000_000 + index * 5000,
    };
  });
}

const stockRows = series(Array.from({ length: 260 }, (_, index) => 100 + index * 0.45 + Math.sin(index / 7) * 2));
const spyRows = series(Array.from({ length: 260 }, (_, index) => 400 + index * 0.22 + Math.sin(index / 9) * 1.4));
const sectorRows = series(Array.from({ length: 260 }, (_, index) => 90 + index * 0.32));

test('technical feature calculator produces outperformance-ready indicators', () => {
  const features = calculateTechnicalFeatures({ stockRows, spyRows, sectorRows });

  assert.equal(Number.isFinite(features.return_20d), true);
  assert.equal(Number.isFinite(features.ma_200), true);
  assert.equal(Number.isFinite(features.rsi_14), true);
  assert.equal(Number.isFinite(features.macd), true);
  assert.equal(Number.isFinite(features.atr_14), true);
  assert.equal(Number.isFinite(features.beta_vs_spy), true);
  assert.equal(Number.isFinite(features.correlation_vs_spy), true);
  assert.equal(Number.isFinite(features.sector_relative_strength), true);
  assert.equal(features.price_vs_ma200 > 0, true);
  assert.equal(features.momentum_score > 0.5, true);
});

test('news feature pipeline applies sentiment, source, recency, and relevance weights', () => {
  const asOfDate = '2026-05-16T12:00:00Z';
  const features = calculateNewsFeatures({
    ticker: 'MSFT',
    asOfDate,
    articles: [
      {
        title: 'Microsoft shares rise after analyst upgrade and guidance raise',
        source: 'Reuters',
        published_at: '2026-05-16T06:00:00Z',
        sentiment: 0.8,
        relevance: 0.95,
      },
      {
        title: 'Microsoft faces lawsuit over contract dispute',
        source: 'Unknown Blog',
        published_at: '2026-05-14T12:00:00Z',
        sentiment: -0.5,
        relevance: 0.7,
      },
    ],
  });

  assert.equal(features.news_volume, 2);
  assert.equal(features.positive_news_ratio, 0.5);
  assert.equal(features.negative_news_ratio, 0.5);
  assert.equal(features.event_tags.includes('analyst_upgrade'), true);
  assert.equal(features.event_tags.includes('guidance_raise'), true);
  assert.equal(features.event_tags.includes('lawsuit'), true);
  assert.equal(features.news_sentiment_score > 0, true);
  assert.equal(features.weighted_articles[0].recency_weight > features.weighted_articles[1].recency_weight, true);
});

test('outperformance predictor targets stock return versus SPY and explains drivers', async () => {
  const result = await predictOutperformance({
    ticker: 'MSFT',
    horizon: 5,
    asOfDate: '2026-05-16',
    marketData: {
      stockRows,
      spyRows,
      qqqRows: spyRows,
      vixRows: series(Array.from({ length: 260 }, (_, index) => 17 + Math.sin(index / 11))),
      sectorRows,
      fundamentals: {
        revenue_growth_yoy: 0.14,
        eps_growth_yoy: 0.18,
        gross_margin: 0.68,
        operating_margin: 0.41,
        net_margin: 0.35,
        free_cash_flow_margin: 0.29,
        debt_to_equity: 0.32,
        current_ratio: 1.8,
        return_on_equity: 0.31,
        return_on_invested_capital: 0.22,
        pe_ratio: 31,
        forward_pe_ratio: 27,
        peg_ratio: 1.8,
        price_to_sales: 11,
        price_to_book: 9,
        earnings_surprise: 0.06,
        analyst_estimate_revision_score: 0.45,
      },
      news: [
        {
          title: 'Microsoft gets analyst upgrade on strong AI demand',
          source: 'Bloomberg',
          published_at: '2026-05-16T08:00:00Z',
          sentiment: 0.7,
          relevance: 0.9,
        },
      ],
      macro: {
        treasury_10y_change: -0.03,
        dollar_index_trend: -0.01,
      },
      providerStatus: {
        bloomberg: 'disconnected',
        market: 'mock',
        news: 'mock',
        fundamentals: 'mock',
      },
    },
  });

  assert.equal(result.ticker, 'MSFT');
  assert.equal(result.horizon, '5d');
  assert.equal(result.prediction_target, 'stock_return_gt_spy_return');
  assert.equal(result.probability_outperform_spy > 0.5, true);
  assert.equal(result.expected_excess_return > 0, true);
  assert.equal(['bullish', 'watchlist', 'neutral', 'bearish', 'avoid'].includes(result.signal), true);
  assert.equal(result.main_drivers.length >= 3, true);
  assert.equal(result.warnings.some((warning) => warning.includes('Bloomberg')), true);
});

test('walk-forward backtest uses only past rows for each rebalance', async () => {
  const predictions = await runWalkForwardBacktest({
    universe: ['AAA', 'BBB'],
    horizon: 5,
    rebalance: 'weekly',
    priceHistoryByTicker: {
      AAA: stockRows,
      BBB: series(Array.from({ length: 260 }, (_, index) => 70 + index * 0.05 - Math.sin(index / 5))),
      SPY: spyRows,
    },
    topN: 1,
    transactionCostBps: 5,
    slippageBps: 5,
  });

  assert.equal(predictions.trades.length > 0, true);
  assert.equal(predictions.trades.every((trade) => trade.feature_end_index < trade.exit_index), true);
  assert.equal(Number.isFinite(predictions.metrics.sharpe_ratio), true);
  assert.equal(Number.isFinite(predictions.metrics.max_drawdown), true);
  assert.equal('hit_rate_by_confidence_bucket' in predictions.metrics, true);
});

test('outperformance route payload validates supported horizons', () => {
  assert.deepEqual(parseOutperformancePayload({ ticker: 'nvda', horizon: '10' }), {
    ticker: 'NVDA',
    horizon: 10,
    as_of_date: undefined,
    risk_tolerance: 'moderate',
  });
  assert.throws(() => parseOutperformancePayload({ ticker: 'NVDA', horizon: 30 }), /horizon/);
});
