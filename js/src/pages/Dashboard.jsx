import React, { useMemo, useState } from 'react';
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
  ChartZoomModal,
  ExcessReturnChart,
  ExpectedReturnChart,
  FeatureImportanceChart,
  IndicatorControls,
  MonteCarloFanChart,
  MonteCarloHistogram,
  MonteCarloRiskCards,
  PriceCandlestickChart,
  ProbabilityTrendChart,
  RangeSelector,
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
import { useChartZoom } from '../hooks/useChartZoom.js';
import { filterByRange } from '../lib/chartRanges.js';

export default function DashboardPage() {
  const initialTicker = new URLSearchParams(window.location.search).get('ticker') || 'MSFT';
  const [input, setInput] = useState(initialTicker.toUpperCase());
  const [symbol, setSymbol] = useState(initialTicker.toUpperCase());
  const [chartRange, setChartRange] = useState('1Y');
  const [priceIndicators, setPriceIndicators] = useState({
    sma20: true,
    sma50: false,
    sma200: true,
    ema20: false,
    ema50: false,
    bollinger: false,
    volume: true,
    rsi: false,
    macd: false,
    atr: false,
    volatility: false,
    beta: false,
    relativeStrength: false,
  });
  const zoom = useChartZoom();
  const { controls, updateControl, patchControls } = useDashboardState({ selectedSymbol: initialTicker.toUpperCase() });
  const live = useDashboardLiveData([symbol, controls.benchmark, 'SPY', 'QQQ'], { horizonDays: controls.horizonDays });
  const snapshot = live.snapshot;
  const scenarioSimulation = useScenarioSimulation(snapshot, controls);
  const rangeData = useMemo(() => ({
    candles: filterByRange(snapshot?.candles || [], chartRange, 'date'),
    benchmark: filterByRange(snapshot?.benchmark || [], chartRange, 'date'),
    probabilityHistory: filterByRange(snapshot?.probabilityHistory || [], chartRange, 'date'),
    backtestEquity: filterByRange(snapshot?.backtest?.equity || [], chartRange, 'date'),
    backtestDrawdown: filterByRange(snapshot?.backtest?.drawdown || [], chartRange, 'date'),
  }), [chartRange, snapshot?.backtest?.drawdown, snapshot?.backtest?.equity, snapshot?.benchmark, snapshot?.candles, snapshot?.probabilityHistory]);

  function submit(event) {
    event.preventDefault();
    const next = input.trim().toUpperCase();
    selectSymbol(next);
  }

  function selectSymbol(nextSymbol) {
    const next = String(nextSymbol || '').trim().toUpperCase();
    if (/^[A-Z0-9.-]{1,12}$/.test(next)) {
      setSymbol(next);
      setInput(next);
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
  const priceControls = <><RangeSelector value={chartRange} onChange={setChartRange} /><IndicatorControls value={priceIndicators} onChange={setPriceIndicators} /></>;
  const rangeControls = <RangeSelector value={chartRange} onChange={setChartRange} />;

  return (
    <AppShell active="Dashboard" rightSlot={<StatusBadge status={live.status}>{live.status || 'live'}</StatusBadge>}>
      <DashboardCommandCenter input={input} setInput={setInput} onSubmit={submit} onSelectSymbol={selectSymbol} snapshot={snapshot} live={live} controls={controls} updateControl={updateControl} />
      {warnings.length > 0 && <section className="warning-strip">{warnings.map((warning) => <span key={warning}>{warning}</span>)}</section>}
      <AnalysisControlPanel controls={controls} updateControl={updateControl} />
      <DashboardMetricStrip snapshot={snapshot} controls={controls} simulation={scenarioSimulation} />

      <section className="investment-grid two" style={{ marginTop: 10 }}>
        <ChartCard className="primary-chart-card" title="Price Action" caption="Candles + volume" controls={priceControls} onExpand={() => zoom.openChart({
          title: 'Price Action',
          caption: `${snapshot.symbol} · ${chartRange}`,
          controls: priceControls,
          content: <PriceCandlestickChart data={snapshot.candles} benchmarkData={rangeData.benchmark} range={chartRange} indicators={priceIndicators} isDemo={live.isDemo} />,
        })}>
          <PriceCandlestickChart data={snapshot.candles} benchmarkData={rangeData.benchmark} range={chartRange} indicators={priceIndicators} isDemo={live.isDemo} />
        </ChartCard>
        <ChartCard className="primary-chart-card" title={`${snapshot.symbol} vs ${controls.benchmark}`} caption="Benchmark comparison" controls={rangeControls} onExpand={() => zoom.openChart({
          title: `${snapshot.symbol} vs ${controls.benchmark}`,
          caption: `Benchmark comparison · ${chartRange}`,
          controls: rangeControls,
          content: <BenchmarkComparisonChart data={rangeData.benchmark} isDemo={live.isDemo} />,
        })}>
          <BenchmarkComparisonChart data={rangeData.benchmark} isDemo={live.isDemo} />
        </ChartCard>
      </section>

      <section className="investment-grid terminal-six" style={{ marginTop: 7 }}>
        <ChartCard title="Probability Trend" caption="Threshold at 50%" controls={rangeControls} onExpand={() => zoom.openChart({ title: 'Probability Trend', caption: chartRange, controls: rangeControls, content: <ProbabilityTrendChart data={rangeData.probabilityHistory} isDemo={live.isDemo} /> })}><ProbabilityTrendChart data={rangeData.probabilityHistory} isDemo={live.isDemo} /></ChartCard>
        <ChartCard title="Threshold Probability" caption="Custom gain/loss" onExpand={() => zoom.openChart({ title: 'Threshold Probability', caption: 'Custom gain/loss', content: <ThresholdProbabilityChart simulation={scenarioSimulation} gainThreshold={controls.gainThreshold} lossThreshold={controls.lossThreshold} isDemo={live.isDemo} /> })}><ThresholdProbabilityChart simulation={scenarioSimulation} gainThreshold={controls.gainThreshold} lossThreshold={controls.lossThreshold} isDemo={live.isDemo} /></ChartCard>
        <ChartCard title="Risk / Confidence" caption="Model stability" controls={rangeControls} onExpand={() => zoom.openChart({ title: 'Risk / Confidence', caption: chartRange, controls: rangeControls, content: <RiskConfidenceChart data={rangeData.probabilityHistory} isDemo={live.isDemo} /> })}><RiskConfidenceChart data={rangeData.probabilityHistory} isDemo={live.isDemo} /></ChartCard>
        <ChartCard title="Monte Carlo" caption={`${controls.horizonDays}D fan`} onExpand={() => zoom.openChart({ title: 'Monte Carlo Fan', caption: `${controls.horizonDays}D · ${controls.scenario}`, content: <MonteCarloFanChart simulation={scenarioSimulation} isDemo={live.isDemo} height={520} /> })}>
          <MonteCarloFanChart simulation={scenarioSimulation} isDemo={live.isDemo} height={128} />
        </ChartCard>
        <ChartCard title="Return Distribution" caption="VaR / CVaR" onExpand={() => zoom.openChart({ title: 'Return Distribution', caption: 'VaR / CVaR', content: <MonteCarloHistogram simulation={scenarioSimulation} isDemo={live.isDemo} height={500} /> })}><MonteCarloHistogram simulation={scenarioSimulation} isDemo={live.isDemo} height={128} /></ChartCard>
        <ChartCard title="Scenario Importance" caption="Top model weights" onExpand={() => zoom.openChart({ title: 'Scenario Importance', caption: 'Top model weights', content: <FeatureImportanceChart data={snapshot.features} isDemo={live.isDemo} height={500} limit={14} /> })}><FeatureImportanceChart data={snapshot.features} isDemo={live.isDemo} height={128} limit={8} /></ChartCard>
      </section>

      <section className="investment-grid terminal-five" style={{ marginTop: 7 }}>
        <ExternalDataPanel providers={snapshot.providerHealth} currentSource={live.source || 'fallback'} />
        <SimilarStocksPanel symbol={symbol} snapshot={snapshot} />
        <RankingPreviewPanel rows={snapshot.rankings} />
        <BacktestPreviewPanel backtest={{ ...snapshot.backtest, equity: rangeData.backtestEquity, drawdown: rangeData.backtestDrawdown }} isDemo={live.isDemo} />
        <DataHealthPreviewPanel providers={snapshot.providerHealth} systemHealth={snapshot.systemHealth} memoryHealth={snapshot.memoryHealth} />
      </section>

      <section className="investment-grid three" style={{ marginTop: 10 }}>
        <ChartCard title="Volume" caption="Liquidity confirmation" controls={rangeControls} onExpand={() => zoom.openChart({ title: 'Volume', caption: chartRange, controls: rangeControls, content: <VolumeChart data={rangeData.candles} isDemo={live.isDemo} /> })}><VolumeChart data={rangeData.candles} isDemo={live.isDemo} /></ChartCard>
        <ChartCard title="Expected Return" caption="Return history" controls={rangeControls} onExpand={() => zoom.openChart({ title: 'Expected Return', caption: chartRange, controls: rangeControls, content: <ExpectedReturnChart data={rangeData.probabilityHistory} isDemo={live.isDemo} /> })}><ExpectedReturnChart data={rangeData.probabilityHistory} isDemo={live.isDemo} /></ChartCard>
        <ChartCard title="Relative Strength" caption={`Spread vs ${controls.benchmark}`} controls={rangeControls} onExpand={() => zoom.openChart({ title: 'Relative Strength', caption: chartRange, controls: rangeControls, content: <RelativeStrengthChart data={rangeData.benchmark} benchmark={controls.benchmark} isDemo={live.isDemo} /> })}><RelativeStrengthChart data={rangeData.benchmark} benchmark={controls.benchmark} isDemo={live.isDemo} /></ChartCard>
      </section>

      <section className="investment-grid two" style={{ marginTop: 10 }}>
        <ChartCard title="Scenario Comparison" caption="Expected return and volatility assumptions" onExpand={() => zoom.openChart({ title: 'Scenario Comparison', caption: 'Assumptions', content: <ScenarioComparisonChart expectedReturn={expectedAnnual} volatility={volatilityAnnual} isDemo={live.isDemo} /> })}><ScenarioComparisonChart expectedReturn={expectedAnnual} volatility={volatilityAnnual} isDemo={live.isDemo} /></ChartCard>
        <MonteCarloRiskCards simulation={scenarioSimulation} probabilityOutperformSpy={probabilities.probabilityOutperformSpy} isDemo={live.isDemo} />
      </section>
      <FeatureEnginePanel snapshot={snapshot} predictionView={predictionView} isDemo={live.isDemo} onZoom={zoom.openChart} />

      <section className="investment-grid two" style={{ marginTop: 10 }}>
        <section className="table-card">
          <div className="section-title-row"><div><span className="section-kicker">Recent News</span><h2>Catalysts</h2></div></div>
          <CompactTable columns={[{ key: 'title', label: 'Headline' }, { key: 'sentiment', label: 'Score' }, { key: 'source', label: 'Source' }]} rows={snapshot.news || []} renderCell={renderNewsCell} />
        </section>
      </section>
      <ChartZoomModal chart={zoom.zoomedChart} onClose={zoom.closeChart} />
    </AppShell>
  );
}

function renderNewsCell(row, column) {
  if (column.key === 'sentiment') return <span className={Number(row.sentiment) >= 0 ? 'value-bull' : 'value-bear'}>{Number(row.sentiment || 0).toFixed(2)}</span>;
  return row[column.key] || 'n/a';
}
