import { getQuote } from '../../src/lib/providers/index.js';
import { ok, fail } from '../../src/lib/responseEnvelope.js';

export default async function handler(request, response) {
  try {
    const symbols = ['SPY', 'QQQ', '^VIX'];
    const quotes = await Promise.all(symbols.map((symbol) => getQuote(symbol)));
    return response.status(200).json(ok(Object.fromEntries(symbols.map((symbol, index) => [symbol, quotes[index].data])), {
      source: quotes.map((quote) => quote.source).join(','),
      isDemo: quotes.some((quote) => quote.source === 'demo'),
      warnings: quotes.flatMap((quote) => quote.warnings || []),
    }));
  } catch (error) {
    return response.status(error.status || 500).json(fail(error));
  }
}
