import { computeBrierScore, computeCalibrationBins } from './backtest.js';

export function reliabilityCurve(outcomes = [], bins = 10) {
  return computeCalibrationBins(outcomes, bins);
}

export function brierScore(outcomes = []) {
  return computeBrierScore(outcomes);
}

export function expectedCalibrationError(outcomes = [], bins = 10) {
  const calibration = computeCalibrationBins(outcomes, bins);
  const total = calibration.reduce((sum, bin) => sum + bin.count, 0);
  if (!total) return null;
  return calibration.reduce((sum, bin) => {
    if (bin.realized === null) return sum;
    return sum + (bin.count / total) * Math.abs(bin.predicted - bin.realized);
  }, 0);
}
