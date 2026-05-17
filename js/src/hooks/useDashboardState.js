import { useMemo, useState } from 'react';
import { runMonteCarloSimulation } from '../lib/math/monteCarlo.js';
import { scenarioAdjustedExpectedReturn, scenarioAdjustedVolatility } from '../lib/math/scenarios.js';

export const defaultDashboardControls = {
  selectedSymbol: 'MSFT',
  horizonDays: 5,
  benchmark: 'SPY',
  scenario: 'base',
  returnMode: 'excess',
  probabilityTarget: 'outperform',
  gainThreshold: 0.05,
  lossThreshold: -0.05,
  volatilityMode: 'historical',
  customVolatility: 0.24,
  expectedReturnMode: 'model',
  customExpectedReturn: 0.08,
  dataMode: 'live',
  chartDensity: 'standard',
};

export function useDashboardState(initial = {}) {
  const [controls, setControls] = useState({ ...defaultDashboardControls, ...initial });
  const updateControl = (key, value) => setControls((current) => ({ ...current, [key]: value }));
  const patchControls = (patch) => setControls((current) => ({ ...current, ...patch }));
  return { controls, updateControl, patchControls };
}

export function useScenarioSimulation(snapshot, controls) {
  return useMemo(() => {
    if (!snapshot?.quote?.price) return snapshot?.monteCarlo;
    const probabilities = snapshot.probabilities || {};
    const expectedAnnual = controls.expectedReturnMode === 'custom'
      ? controls.customExpectedReturn
      : Math.max(-0.6, Math.min(0.8, Number(probabilities.expectedReturn || 0) * (252 / Math.max(1, Number(controls.horizonDays) || 5))));
    const baseVol = controls.volatilityMode === 'custom'
      ? controls.customVolatility
      : Math.max(0.08, Math.min(1.4, Number(snapshot.technicals?.volatility_20d || snapshot.probabilities?.riskScore || 0.24)));
    const expectedReturnAnnual = scenarioAdjustedExpectedReturn(expectedAnnual, controls.scenario);
    const volatilityAnnual = scenarioAdjustedVolatility(baseVol, controls.scenario);
    const detailed = controls.chartDensity === 'detailed';
    const simulations = detailed ? 10000 : controls.chartDensity === 'compact' ? 1200 : 5000;
    const simulation = runMonteCarloSimulation({
      startPrice: snapshot.quote.price,
      expectedReturnAnnual,
      volatilityAnnual,
      days: controls.horizonDays,
      simulations,
      seed: `${snapshot.symbol}-${controls.horizonDays}-${controls.scenario}-${controls.benchmark}-${controls.expectedReturnMode}-${controls.volatilityMode}-${controls.customExpectedReturn}-${controls.customVolatility}`,
    });
    const finalReturns = simulation.finalReturns || [];
    const gainThreshold = Math.max(0, Number(controls.gainThreshold) || 0);
    const lossThreshold = -Math.abs(Number(controls.lossThreshold) || 0);
    return {
      ...simulation,
      probabilityOutperformSpy: probabilities.probabilityOutperformSpy,
      summary: {
        ...simulation.summary,
        probabilityGainGtThreshold: finalReturns.filter((value) => value > gainThreshold).length / Math.max(1, finalReturns.length),
        probabilityLossGtThreshold: finalReturns.filter((value) => value < lossThreshold).length / Math.max(1, finalReturns.length),
        expectedMove: volatilityAnnual * Math.sqrt((Number(controls.horizonDays) || 5) / 252),
        simulations,
        expectedReturnAnnual,
        volatilityAnnual,
        driftMode: controls.expectedReturnMode,
        volatilityMode: controls.volatilityMode,
      },
    };
  }, [snapshot, controls]);
}
