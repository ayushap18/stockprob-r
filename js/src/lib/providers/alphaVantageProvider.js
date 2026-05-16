import { providerFail, providerOk } from './demoProvider.js';

export async function fetchAlphaVantageNews(symbol) {
  const started = Date.now();
  if (!process.env.ALPHA_VANTAGE_API_KEY) return providerFail(new Error('ALPHA_VANTAGE_API_KEY not configured'), 'alpha_vantage', 0);
  try {
    const url = `https://www.alphavantage.co/query?function=NEWS_SENTIMENT&tickers=${encodeURIComponent(symbol)}&sort=LATEST&limit=50&apikey=${process.env.ALPHA_VANTAGE_API_KEY}`;
    const response = await fetch(url, { headers: { 'User-Agent': 'StockProb-R/1.0' } });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    return providerOk(data.feed || [], 'alpha_vantage', Date.now() - started);
  } catch (error) {
    return providerFail(error, 'alpha_vantage', Date.now() - started);
  }
}
