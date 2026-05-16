import { PublicMarketDataClient } from '../server/data/clients.js';

export default async function handler(request, response) {
  if (request.method && request.method !== 'GET') {
    return response.status(405).json({ error: 'method_not_allowed', message: 'Use GET /api/price?ticker=AAPL' });
  }
  try {
    response.setHeader?.('Cache-Control', 's-maxage=300, stale-while-revalidate=900');
    const ticker = String(request.query?.ticker || 'AAPL').trim().toUpperCase();
    if (!/^[A-Z][A-Z0-9.-]{0,14}$/.test(ticker)) return response.status(400).json({ error: 'INVALID_TICKER', message: 'Ticker must be a US listed symbol' });
    const asOfDate = String(request.query?.as_of_date || request.query?.asOfDate || new Date().toISOString().slice(0, 10));
    const limit = Math.min(1500, Math.max(30, Number(request.query?.limit || 520)));
    const client = request.marketClient || new PublicMarketDataClient();
    const rows = await client.fetchDailyPrices(ticker, asOfDate);
    if (!rows.length) {
      return response.status(503).json({ error: 'PROVIDER_FAILED', message: 'No public price history returned for ticker', ticker });
    }
    return response.status(200).json({
      ticker,
      as_of_date: asOfDate,
      source: client.lastSource || 'public-market',
      rows: rows.slice(-limit),
      warnings: client.lastWarning ? [client.lastWarning] : [],
    });
  } catch (error) {
    return response.status(error.status || 500).json({
      error: error.code || 'PROVIDER_FAILED',
      message: error.message || 'Price history unavailable',
    });
  }
}
