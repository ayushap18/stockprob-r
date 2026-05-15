import { calculateTechnicalFeatures } from '../features/technical.js';
import { calculateBacktestMetrics } from './metrics.js';

export async function runWalkForwardBacktest({
  universe = [],
  horizon = 5,
  rebalance = 'weekly',
  priceHistoryByTicker = {},
  topN = 5,
  transactionCostBps = 5,
  slippageBps = 5,
} = {}) {
  if (![5, 10, 20].includes(Number(horizon))) throw new Error('horizon must be 5, 10, or 20');
  const spyRows = priceHistoryByTicker.SPY || [];
  const step = rebalance === 'daily' ? 1 : 5;
  const minLookback = 220;
  const maxLength = Math.min(...universe.map((ticker) => priceHistoryByTicker[ticker]?.length || 0), spyRows.length);
  const trades = [];
  const equityCurve = [{ date: spyRows[minLookback]?.date || null, equity: 1 }];
  const cost = (transactionCostBps + slippageBps) / 10_000;

  for (let index = minLookback; index + Number(horizon) < maxLength; index += step) {
    const candidates = universe
      .map((ticker) => {
        const rows = priceHistoryByTicker[ticker] || [];
        const pastRows = rows.slice(0, index + 1);
        const pastSpy = spyRows.slice(0, index + 1);
        const features = calculateTechnicalFeatures({ stockRows: pastRows, spyRows: pastSpy, sectorRows: pastSpy });
        return {
          ticker,
          alpha_score: 0.65 * (features.momentum_score ?? 0.5) + 0.2 * (features.mean_reversion_score ?? 0.5) + 0.15 * (1 - Math.min(1, features.volatility_20d ?? 0.5)),
          confidence: Math.min(0.8, 0.45 + Math.abs((features.momentum_score ?? 0.5) - 0.5)),
          market_regime: features.return_20d > 0 ? 'bullish' : 'sideways',
          feature_end_index: index,
        };
      })
      .sort((first, second) => second.alpha_score - first.alpha_score)
      .slice(0, topN);

    const periodTrades = [];
    for (const candidate of candidates) {
      const rows = priceHistoryByTicker[candidate.ticker];
      const entry = rows[index].close;
      const exitIndex = index + Number(horizon);
      const exit = rows[exitIndex].close;
      const spyEntry = spyRows[index].close;
      const spyExit = spyRows[exitIndex].close;
      const grossReturn = entry > 0 ? exit / entry - 1 : 0;
      const spyReturn = spyEntry > 0 ? spyExit / spyEntry - 1 : 0;
      periodTrades.push({
        ticker: candidate.ticker,
        entry_date: rows[index].date,
        exit_date: rows[exitIndex].date,
        entry_index: index,
        exit_index: exitIndex,
        feature_end_index: candidate.feature_end_index,
        gross_return: grossReturn,
        net_return: grossReturn - cost,
        spy_return: spyReturn,
        excess_return: grossReturn - spyReturn - cost,
        alpha_score: candidate.alpha_score,
        confidence: candidate.confidence,
        market_regime: candidate.market_regime,
      });
    }

    const portfolioReturn = periodTrades.reduce((total, trade) => total + trade.net_return, 0) / Math.max(1, periodTrades.length);
    equityCurve.push({
      date: spyRows[index + Number(horizon)].date,
      equity: equityCurve.at(-1).equity * (1 + portfolioReturn),
    });
    trades.push(...periodTrades);
  }

  return {
    universe,
    horizon: `${Number(horizon)}d`,
    rebalance,
    top_n: topN,
    trades,
    equity_curve: equityCurve,
    metrics: calculateBacktestMetrics({ trades, equityCurve, benchmarkReturns: trades.map((trade) => trade.spy_return) }),
    warnings: ['Backtest uses walk-forward features only; results depend on available historical universe and provider data'],
  };
}
