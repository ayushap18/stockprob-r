import React from 'react';
import MetricCard from '../ui/MetricCard.jsx';

export default function DashboardMetricStrip({ snapshot, controls, simulation }) {
  const quote = snapshot?.quote || {};
  const probabilities = snapshot?.probabilities || {};
  const summary = simulation?.summary || {};
  return (
    <section className="investment-grid kpi-strip">
      <MetricCard label="Price" value={money(quote.price)} caption={signedPct((quote.changePercent || 0) / 100)} tone={Number(quote.changePercent) >= 0 ? 'bull' : 'bear'} />
      <MetricCard label={`P(out ${controls.benchmark})`} value={pct(probabilities.probabilityOutperformSpy)} caption={`${controls.horizonDays}D`} tone={probabilities.probabilityOutperformSpy >= 0.55 ? 'bull' : probabilities.probabilityOutperformSpy < 0.48 ? 'bear' : 'warn'} />
      <MetricCard label="P(profit)" value={pct(summary.probabilityProfit ?? probabilities.probabilityProfit)} caption="Monte Carlo" tone={(summary.probabilityProfit ?? 0) >= 0.55 ? 'bull' : 'warn'} />
      <MetricCard label={`P(gain > ${pct(controls.gainThreshold)})`} value={pct(summary.probabilityGainGtThreshold)} caption="threshold" tone={(summary.probabilityGainGtThreshold ?? 0) > 0.35 ? 'bull' : 'warn'} />
      <MetricCard label={`P(loss < ${signedPct(controls.lossThreshold)})`} value={pct(summary.probabilityLossGtThreshold)} caption="threshold" tone={(summary.probabilityLossGtThreshold ?? 0) < 0.25 ? 'bull' : 'bear'} />
      <MetricCard label="Expected" value={signedPct(probabilities.expectedReturn)} caption={controls.expectedReturnMode} tone={probabilities.expectedReturn >= 0 ? 'bull' : 'bear'} />
      <MetricCard label="Expected Move" value={pct(summary.expectedMove)} caption={controls.volatilityMode} tone="warn" />
      <MetricCard label="Risk" value={pct(probabilities.riskScore)} caption="lower is better" tone={probabilities.riskScore < 0.38 ? 'bull' : probabilities.riskScore > 0.65 ? 'bear' : 'warn'} />
      <MetricCard label="Confidence" value={pct(probabilities.confidence)} caption={probabilities.modelVersion || 'baseline'} tone={probabilities.confidence > 0.62 ? 'bull' : 'warn'} />
      <MetricCard label="Momentum" value={pct(probabilities.momentumScore)} caption="factor score" tone={probabilities.momentumScore > 0.58 ? 'bull' : 'warn'} />
      <MetricCard label="Quality" value={pct(probabilities.qualityScore)} caption="fundamental" tone={probabilities.qualityScore > 0.58 ? 'bull' : 'warn'} />
      <MetricCard label="Freshness" value={snapshot?.quote?.marketState || 'fallback'} caption={controls.dataMode} tone={snapshot?.quote?.marketState === 'open' ? 'bull' : 'warn'} />
    </section>
  );
}

function money(value) {
  return Number.isFinite(Number(value)) ? `$${Number(value).toFixed(2)}` : 'n/a';
}

function pct(value) {
  return Number.isFinite(Number(value)) ? `${Math.round(Number(value) * 100)}%` : 'n/a';
}

function signedPct(value) {
  if (!Number.isFinite(Number(value))) return 'n/a';
  const n = Number(value) * 100;
  return `${n >= 0 ? '+' : ''}${n.toFixed(1)}%`;
}
