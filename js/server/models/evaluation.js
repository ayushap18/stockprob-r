import { clamp, finite, round } from '../features/math.js';

export function brierScore(outcomes = []) {
  const rows = normalizeOutcomes(outcomes);
  if (!rows.length) return null;
  const mean = rows.reduce((sum, row) => sum + (row.probability - row.actual) ** 2, 0) / rows.length;
  return round(mean, 4);
}

export function calibrationCurve(outcomes = [], { binCount = 10 } = {}) {
  const rows = normalizeOutcomes(outcomes);
  const bins = Array.from({ length: binCount }, (_, index) => {
    const lower = index / binCount;
    const upper = (index + 1) / binCount;
    return {
      bin: index + 1,
      lower: round(lower, 4),
      upper: round(upper, 4),
      count: 0,
      avg_probability: null,
      observed_rate: null,
      calibration_error: null,
    };
  });

  for (const row of rows) {
    const index = Math.min(binCount - 1, Math.floor(row.probability * binCount));
    const bin = bins[index];
    bin.count += 1;
    bin.avg_probability = (bin.avg_probability || 0) + row.probability;
    bin.observed_rate = (bin.observed_rate || 0) + row.actual;
  }

  return bins.map((bin) => {
    if (!bin.count) return bin;
    const avg = bin.avg_probability / bin.count;
    const observed = bin.observed_rate / bin.count;
    return {
      ...bin,
      avg_probability: round(avg, 4),
      observed_rate: round(observed, 4),
      calibration_error: round(Math.abs(avg - observed), 4),
    };
  });
}

export function classificationMetrics(outcomes = [], { threshold = 0.6 } = {}) {
  const rows = normalizeOutcomes(outcomes);
  let truePositive = 0;
  let falsePositive = 0;
  let trueNegative = 0;
  let falseNegative = 0;
  for (const row of rows) {
    const predicted = row.probability >= threshold ? 1 : 0;
    if (predicted && row.actual) truePositive += 1;
    else if (predicted && !row.actual) falsePositive += 1;
    else if (!predicted && !row.actual) trueNegative += 1;
    else falseNegative += 1;
  }
  const precision = truePositive + falsePositive ? truePositive / (truePositive + falsePositive) : null;
  const recall = truePositive + falseNegative ? truePositive / (truePositive + falseNegative) : null;
  const accuracy = rows.length ? (truePositive + trueNegative) / rows.length : null;
  const specificity = trueNegative + falsePositive ? trueNegative / (trueNegative + falsePositive) : null;
  return {
    threshold,
    true_positive: truePositive,
    false_positive: falsePositive,
    true_negative: trueNegative,
    false_negative: falseNegative,
    precision: roundNullable(precision),
    recall: roundNullable(recall),
    specificity: roundNullable(specificity),
    accuracy: roundNullable(accuracy),
  };
}

export function modelReportFromOutcomes({ outcomes = [], horizon = 5, modelVersion = 'stockprob-js-baseline-v1', dataMode = 'provided-outcomes' } = {}) {
  const rows = normalizeOutcomes(outcomes);
  const bins = calibrationCurve(rows, { binCount: 10 });
  const brier = brierScore(rows);
  const thresholdMetrics = [0.5, 0.55, 0.6, 0.65].map((threshold) => classificationMetrics(rows, { threshold }));
  const avgExpectedExcess = average(rows.map((row) => row.expected_excess_return).filter(finite));
  const hitRate = rows.length ? rows.reduce((sum, row) => sum + row.actual, 0) / rows.length : null;
  const meanCalibrationError = average(bins.map((bin) => bin.calibration_error).filter(finite));

  return {
    model_version: modelVersion,
    generated_at: new Date().toISOString(),
    horizon: `${Number(horizon)}d`,
    target: 'stock_return_gt_spy_return',
    data_mode: dataMode,
    sample_size: rows.length,
    metrics: {
      brier_score: brier,
      hit_rate: roundNullable(hitRate),
      mean_calibration_error: roundNullable(meanCalibrationError),
      avg_expected_excess_return: roundNullable(avgExpectedExcess, 6),
    },
    calibration_bins: bins,
    threshold_metrics: thresholdMetrics,
    reliability: reliabilityLabel({ sampleSize: rows.length, brier, meanCalibrationError }),
    warnings: buildWarnings({ rows, dataMode }),
  };
}

export function normalizeOutcomes(outcomes = []) {
  return outcomes
    .map((row) => {
      const probability = Number(row.probability_outperform_spy ?? row.probability ?? row.predicted_probability);
      const actual = row.actual_outperformed_spy ?? row.actual ?? row.outperformed_spy;
      return {
        ticker: row.ticker ? String(row.ticker).toUpperCase() : null,
        as_of_date: row.as_of_date || row.date || null,
        horizon: row.horizon || null,
        probability: finite(probability) ? clamp(probability) : null,
        actual: actual === true || actual === 1 ? 1 : actual === false || actual === 0 ? 0 : null,
        expected_excess_return: Number(row.expected_excess_return),
      };
    })
    .filter((row) => finite(row.probability) && row.actual !== null);
}

function reliabilityLabel({ sampleSize, brier, meanCalibrationError }) {
  if (sampleSize < 100) return 'insufficient_sample';
  if (!finite(brier) || !finite(meanCalibrationError)) return 'unknown';
  if (brier <= 0.18 && meanCalibrationError <= 0.08) return 'strong';
  if (brier <= 0.24 && meanCalibrationError <= 0.14) return 'moderate';
  return 'weak';
}

function buildWarnings({ rows, dataMode }) {
  const warnings = ['Model diagnostics are historical measurements, not a guarantee of future accuracy'];
  if (dataMode === 'demo-outcomes') warnings.push('Demo outcomes are generated for UI/API diagnostics and are not production validation evidence');
  if (rows.length < 100) warnings.push('Sample size below 100; calibration confidence is limited');
  return warnings;
}

function average(values) {
  if (!values.length) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function roundNullable(value, digits = 4) {
  return finite(value) ? round(value, digits) : null;
}
