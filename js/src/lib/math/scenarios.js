export function scenarioAdjustedExpectedReturn(expectedReturnAnnual = 0.08, scenario = 'base') {
  const value = Number(expectedReturnAnnual) || 0;
  const multipliers = {
    base: 1,
    bull: 1.28,
    bear: 0.58,
    high_volatility: 0.92,
    recession_risk: 0.42,
    earnings_week: 1.05,
  };
  const penalty = scenario === 'bear' ? -0.03 : scenario === 'recession_risk' ? -0.07 : 0;
  return clamp(value * (multipliers[scenario] || 1) + penalty, -1.5, 1.5);
}

export function scenarioAdjustedVolatility(volatilityAnnual = 0.24, scenario = 'base') {
  const value = Math.max(0.01, Number(volatilityAnnual) || 0.24);
  const multipliers = {
    base: 1,
    bull: 0.92,
    bear: 1.32,
    high_volatility: 1.7,
    recession_risk: 1.45,
    earnings_week: 1.55,
  };
  return clamp(value * (multipliers[scenario] || 1), 0.01, 2.5);
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}
