export default function SummaryCards({ probabilities = {} }) {
  const cards = [
    ['P(outperform SPY)', pct(probabilities.probabilityOutperformSpy)],
    ['P(profit)', pct(probabilities.probabilityProfit)],
    ['Expected return', signed(probabilities.expectedReturn)],
    ['Excess vs SPY', signed(probabilities.expectedExcessReturn)],
    ['Risk score', pct(probabilities.riskScore)],
    ['Confidence', pct(probabilities.confidence)],
  ];
  return <section className="analytics-kpis connected-summary">{cards.map(([label, value]) => <article key={label}><span>{label}</span><strong>{value}</strong></article>)}</section>;
}

function pct(value) {
  return Number.isFinite(Number(value)) ? `${Math.round(Number(value) * 100)}%` : 'n/a';
}

function signed(value) {
  if (!Number.isFinite(Number(value))) return 'n/a';
  const n = Number(value) * 100;
  return `${n >= 0 ? '+' : ''}${n.toFixed(1)}%`;
}
