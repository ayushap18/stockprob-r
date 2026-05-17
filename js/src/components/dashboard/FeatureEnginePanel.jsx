import React from 'react';
import { FeatureImportanceChart, FundamentalBreakdownChart, MacroRegimeChart, NewsSentimentChart, TechnicalBreakdownChart } from '../charts/index.js';
import ChartCard from '../ui/ChartCard.jsx';

export default function FeatureEnginePanel({ snapshot, predictionView, isDemo, onZoom }) {
  return (
    <section className="investment-grid three" style={{ marginTop: 10 }}>
      <ChartCard title="Feature Importance" caption="Weighted model drivers" onExpand={() => onZoom?.({ title: 'Feature Importance', caption: 'Weighted model drivers', content: <FeatureImportanceChart data={snapshot.features} isDemo={isDemo} /> })}><FeatureImportanceChart data={snapshot.features} isDemo={isDemo} /></ChartCard>
      <ChartCard title="Technical Breakdown" caption="Momentum / beta / vol" onExpand={() => onZoom?.({ title: 'Technical Breakdown', caption: 'Momentum / beta / vol', content: <TechnicalBreakdownChart prediction={predictionView} isDemo={isDemo} /> })}><TechnicalBreakdownChart prediction={predictionView} isDemo={isDemo} /></ChartCard>
      <ChartCard title="Fundamental Breakdown" caption="Quality / valuation" onExpand={() => onZoom?.({ title: 'Fundamental Breakdown', caption: 'Quality / valuation', content: <FundamentalBreakdownChart prediction={predictionView} isDemo={isDemo} /> })}><FundamentalBreakdownChart prediction={predictionView} isDemo={isDemo} /></ChartCard>
      <ChartCard title="Sentiment Breakdown" caption="News / filings" onExpand={() => onZoom?.({ title: 'Sentiment Breakdown', caption: 'News / filings', content: <NewsSentimentChart prediction={snapshot.probabilities} trend={snapshot.sentiment} isDemo={isDemo} /> })}><NewsSentimentChart prediction={snapshot.probabilities} trend={snapshot.sentiment} isDemo={isDemo} /></ChartCard>
      <ChartCard title="Macro Breakdown" caption="Rates / inflation / labor" onExpand={() => onZoom?.({ title: 'Macro Breakdown', caption: 'Rates / inflation / labor', content: <MacroRegimeChart data={snapshot.macro} isDemo={isDemo} /> })}><MacroRegimeChart data={snapshot.macro} isDemo={isDemo} /></ChartCard>
      <section className="table-card">
        <div className="section-title-row"><div><span className="section-kicker">Derived Features</span><h2>Filings / Insider / Options</h2></div></div>
        <div className="factor-list">
          <div className="factor-row"><span>Filing recency</span><strong>{snapshot.filings?.[0]?.filingRecencyDays ?? 'n/a'}d</strong></div>
          <div className="factor-row"><span>Filing risk phrase score</span><strong>{pct(snapshot.filings?.[0]?.riskPhraseScore)}</strong></div>
          <div className="factor-row"><span>Insider net buy value</span><strong>{money(snapshot.insiders?.[0]?.netBuyValue30d)}</strong></div>
          <div className="factor-row"><span>Options implied move</span><strong>{pct(snapshot.probabilities?.expectedMove || 0.04)}</strong></div>
        </div>
      </section>
    </section>
  );
}

function pct(value) { return Number.isFinite(Number(value)) ? `${Math.round(Number(value) * 100)}%` : 'n/a'; }
function money(value) { return Number.isFinite(Number(value)) ? `$${Number(value).toLocaleString()}` : '$0'; }
