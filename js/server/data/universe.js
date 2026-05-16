import { cachedFetchText, safeProviderCall } from './resilience.js';

const NASDAQ_LISTED_URL = 'https://www.nasdaqtrader.com/dynamic/SymDir/nasdaqlisted.txt';
const OTHER_LISTED_URL = 'https://www.nasdaqtrader.com/dynamic/SymDir/otherlisted.txt';
const MAX_LIMIT = 250;

const EXCHANGE_NAMES = {
  A: 'NYSE American',
  N: 'NYSE',
  P: 'NYSE Arca',
  Z: 'Cboe BZX',
  V: 'IEX',
};

const FALLBACK_UNIVERSE = [
  ['AAPL', 'Apple Inc. Common Stock', 'NASDAQ', 'stock'],
  ['MSFT', 'Microsoft Corporation Common Stock', 'NASDAQ', 'stock'],
  ['NVDA', 'NVIDIA Corporation Common Stock', 'NASDAQ', 'stock'],
  ['TSLA', 'Tesla Inc. Common Stock', 'NASDAQ', 'stock'],
  ['AMZN', 'Amazon.com Inc. Common Stock', 'NASDAQ', 'stock'],
  ['GOOGL', 'Alphabet Inc. Class A Common Stock', 'NASDAQ', 'stock'],
  ['META', 'Meta Platforms Inc. Class A Common Stock', 'NASDAQ', 'stock'],
  ['BRK.B', 'Berkshire Hathaway Inc. Class B', 'NYSE', 'stock'],
  ['JPM', 'JPMorgan Chase & Co. Common Stock', 'NYSE', 'stock'],
  ['XOM', 'Exxon Mobil Corporation Common Stock', 'NYSE', 'stock'],
  ['UNH', 'UnitedHealth Group Incorporated Common Stock', 'NYSE', 'stock'],
  ['SPY', 'SPDR S&P 500 ETF Trust', 'NYSE Arca', 'etf'],
  ['QQQ', 'Invesco QQQ Trust Series 1', 'NASDAQ', 'etf'],
].map(([symbol, name, exchange, type]) => ({ symbol, name, exchange, type, source: 'fallback' }));

export async function fetchListedUniverse({ client, includeFallback = true } = {}) {
  if (client?.fetchUniverse) {
    const result = await safeProviderCall({
      name: 'Custom listed universe',
      fallback: [],
      retries: 0,
      task: () => client.fetchUniverse(),
    });
    const symbols = normalizeUniverse(result.value);
    const universe = symbols.length || !includeFallback ? symbols : FALLBACK_UNIVERSE;
    return {
      symbols: universe,
      coverage: symbols.length ? 'nasdaq-trader-listed-us-securities' : 'fallback-major-us-securities',
      provider_status: { universe: result.status },
      warnings: [result.warning, symbols.length ? null : 'Listed-symbol universe unavailable; using fallback seed universe'].filter(Boolean),
    };
  }

  const [nasdaqResult, otherResult] = await Promise.all([
    safeProviderCall({
      name: 'NASDAQ listed universe',
      fallback: '',
      retries: 1,
      task: () => cachedFetchText(NASDAQ_LISTED_URL, { ttlMs: 86_400_000, timeoutMs: 8_000, retries: 1 }),
    }),
    safeProviderCall({
      name: 'Other listed universe',
      fallback: '',
      retries: 1,
      task: () => cachedFetchText(OTHER_LISTED_URL, { ttlMs: 86_400_000, timeoutMs: 8_000, retries: 1 }),
    }),
  ]);

  const parsed = dedupeUniverse([...parseNasdaqListed(nasdaqResult.value), ...parseOtherListed(otherResult.value)]);
  const universe = parsed.length || !includeFallback ? parsed : FALLBACK_UNIVERSE;
  const partialCoverage = parsed.length && [nasdaqResult.status, otherResult.status].some((status) => status !== 'ok');
  return {
    symbols: universe,
    coverage: parsed.length ? (partialCoverage ? 'partial-nasdaq-trader-listed-us-securities' : 'nasdaq-trader-listed-us-securities') : 'fallback-major-us-securities',
    provider_status: {
      nasdaq_listed: nasdaqResult.status,
      other_listed: otherResult.status,
    },
    warnings: [nasdaqResult.warning, otherResult.warning, parsed.length ? null : 'Listed-symbol universe unavailable; using fallback seed universe'].filter(Boolean),
  };
}

export function parseNasdaqListed(text = '') {
  return parsePipeRows(text)
    .filter((row) => isTradableSymbol(row.Symbol) && row['Test Issue'] !== 'Y')
    .map((row) => ({
      symbol: normalizeSymbol(row.Symbol),
      name: cleanName(row['Security Name']),
      exchange: 'NASDAQ',
      type: row.ETF === 'Y' ? 'etf' : 'stock',
      market_category: row['Market Category'] || null,
      source: 'nasdaq-trader',
    }));
}

export function parseOtherListed(text = '') {
  return parsePipeRows(text)
    .filter((row) => isTradableSymbol(row['ACT Symbol']) && row['Test Issue'] !== 'Y')
    .map((row) => ({
      symbol: normalizeSymbol(row['ACT Symbol']),
      name: cleanName(row['Security Name']),
      exchange: EXCHANGE_NAMES[row.Exchange] || row.Exchange || 'Other',
      type: row.ETF === 'Y' ? 'etf' : 'stock',
      market_category: row.Exchange || null,
      source: 'nasdaq-trader',
    }));
}

export function searchUniverse(universeOrPayload, query = '', options = {}) {
  const universe = Array.isArray(universeOrPayload) ? universeOrPayload : universeOrPayload?.symbols || [];
  const normalizedQuery = String(query || '').trim().toUpperCase();
  const limit = clampLimit(options.limit);
  const includeEtfs = options.includeEtfs !== false;
  const exchange = String(options.exchange || '').trim().toUpperCase();

  const filtered = normalizeUniverse(universe).filter((security) => {
    if (!includeEtfs && security.type === 'etf') return false;
    if (exchange && security.exchange.toUpperCase() !== exchange) return false;
    if (!normalizedQuery) return true;
    return security.symbol.includes(normalizedQuery) || security.name.toUpperCase().includes(normalizedQuery);
  });

  return filtered
    .sort((first, second) => scoreSecurity(second, normalizedQuery) - scoreSecurity(first, normalizedQuery) || first.symbol.localeCompare(second.symbol))
    .slice(0, limit);
}

export async function searchListedUniverse({ q = '', limit = 25, includeEtfs = true, exchange, client } = {}) {
  const payload = await fetchListedUniverse({ client });
  const results = searchUniverse(payload.symbols, q, { limit, includeEtfs, exchange });
  return {
    query: String(q || ''),
    count: results.length,
    total_universe: payload.symbols.length,
    coverage: payload.coverage,
    provider_status: payload.provider_status,
    warnings: payload.warnings,
    results,
  };
}

function parsePipeRows(text) {
  const lines = String(text || '').split(/\r?\n/).filter((line) => line && !line.startsWith('File Creation Time'));
  if (lines.length < 2) return [];
  const headers = lines[0].split('|');
  return lines.slice(1).map((line) => {
    const values = line.split('|');
    return Object.fromEntries(headers.map((header, index) => [header, values[index] ?? '']));
  });
}

function normalizeUniverse(rows = []) {
  return dedupeUniverse(
    rows
      .filter((row) => row?.symbol)
      .map((row) => ({
        symbol: normalizeSymbol(row.symbol),
        name: cleanName(row.name || row.security_name || row.description || row.symbol),
        exchange: row.exchange || 'Other',
        type: row.type || row.asset_type || 'stock',
        source: row.source || 'custom',
      }))
  );
}

function dedupeUniverse(rows) {
  const seen = new Map();
  for (const row of rows) {
    if (!row.symbol || seen.has(row.symbol)) continue;
    seen.set(row.symbol, row);
  }
  return [...seen.values()];
}

function scoreSecurity(security, query) {
  if (!query) return security.type === 'stock' ? 2 : 1;
  const symbol = security.symbol.toUpperCase();
  const name = security.name.toUpperCase();
  if (symbol === query) return 100;
  if (symbol.startsWith(query)) return 80;
  if (name.startsWith(query)) return 60;
  if (symbol.includes(query)) return 40;
  if (name.includes(query)) return 20;
  return 0;
}

function normalizeSymbol(symbol) {
  return String(symbol || '').trim().replace('/', '.').toUpperCase();
}

function isTradableSymbol(symbol) {
  const normalized = normalizeSymbol(symbol);
  return Boolean(normalized && !normalized.includes('$') && !normalized.includes('^'));
}

function cleanName(name) {
  return String(name || '').replace(/\s+/g, ' ').trim();
}

function clampLimit(limit) {
  const number = Number(limit);
  if (!Number.isFinite(number)) return 25;
  return Math.max(1, Math.min(MAX_LIMIT, Math.trunc(number)));
}
