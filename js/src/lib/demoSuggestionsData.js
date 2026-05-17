import { generateDemoRankings } from './demoChartData.js';
import { scoreSimilarStocks } from './similarityEngine.js';

export function generateDemoSuggestions(symbol = 'MSFT', base = {}) {
  return scoreSimilarStocks(base, generateDemoRankings().filter((row) => row.ticker !== symbol)).slice(0, 6);
}
