export function scoreSimilarStocks(base = {}, candidates = []) {
  return candidates.map((row, index) => {
    const sectorMatch = base.sector && row.sector === base.sector ? 1 : 0.35;
    const volatilitySimilarity = similarity(base.risk, row.risk);
    const momentumSimilarity = similarity(base.momentumScore || base.probability, row.probability);
    const qualitySimilarity = similarity(base.confidence, row.confidence);
    const riskReturnSimilarity = similarity((base.expectedReturn || 0) - (base.risk || 0), (row.expectedReturn || 0) - (row.risk || 0));
    const confidenceAdvantage = Math.max(0, Number(row.confidence || 0) - Number(base.confidence || 0));
    const composite = 0.24 * sectorMatch + 0.18 * volatilitySimilarity + 0.18 * momentumSimilarity + 0.14 * qualitySimilarity + 0.18 * riskReturnSimilarity + 0.08 * confidenceAdvantage;
    return {
      ...row,
      similarityScore: Math.max(0, Math.min(1, composite)),
      similarityReason: reasonFor(row, base, index),
    };
  }).sort((a, b) => b.similarityScore - a.similarityScore);
}

function similarity(a, b) {
  const left = Number.isFinite(Number(a)) ? Number(a) : 0.5;
  const right = Number.isFinite(Number(b)) ? Number(b) : 0.5;
  return Math.max(0, 1 - Math.abs(left - right));
}

function reasonFor(row, base, index) {
  if (row.sector === base.sector && row.expectedReturn > base.expectedReturn) return 'Same sector, higher expected return';
  if (row.risk < base.risk && row.confidence >= base.confidence) return 'Lower risk, better confidence';
  if (row.confidence > base.confidence) return 'Higher confidence than selected ticker';
  if (row.probability > base.probability) return 'Stronger momentum profile';
  return ['Similar risk/return profile', 'Similar market-cap bucket', 'Better risk-adjusted expected return'][index % 3];
}
