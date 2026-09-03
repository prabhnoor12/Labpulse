import assert from 'node:assert/strict';
import test from 'node:test';
import { normalizeStoredReports } from './reportService';

test('normalizes legacy report fields and drops unusable records', () => {
  const [report] = normalizeStoredReports([
    { id: 'report-1', reportNumber: 'LAB-1', patient: { name: 'Legacy Patient' }, tests: [{}] },
    { patient: { name: 'No ID' } },
  ]);

  assert.equal(report.id, 'report-1');
  assert.equal(report.patient.name, 'Legacy Patient');
  assert.deepEqual(report.whatsAppLogs, []);
  assert.deepEqual(report.tests, [{ parameters: [] }]);
  assert.equal(report.billing.paymentStatus, 'UNPAID');
});
