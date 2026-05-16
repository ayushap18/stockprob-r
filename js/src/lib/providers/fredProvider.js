import { providerFail, providerOk } from './demoProvider.js';

export async function fetchFredMacro() {
  const started = Date.now();
  if (!process.env.FRED_API_KEY) return providerFail(new Error('FRED_API_KEY not configured'), 'fred', 0);
  try {
    const url = `https://api.stlouisfed.org/fred/series/observations?series_id=DGS10&api_key=${process.env.FRED_API_KEY}&file_type=json&sort_order=desc&limit=20`;
    const response = await fetch(url, { headers: { 'User-Agent': 'StockProb-R/1.0' } });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    return providerOk(data.observations || [], 'fred', Date.now() - started);
  } catch (error) {
    return providerFail(error, 'fred', Date.now() - started);
  }
}
