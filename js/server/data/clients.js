import { cleanRows } from '../features/math.js';

export function createCompositeDataClient() {
  const bloomberg = new BloombergDataClient();
  const publicMarket = new PublicMarketDataClient();
  const news = new NewsDataClient();
  const fundamentals = new FundamentalsDataClient();

  return {
    async fetchPredictionDataset({ ticker, asOfDate }) {
      const bloombergStatus = await bloomberg.status();
      const [stockRows, spyRows, qqqRows, vixRows, companyFundamentals, articles] = await Promise.all([
        publicMarket.fetchDailyPrices(ticker, asOfDate),
        publicMarket.fetchDailyPrices('SPY', asOfDate),
        publicMarket.fetchDailyPrices('QQQ', asOfDate),
        publicMarket.fetchDailyPrices('^VIX', asOfDate),
        fundamentals.fetchFundamentals(ticker),
        news.fetchCompanyNews(ticker, asOfDate),
      ]);
      return {
        stockRows,
        spyRows,
        qqqRows,
        vixRows,
        sectorRows: spyRows,
        fundamentals: companyFundamentals,
        news: articles,
        macro: {},
        providerStatus: {
          bloomberg: bloombergStatus.connected ? 'connected' : 'disconnected',
          market: stockRows.length && spyRows.length ? 'ok' : 'failed',
          news: articles.length ? 'ok' : 'degraded',
          fundamentals: Object.keys(companyFundamentals).length ? 'ok' : 'degraded',
        },
      };
    },
    status() {
      return { bloomberg: 'disconnected', market: 'fallback', news: 'fallback', fundamentals: 'fallback' };
    },
  };
}

export class BloombergDataClient {
  async status() {
    return {
      connected: Boolean(process.env.BLOOMBERG_API_ENABLED === 'true' && process.env.BLOOMBERG_HOST),
      transport: 'official-blpapi-only',
      message: 'Bloomberg webpages are never scraped. Configure official BLPAPI access to enable this provider.',
    };
  }
}

export class PublicMarketDataClient {
  async fetchDailyPrices(ticker, asOfDate) {
    const polygonRows = await this.fetchPolygon(ticker, asOfDate);
    if (polygonRows.length) return polygonRows;
    return this.fetchYahoo(ticker, asOfDate);
  }

  async fetchPolygon(ticker, asOfDate) {
    if (!process.env.POLYGON_API_KEY) return [];
    const url = `https://api.polygon.io/v2/aggs/ticker/${encodeURIComponent(ticker)}/range/1/day/2010-01-01/${asOfDate}?adjusted=true&sort=asc&limit=50000&apiKey=${process.env.POLYGON_API_KEY}`;
    const data = await fetchJson(url).catch(() => null);
    return cleanRows(
      (data?.results || []).map((row) => ({
        date: new Date(row.t).toISOString().slice(0, 10),
        open: row.o,
        high: row.h,
        low: row.l,
        close: row.c,
        volume: row.v,
      }))
    );
  }

  async fetchYahoo(ticker, asOfDate) {
    const symbol = ticker === '^VIX' ? '%5EVIX' : encodeURIComponent(ticker);
    const end = Math.floor((new Date(`${asOfDate}T00:00:00Z`).getTime() + 86_400_000) / 1000);
    const start = Math.floor((new Date(`${asOfDate}T00:00:00Z`).getTime() - 1_000 * 86_400_000) / 1000);
    const data = await fetchJson(`https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?period1=${start}&period2=${end}&interval=1d&events=history&includeAdjustedClose=true`).catch(() => null);
    const result = data?.chart?.result?.[0];
    const quote = result?.indicators?.quote?.[0] || {};
    const adjusted = result?.indicators?.adjclose?.[0]?.adjclose || [];
    return cleanRows(
      (result?.timestamp || []).map((timestamp, index) => ({
        date: new Date(timestamp * 1000).toISOString().slice(0, 10),
        open: quote.open?.[index],
        high: quote.high?.[index],
        low: quote.low?.[index],
        close: adjusted[index] ?? quote.close?.[index],
        volume: quote.volume?.[index],
      }))
    );
  }
}

export class NewsDataClient {
  async fetchCompanyNews(ticker, asOfDate) {
    if (process.env.ALPHA_VANTAGE_API_KEY) return this.fetchAlphaVantageNews(ticker, asOfDate);
    return [];
  }

  async fetchAlphaVantageNews(ticker, asOfDate) {
    const from = asOfDate.replaceAll('-', '');
    const data = await fetchJson(`https://www.alphavantage.co/query?function=NEWS_SENTIMENT&tickers=${encodeURIComponent(ticker)}&time_from=${from}T0000&sort=LATEST&limit=50&apikey=${process.env.ALPHA_VANTAGE_API_KEY}`).catch(() => null);
    return (data?.feed || []).map((item) => {
      const tickerSentiment = (item.ticker_sentiment || []).find((entry) => entry.ticker?.toUpperCase() === ticker.toUpperCase());
      return {
        title: item.title,
        source: item.source,
        published_at: alphaTime(item.time_published),
        sentiment: Number(tickerSentiment?.ticker_sentiment_score ?? item.overall_sentiment_score ?? 0),
        relevance: Number(tickerSentiment?.relevance_score ?? 0.7),
      };
    });
  }
}

export class FundamentalsDataClient {
  async fetchFundamentals(ticker) {
    if (!process.env.FMP_API_KEY) return {};
    const [profile, ratios, growth] = await Promise.all([
      fetchJson(`https://financialmodelingprep.com/api/v3/profile/${encodeURIComponent(ticker)}?apikey=${process.env.FMP_API_KEY}`).catch(() => []),
      fetchJson(`https://financialmodelingprep.com/api/v3/ratios-ttm/${encodeURIComponent(ticker)}?apikey=${process.env.FMP_API_KEY}`).catch(() => []),
      fetchJson(`https://financialmodelingprep.com/api/v3/financial-growth/${encodeURIComponent(ticker)}?limit=1&apikey=${process.env.FMP_API_KEY}`).catch(() => []),
    ]);
    const ratio = ratios?.[0] || {};
    const grow = growth?.[0] || {};
    return {
      revenue_growth_yoy: grow.revenueGrowth,
      eps_growth_yoy: grow.epsgrowth,
      gross_margin: ratio.grossProfitMarginTTM,
      operating_margin: ratio.operatingProfitMarginTTM,
      net_margin: ratio.netProfitMarginTTM,
      free_cash_flow_margin: ratio.freeCashFlowOperatingCashFlowRatioTTM,
      debt_to_equity: ratio.debtEquityRatioTTM,
      current_ratio: ratio.currentRatioTTM,
      return_on_equity: ratio.returnOnEquityTTM,
      return_on_invested_capital: ratio.returnOnCapitalEmployedTTM,
      pe_ratio: ratio.peRatioTTM,
      forward_pe_ratio: profile?.[0]?.price && profile?.[0]?.eps ? profile[0].price / profile[0].eps : null,
      peg_ratio: ratio.pegRatioTTM,
      price_to_sales: ratio.priceToSalesRatioTTM,
      price_to_book: ratio.priceToBookRatioTTM,
    };
  }
}

async function fetchJson(url) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);
  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) throw new Error(`Fetch failed ${response.status}`);
    return response.json();
  } finally {
    clearTimeout(timeout);
  }
}

function alphaTime(value) {
  if (!value || value.length < 8) return null;
  return `${value.slice(0, 4)}-${value.slice(4, 6)}-${value.slice(6, 8)}T${value.slice(9, 11) || '00'}:${value.slice(11, 13) || '00'}:00Z`;
}
