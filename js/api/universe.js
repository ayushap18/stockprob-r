import { searchListedUniverse } from '../server/data/universe.js';

export default async function handler(req, res) {
  if (req.method && req.method !== 'GET') {
    return res.status(405).json({ error: 'method_not_allowed', message: 'Use GET /api/universe?q=MSFT&limit=10' });
  }

  try {
    const payload = await searchListedUniverse({
      q: req.query?.q || '',
      limit: req.query?.limit || 25,
      exchange: req.query?.exchange,
      includeEtfs: req.query?.include_etfs !== 'false',
      client: req.universeClient,
    });
    res.setHeader?.('Cache-Control', 's-maxage=86400, stale-while-revalidate=604800');
    return res.status(200).json(payload);
  } catch (error) {
    return res.status(503).json({
      error: 'universe_unavailable',
      message: error.message,
      results: [],
      coverage: 'unavailable',
    });
  }
}
