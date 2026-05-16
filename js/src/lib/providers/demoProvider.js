import { generateDemoMacroRegime, generateDemoPriceData, generateDemoProviderHealth } from '../demoChartData.js';

export function demoQuote(symbol = 'MSFT') {
  const rows = generateDemoPriceData(symbol);
  const last = rows.at(-1);
  const previous = rows.at(-2) || last;
  const change = last.close - previous.close;
  return providerOk({
    symbol,
    price: last.close,
    change,
    changePercent: previous.close ? (change / previous.close) * 100 : 0,
    volume: last.volume,
    bid: Number((last.close - 0.01).toFixed(2)),
    ask: Number((last.close + 0.01).toFixed(2)),
    marketState: 'unknown',
  }, 'demo', 0, ['Demo quote generated deterministically.']);
}

export function demoOhlcv(symbol = 'MSFT', limit = 260) {
  return providerOk(generateDemoPriceData(symbol).slice(-limit), 'demo', 0, ['Demo OHLCV generated deterministically.']);
}

export function demoProviderHealth() {
  return providerOk(generateDemoProviderHealth(), 'demo', 0, ['Demo provider health generated deterministically.']);
}

export function demoMacro() {
  return providerOk(generateDemoMacroRegime(), 'demo', 0, ['Demo macro regime generated deterministically.']);
}

export function providerOk(data, source, latencyMs = 0, warnings = []) {
  return { ok: true, data, source, latencyMs, warnings, error: null };
}

export function providerFail(error, source, latencyMs = 0, warnings = []) {
  return { ok: false, data: null, source, latencyMs, warnings, error: error?.message || String(error || 'provider failed') };
}
