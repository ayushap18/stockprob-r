import React, { useState } from 'react';
import AnalysisControlPanel from '../components/dashboard/AnalysisControlPanel.jsx';
import BacktestPreviewPanel from '../components/dashboard/BacktestPreviewPanel.jsx';
import DashboardCommandCenter from '../components/dashboard/DashboardCommandCenter.jsx';
import DashboardMetricStrip from '../components/dashboard/DashboardMetricStrip.jsx';
import DataHealthPreviewPanel from '../components/dashboard/DataHealthPreviewPanel.jsx';
import ExternalDataPanel from '../components/dashboard/ExternalDataPanel.jsx';
import FeatureEnginePanel from '../components/dashboard/FeatureEnginePanel.jsx';
import RankingPreviewPanel from '../components/dashboard/RankingPreviewPanel.jsx';
import SimilarStocksPanel from '../components/dashboard/SimilarStocksPanel.jsx';
import {
  BenchmarkComparisonChart,
  ExcessReturnChart,
  FeatureImportanceChart,
  MonteCarloFanChart,
  MonteCarloHistogram,
  MonteCarloRiskCards,
  PriceCandlestickChart,
  ProbabilityTrendChart,
  RelativeStrengthChart,
  RiskConfidenceChart,
  ScenarioComparisonChart,
  ThresholdProbabilityChart,
  VolumeChart,
} from '../components/charts/index.js';
import AppShell from '../components/ui/AppShell.jsx';
import ChartCard from '../components/ui/ChartCard.jsx';
import CompactTable from '../components/ui/CompactTable.jsx';
import LoadingSkeleton from '../components/ui/LoadingSkeleton.jsx';
import StatusBadge from '../components/ui/StatusBadge.jsx';
import { useDashboardLiveData } from '../hooks/useDashboardLiveData.js';
import { useDashboardState, useScenarioSimulation } from '../hooks/useDashboardState.js';

export default function DashboardPage() {
  const initialTicker = new URLSearchParams(window.location.search).get('ticker') || 'MSFT';
  const [input, setInput] = useState(initialTicker.toUpperCase());
  const [symbol, setSymbol] = useState(initialTicker.toUpperCase());
  const { controls, updateControl, patchControls } = useDashboardState({ selectedSymbol: initialTicker.toUpperCase() });
  const live = useDashboardLiveData([symbol, controls.benchmark, 'SPY', 'QQQ'], { horizonDays: controls.horizonDays });
  const snapshot = live.snapshot;
  const scenarioSimulation = useScenarioSimulation(snapshot, controls);

  function submit(event) {
    event.preventDefault();
    const next = input.trim().toUpperCase();
    if (/^[A-Z0-9.-]{1,12}$/.test(next)) {
      setSymbol(next);
      patchControls({ selectedSymbol: next });
    }
  }

  if (!snapshot) {
    return <AppShell active="Dashboard"><LoadingSkeleton label="Loading dashboard" /></AppShell>;
  }

  const probabilities = snapshot.probabilities || {};
  const predictionView = {
    technicalScore: probabilities.momentumScore || snapshot.scores?.technical,
    features: {
      technical: {
        rsi_14: snapshot.technicals?.rsi_14,
        volume_z_score: snapshot.technicals?.volume_z_score,
        beta_vs_spy: snapshot.technicals?.beta_to_spy || snapshot.technicals?.beta_vs_spy,
        sector_relative_strength: snapshot.technicals?.relative_strength_vs_spy,
        mean_reversion_score: snapshot.technicals?.mean_reversion_score,
      },
      fundamental: {
        revenue_growth_yoy: snapshot.fundamentals?.revenueGrowth,
        eps_growth_yoy: snapshot.fundamentals?.epsGrowth,
        gross_margin: snapshot.fundamentals?.grossMargin,
        net_margin: snapshot.fundamentals?.netMargin,
        return_on_equity: snapshot.fundamentals?.roe,
        return_on_invested_capital: snapshot.fundamentals?.roic,
        balance_sheet_score: 1 - (snapshot.fundamentals?.debtToEquity || 0.42) / 2,
        valuation_score: snapshot.scores?.fundamental,
      },
    },
  };
  const warnings = [...new Set([...(live.warnings || []), ...(live.isDemo ? ['Demo fallback active'] : [])])].slice(0, 4);
  const expectedAnnual = Math.max(-0.6, Math.min(0.8, Number(probabilities.expectedReturn || 0) * (252 / Math.max(1, Number(controls.horizonDays) || 5))));
  const volatilityAnnual = Math.max(0.08, Math.min(1.4, Number(snapshot.technicals?.volatility_20d || probabilities.riskScore || 0.24)));

  return (
    <AppShell active="Dashboard" rightSlot={<StatusBadge status={live.status}>{live.status || 'live'}</StatusBadge>}>
      <DashboardCommandCenter input={input} setInput={setInput} onSubmit={submit} snapshot={snapshot} live={live} controls={controls} updateControl={updateControl} />
      {warnings.length > 0 && <section className="warning-strip">{warnings.map((warning) => <span key={warning}>{warning}</span>)}</section>}
      <AnalysisControlPanel controls={controls} updateControl={updateControl} />
      <DashboardMetricStrip snapshot={snapshot} controls={controls} simulation={scenarioSimulation} />

      <section className="investment-grid two" style={{ marginTop: 10 }}>
        <ChartCard title="Price Action" caption="Candles + volume">
          <ChartToolbar groups={[['1D', '5D', '1M', '3M', '6M', 'YTD', '1Y', '2Y', 'All'], ['Indicators', 'Undo', 'Redo'], ['Settings', 'Snapshot', 'Full']]} active="1Y" />
          <PriceCandlestickChart data={snapshot.candles} isDemo={live.isDemo} />
        </ChartCard>
        <ChartCard title={`${snapshot.symbol} vs ${controls.benchmark}`} caption="Benchmark comparison">
          <ChartToolbar groups={[['1M', '3M', '6M', 'YTD', '1Y', '2Y', 'All'], [snapshot.symbol, controls.benchmark, 'XLK']]} active="1Y" />
          <BenchmarkComparisonChart data={snapshot.benchmark} isDemo={live.isDemo} />
        </ChartCard>
      </section>

      <section className="investment-grid terminal-six" style={{ marginTop: 7 }}>
        <ChartCard title="Probability Trend" caption="Threshold at 50%"><ProbabilityTrendChart data={snapshot.probabilityHistory} isDemo={live.isDemo} /></ChartCard>
        <ChartCard title="Threshold Probability" caption="Custom gain/loss"><ThresholdProbabilityChart simulation={scenarioSimulation} gainThreshold={controls.gainThreshold} lossThreshold={controls.lossThreshold} isDemo={live.isDemo} /></ChartCard>
        <ChartCard title="Risk / Confidence" caption="Model stability"><RiskConfidenceChart data={snapshot.probabilityHistory} isDemo={live.isDemo} /></ChartCard>
        <ChartCard title="Monte Carlo" caption={`${controls.horizonDays}D fan`}>
          <MonteCarloFanChart simulation={scenarioSimulation} isDemo={live.isDemo} height={128} />
        </ChartCard>
        <ChartCard title="Return Distribution" caption="VaR / CVaR"><MonteCarloHistogram simulation={scenarioSimulation} isDemo={live.isDemo} height={128} /></ChartCard>
        <ChartCard title="Scenario Importance" caption="Top model weights"><FeatureImportanceChart data={snapshot.features} isDemo={live.isDemo} height={128} limit={8} /></ChartCard>
      </section>

      <section className="investment-grid terminal-five" style={{ marginTop: 7 }}>
        <ExternalDataPanel providers={snapshot.providerHealth} currentSource={live.source || 'fallback'} />
        <SimilarStocksPanel symbol={symbol} snapshot={snapshot} />
        <RankingPreviewPanel rows={snapshot.rankings} />
        <BacktestPreviewPanel backtest={snapshot.backtest} isDemo={live.isDemo} />
        <DataHealthPreviewPanel providers={snapshot.providerHealth} systemHealth={snapshot.systemHealth} memoryHealth={snapshot.memoryHealth} />
      </section>

      <section className="investment-grid three" style={{ marginTop: 10 }}>
        <ChartCard title="Volume" caption="Liquidity confirmation"><VolumeChart data={snapshot.candles} isDemo={live.isDemo} /></ChartCard>
        <ChartCard title="Relative Strength" caption={`Spread vs ${controls.benchmark}`}><RelativeStrengthChart data={snapshot.benchmark} benchmark={controls.benchmark} isDemo={live.isDemo} /></ChartCard>
        <ChartCard title="Excess Return" caption="Return above benchmark"><ExcessReturnChart data={snapshot.benchmark} benchmark={controls.benchmark} isDemo={live.isDemo} /></ChartCard>
      </section>

      <section className="investment-grid two" style={{ marginTop: 10 }}>
        <ChartCard title="Scenario Comparison" caption="Expected return and volatility assumptions"><ScenarioComparisonChart expectedReturn={expectedAnnual} volatility={volatilityAnnual} isDemo={live.isDemo} /></ChartCard>
        <MonteCarloRiskCards simulation={scenarioSimulation} probabilityOutperformSpy={probabilities.probabilityOutperformSpy} isDemo={live.isDemo} />
      </section>
      <FeatureEnginePanel snapshot={snapshot} predictionView={predictionView} isDemo={live.isDemo} />

      <section className="investment-grid two" style={{ marginTop: 10 }}>
        <section className="table-card">
          <div className="section-title-row"><div><span className="section-kicker">Recent News</span><h2>Catalysts</h2></div></div>
          <CompactTable columns={[{ key: 'title', label: 'Headline' }, { key: 'sentiment', label: 'Score' }, { key: 'source', label: 'Source' }]} rows={snapshot.news || []} renderCell={renderNewsCell} />
        </section>
      </section>
    </AppShell>
  );
}

function renderNewsCell(row, column) {
  if (column.key === 'sentiment') return <span className={Number(row.sentiment) >= 0 ? 'value-bull' : 'value-bear'}>{Number(row.sentiment || 0).toFixed(2)}</span>;
  return row[column.key] || 'n/a';
}

function ChartToolbar({ groups = [], active }) {
  return (
    <div className="chart-toolbar">
      {groups.map((group, groupIndex) => (
        <div key={groupIndex}>
          {group.map((item) => <button key={item} type="button" className={item === active ? 'active' : ''}>{item}</button>)}
        </div>
      ))}
    </div>
  );
}
