import { clamp, finite, mean, round } from './math.js';

const SOURCE_WEIGHTS = {
  bloomberg: 1,
  reuters: 0.95,
  'wall street journal': 0.92,
  wsj: 0.92,
  cnbc: 0.82,
  'financial times': 0.9,
  marketwatch: 0.72,
  benzinga: 0.68,
  'seeking alpha': 0.58,
};

const EVENT_PATTERNS = [
  ['earnings_report', /\bearnings|quarterly results|reports results\b/i],
  ['earnings_beat', /\bbeats?|tops estimates|above expectations\b/i],
  ['earnings_miss', /\bmisses|below expectations|falls short\b/i],
  ['analyst_upgrade', /\bupgrade|raises rating|outperform rating\b/i],
  ['analyst_downgrade', /\bdowngrade|cuts rating|underperform rating\b/i],
  ['lawsuit', /\blawsuit|sued|legal action\b/i],
  ['sec_investigation', /\bSEC investigation|subpoena|probe\b/i],
  ['product_launch', /\blaunches|unveils|introduces\b/i],
  ['merger_acquisition', /\bacquires|merger|takeover|buyout\b/i],
  ['layoffs', /\blayoffs?|job cuts|workforce reduction\b/i],
  ['ceo_cfo_change', /\bCEO|CFO|chief executive|chief financial\b.*\b(resigns|steps down|appointed|named)\b/i],
  ['guidance_raise', /\braises guidance|guidance raise|boosts forecast\b/i],
  ['guidance_cut', /\bcuts guidance|lowers forecast|guidance cut\b/i],
  ['macro_event', /\bfed|inflation|jobs report|treasury yield|cpi\b/i],
  ['sector_event', /\bsector|industry|semiconductor|software|banking|energy\b/i],
];

export function calculateNewsFeatures({ ticker, asOfDate = new Date().toISOString(), articles = [] }) {
  const anchor = new Date(asOfDate);
  const weightedArticles = articles.map((article) => {
    const sentiment = normalizeSentiment(article.sentiment ?? article.score ?? lexicalSentiment(article.title || article.headline || ''));
    const providerWeight = sourceWeight(article.source);
    const hoursOld = Math.max(0, (anchor.getTime() - new Date(article.published_at || article.publishedAt || asOfDate).getTime()) / 3_600_000);
    const recencyWeight = 0.5 ** (hoursOld / 24);
    const relevanceWeight = clamp(article.relevance ?? tickerRelevance(ticker, article));
    const score = sentiment * providerWeight * recencyWeight * relevanceWeight;
    const title = article.title || article.headline || '';
    return {
      title,
      source: article.source || 'unknown',
      published_at: article.published_at || article.publishedAt || null,
      sentiment: round(sentiment, 4),
      label: sentiment > 0.15 ? 'positive' : sentiment < -0.15 ? 'negative' : 'neutral',
      source_weight: round(providerWeight, 4),
      recency_weight: round(recencyWeight, 4),
      relevance_weight: round(relevanceWeight, 4),
      news_score: round(score, 6),
      event_tags: detectEventTags(title),
    };
  });

  const scores = weightedArticles.map((article) => article.news_score).filter(finite);
  const labels = weightedArticles.map((article) => article.label);
  const events = [...new Set(weightedArticles.flatMap((article) => article.event_tags))];
  const sentiment24 = weightedAverageForHours(weightedArticles, anchor, 24);
  const sentiment3d = weightedAverageForHours(weightedArticles, anchor, 72);
  const sentiment7d = weightedAverageForHours(weightedArticles, anchor, 168);

  return {
    news_sentiment_score: round(clamp((mean(scores) ?? 0) * 2 + 0.5), 4),
    raw_news_score: round(mean(scores) ?? 0, 6),
    avg_sentiment_24h: round(sentiment24, 4),
    avg_sentiment_3d: round(sentiment3d, 4),
    avg_sentiment_7d: round(sentiment7d, 4),
    news_volume: weightedArticles.length,
    positive_news_ratio: round(labels.length ? labels.filter((label) => label === 'positive').length / labels.length : 0, 4),
    negative_news_ratio: round(labels.length ? labels.filter((label) => label === 'negative').length / labels.length : 0, 4),
    neutral_news_ratio: round(labels.length ? labels.filter((label) => label === 'neutral').length / labels.length : 0, 4),
    event_importance_score: round(eventImportance(events, weightedArticles.length), 4),
    recency_weighted_sentiment_score: round(mean(weightedArticles.map((article) => article.sentiment * article.recency_weight)) ?? 0, 6),
    source_weighted_sentiment_score: round(mean(weightedArticles.map((article) => article.sentiment * article.source_weight)) ?? 0, 6),
    relevance_weighted_sentiment_score: round(mean(weightedArticles.map((article) => article.sentiment * article.relevance_weight)) ?? 0, 6),
    event_tags: events,
    recent_headlines: weightedArticles.slice(0, 10).map((article) => ({
      title: article.title,
      source: article.source,
      published_at: article.published_at,
      sentiment_label: article.label,
      score: article.news_score,
      event_tags: article.event_tags,
    })),
    weighted_articles: weightedArticles,
  };
}

export function detectEventTags(text) {
  return EVENT_PATTERNS.filter(([, pattern]) => pattern.test(text)).map(([tag]) => tag);
}

function sourceWeight(source = '') {
  const normalized = String(source).toLowerCase();
  return Object.entries(SOURCE_WEIGHTS).find(([key]) => normalized.includes(key))?.[1] ?? 0.55;
}

function tickerRelevance(ticker, article) {
  const text = `${article.title || ''} ${article.summary || ''} ${(article.tickers || []).join(' ')}`.toUpperCase();
  if (ticker && text.includes(String(ticker).toUpperCase())) return 1;
  return 0.7;
}

function normalizeSentiment(value) {
  if (!finite(value)) return 0;
  const number = Number(value);
  if (number >= -1 && number <= 1) return number;
  return clamp(number / 100, -1, 1);
}

function weightedAverageForHours(articles, anchor, hours) {
  const filtered = articles.filter((article) => {
    if (!article.published_at) return false;
    return (anchor.getTime() - new Date(article.published_at).getTime()) / 3_600_000 <= hours;
  });
  return mean(filtered.map((article) => article.news_score)) ?? 0;
}

function eventImportance(events, volume) {
  const highImpact = new Set(['earnings_beat', 'earnings_miss', 'analyst_upgrade', 'analyst_downgrade', 'sec_investigation', 'guidance_raise', 'guidance_cut', 'merger_acquisition']);
  const highCount = events.filter((event) => highImpact.has(event)).length;
  return clamp(0.12 * events.length + 0.15 * highCount + Math.min(volume, 20) / 100);
}

function lexicalSentiment(text) {
  const positives = ['beat', 'beats', 'upgrade', 'raises', 'strong', 'growth', 'surge', 'record', 'launch', 'wins', 'positive'];
  const negatives = ['miss', 'misses', 'downgrade', 'lawsuit', 'probe', 'cuts', 'weak', 'falls', 'layoff', 'negative'];
  const normalized = text.toLowerCase();
  const pos = positives.filter((word) => normalized.includes(word)).length;
  const neg = negatives.filter((word) => normalized.includes(word)).length;
  return clamp((pos - neg) / Math.max(3, pos + neg), -1, 1);
}
