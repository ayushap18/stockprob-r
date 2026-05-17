import React from 'react';
import ControlPanel from '../ui/ControlPanel.jsx';
import SegmentedControl from '../ui/SegmentedControl.jsx';

export default function AnalysisControlPanel({ controls, updateControl }) {
  return (
    <ControlPanel title="Analysis Assumptions">
      <SegmentedControl className="control-horizon" label="Horizon" value={controls.horizonDays} onChange={(value) => updateControl('horizonDays', Number(value))} options={[5, 10, 30, 60, 90, 180, 252].map((value) => ({ value, label: value === 252 ? '1Y' : `${value}D` }))} />
      <SegmentedControl className="control-benchmark" label="Benchmark" value={controls.benchmark} onChange={(value) => updateControl('benchmark', value)} options={['SPY', 'QQQ', 'DIA', 'IWM', 'XLK']} />
      <SegmentedControl className="control-scenario" label="Scenario" value={controls.scenario} onChange={(value) => updateControl('scenario', value)} options={[
        { value: 'base', label: 'Base' },
        { value: 'bull', label: 'Bull' },
        { value: 'bear', label: 'Bear' },
        { value: 'high_volatility', label: 'High Vol' },
        { value: 'recession_risk', label: 'Recession' },
        { value: 'earnings_week', label: 'Earnings' },
      ]} />
      <SegmentedControl className="control-return-mode" label="Return Mode" value={controls.returnMode} onChange={(value) => updateControl('returnMode', value)} options={[
        { value: 'absolute', label: 'Absolute' },
        { value: 'excess', label: 'Excess' },
        { value: 'risk_adjusted', label: 'Risk Adj' },
      ]} />
      <SegmentedControl className="control-probability-target" label="Probability Target" value={controls.probabilityTarget} onChange={(value) => updateControl('probabilityTarget', value)} options={[
        { value: 'profit', label: 'Profit' },
        { value: 'outperform', label: 'Outperform' },
        { value: 'gain_threshold', label: 'Gain >' },
        { value: 'loss_threshold', label: 'Loss >' },
      ]} />
      <label className="control-field control-gain-threshold"><span>Gain Threshold</span><input type="number" step="0.01" value={controls.gainThreshold} onChange={(event) => updateControl('gainThreshold', Number(event.target.value))} /></label>
      <label className="control-field control-loss-threshold"><span>Loss Threshold</span><input type="number" step="0.01" value={controls.lossThreshold} onChange={(event) => updateControl('lossThreshold', Number(event.target.value))} /></label>
      <SegmentedControl className="control-volatility-mode" label="Volatility Mode" value={controls.volatilityMode} onChange={(value) => updateControl('volatilityMode', value)} options={[
        { value: 'historical', label: 'Hist' },
        { value: 'implied', label: 'IV' },
        { value: 'custom', label: 'Custom' },
      ]} />
      <label className="control-field control-custom-vol"><span>Custom Vol</span><input type="number" step="0.01" value={controls.customVolatility} onChange={(event) => updateControl('customVolatility', Number(event.target.value))} /></label>
      <SegmentedControl className="control-expected-return-mode" label="Expected Return Mode" value={controls.expectedReturnMode} onChange={(value) => updateControl('expectedReturnMode', value)} options={[
        { value: 'model', label: 'Model' },
        { value: 'analyst', label: 'Analyst' },
        { value: 'historical', label: 'Drift' },
        { value: 'custom', label: 'Custom' },
      ]} />
      <label className="control-field control-custom-return"><span>Custom Return</span><input type="number" step="0.01" value={controls.customExpectedReturn} onChange={(event) => updateControl('customExpectedReturn', Number(event.target.value))} /></label>
      <SegmentedControl className="control-chart-density" label="Chart Density" value={controls.chartDensity} onChange={(value) => updateControl('chartDensity', value)} options={['compact', 'standard', 'detailed']} />
    </ControlPanel>
  );
}
