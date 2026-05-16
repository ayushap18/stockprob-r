import test from 'node:test';
import assert from 'node:assert/strict';
import modelReportHandler from '../api/model/report.js';
import { brierScore, calibrationCurve, classificationMetrics, modelReportFromOutcomes } from '../server/models/evaluation.js';

const outcomes = [
  { ticker: 'AAA', probability_outperform_spy: 0.82, actual_outperformed_spy: true, expected_excess_return: 0.03 },
  { ticker: 'BBB', probability_outperform_spy: 0.76, actual_outperformed_spy: true, expected_excess_return: 0.02 },
  { ticker: 'CCC', probability_outperform_spy: 0.61, actual_outperformed_spy: false, expected_excess_return: -0.01 },
  { ticker: 'DDD', probability_outperform_spy: 0.38, actual_outperformed_spy: false, expected_excess_return: -0.02 },
  { ticker: 'EEE', probability_outperform_spy: 0.24, actual_outperformed_spy: false, expected_excess_return: -0.04 },
  { ticker: 'FFF', probability_outperform_spy: 0.19, actual_outperformed_spy: true, expected_excess_return: 0.01 },
];

test('brierScore measures probabilistic forecast error', () => {
  const score = brierScore(outcomes);

  assert.equal(Number.isFinite(score), true);
  assert.equal(score > 0, true);
  assert.equal(score < 0.4, true);
});

test('calibrationCurve groups probabilities into observed hit-rate bins', () => {
  const bins = calibrationCurve(outcomes, { binCount: 5 });

  assert.equal(bins.length, 5);
  assert.equal(bins.reduce((total, bin) => total + bin.count, 0), outcomes.length);
  assert.equal(bins.some((bin) => bin.count > 0 && Number.isFinite(bin.observed_rate)), true);
});

test('classificationMetrics returns threshold confusion metrics', () => {
  const metrics = classificationMetrics(outcomes, { threshold: 0.6 });

  assert.equal(metrics.threshold, 0.6);
  assert.equal(metrics.true_positive, 2);
  assert.equal(metrics.false_positive, 1);
  assert.equal(metrics.true_negative, 2);
  assert.equal(metrics.false_negative, 1);
  assert.equal(metrics.precision, 0.6667);
});

test('modelReportFromOutcomes returns calibration report without claiming accuracy', () => {
  const report = modelReportFromOutcomes({ outcomes, horizon: 5, modelVersion: 'test-v1' });

  assert.equal(report.model_version, 'test-v1');
  assert.equal(report.horizon, '5d');
  assert.equal(report.sample_size, outcomes.length);
  assert.equal(report.metrics.brier_score, brierScore(outcomes));
  assert.equal(report.warnings.some((warning) => /not a guarantee/i.test(warning)), true);
});

test('model report API accepts supplied outcomes', async () => {
  const response = mockResponse();
  await modelReportHandler({ method: 'POST', body: { outcomes, horizon: 10, model_version: 'api-test' } }, response);

  assert.equal(response.statusCode, 200);
  assert.equal(response.body.model_version, 'api-test');
  assert.equal(response.body.horizon, '10d');
  assert.equal(response.body.data_mode, 'provided-outcomes');
  assert.equal(response.body.calibration_bins.length > 0, true);
});

test('model report API marks generated demo diagnostics as non-production', async () => {
  const response = mockResponse();
  await modelReportHandler({ method: 'GET', query: { horizon: '5' } }, response);

  assert.equal(response.statusCode, 200);
  assert.equal(response.body.data_mode, 'demo-outcomes');
  assert.equal(response.body.warnings.some((warning) => /demo/i.test(warning)), true);
});

function mockResponse() {
  return {
    statusCode: 200,
    body: null,
    headers: {},
    status(code) {
      this.statusCode = code;
      return this;
    },
    setHeader(name, value) {
      this.headers[name] = value;
      return this;
    },
    json(payload) {
      this.body = payload;
      return this;
    },
  };
}
