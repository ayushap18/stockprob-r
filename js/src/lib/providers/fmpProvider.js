import { providerFail, providerOk } from './demoProvider.js';

export async function fetchFmpFundamentals(symbol) {
  const started = Date.now();
  if (!process.env.FMP_API_KEY) return providerFail(new Error('FMP_API_KEY not configured'), 'fmp', 0);
  try {
    const [profile, ratios, growth] = await Promise.all([
      fetchJson(`https://financialmodelingprep.com/stable/profile?symbol=${encodeURIComponent(symbol)}&apikey=${process.env.FMP_API_KEY}`),
      fetchJson(`https://financialmodelingprep.com/stable/ratios-ttm?symbol=${encodeURIComponent(symbol)}&apikey=${process.env.FMP_API_KEY}`),
      fetchJson(`https://financialmodelingprep.com/stable/financial-growth?symbol=${encodeURIComponent(symbol)}&apikey=${process.env.FMP_API_KEY}`),
    ]);
    return providerOk({ profile: profile?.[0] || {}, ratios: ratios?.[0] || {}, growth: growth?.[0] || {} }, 'fmp', Date.now() - started);
  } catch (error) {
    return providerFail(error, 'fmp', Date.now() - started);
  }
}

async function fetchJson(url) {
  const response = await fetch(url, { headers: { 'User-Agent': 'StockProb-R/1.0' } });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.json();
}
