import assert from 'node:assert/strict';
import test from 'node:test';
import { incrementMetric, metricsSnapshot, recordHttpResponse } from './metrics';

test('records operational counters without report or patient data', () => {
  const metricName = 'test_metrics_total';
  incrementMetric(metricName, 2);
  recordHttpResponse(503);
  const snapshot = metricsSnapshot();
  const counters = snapshot.counters as Record<string, number>;

  assert.equal(counters[metricName], 2);
  assert.equal(typeof counters.http_requests_total, 'number');
  assert.equal(typeof counters.http_responses_5xx_total, 'number');
  assert.equal('patient' in snapshot, false);
  assert.equal('report' in snapshot, false);
});
