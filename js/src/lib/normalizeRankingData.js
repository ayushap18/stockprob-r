import { generateDemoRankings } from './demoChartData.js';

export function normalizeRankingData(raw = {}) {
  const rows = Array.isArray(raw?.rankings) ? raw.rankings : Array.isArray(raw?.data?.rankings) ? raw.data.rankings : Array.isArray(raw) ? raw : generateDemoRankings();
  return rows.map((row, index) => ({
    rank: Number(row.rank) || index + 1,
    symbol: String(row.symbol || row.ticker || '').toUpperCase(),
    ticker: String(row.ticker || row.symbol || '').toUpperCase(),
    company: row.company || row.name || `${row.symbol || row.ticker || 'US'} Corporation`,
    sector: row.sector || 'Unknown',
    price: num(row.price, 80 + index * 18),
    probability: clamp(row.probability ?? row.probabilityOutperformSpy ?? row.probability_outperform_spy),
    expectedReturn: num(row.expectedReturn ?? row.expected_return, 0),
    expectedExcessReturn: num(row.expectedExcessReturn ?? row.expected_excess_return, 0),
    past1mReturn: num(row.past1mReturn ?? row.return1m, 0.01 - index * 0.001),
    past3mReturn: num(row.past3mReturn ?? row.return3m, 0.035 - index * 0.002),
    past1yReturn: num(row.past1yReturn ?? row.return1y, 0.12 - index * 0.005),
    risk: clamp(row.risk ?? row.riskScore),
    confidence: clamp(row.confidence),
    alphaScore: clamp(row.alphaScore ?? row.alpha),
    similarityScore: clamp(row.similarityScore ?? (0.86 - index * 0.045)),
    providerStatus: row.providerStatus || row.provider || 'demo',
    freshness: row.freshness || row.asOf || 'demo',
  })).filter((row) => row.symbol || row.ticker);
}

export function filterRankings(rows, { query = '', sector = 'All', minProbability = 0, maxRisk = 1 } = {}) {
  const q = query.trim().toLowerCase();
  return rows.filter((row) => {
    const matchesQuery = !q || [row.symbol, row.company, row.sector].some((value) => String(value).toLowerCase().includes(q));
    const matchesSector = sector === 'All' || row.sector === sector;
    return matchesQuery && matchesSector && row.probability >= Number(minProbability) && row.risk <= Number(maxRisk);
  });
}

function num(value, fallback = 0) {
  return Number.isFinite(Number(value)) ? Number(value) : fallback;
}

function clamp(value) {
  return Math.max(0, Math.min(1, num(value)));
}
