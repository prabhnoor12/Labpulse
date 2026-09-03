import assert from 'node:assert/strict';
import test from 'node:test';
import { toDiagnosticReport } from './apiClient';

test('preserves the backend review state after a workspace reload', () => {
  const report = toDiagnosticReport({
    id: 'report-1',
    reportNumber: 'LAB-1',
    status: 'READY_FOR_REVIEW',
    data: {
      patient: { age: 42, ageUnit: 'Yrs', gender: 'Other' },
      tests: [],
      billing: { totalAmount: 0, discount: 0, netAmount: 0, paidAmount: 0, paymentMethod: 'UPI', paymentStatus: 'UNPAID' },
    },
    patient: { id: 'patient-1', uhid: 'UHID-1', name: 'Test Patient', phone: '919876543210' },
    verifiedBy: null,
    verifiedAt: null,
    dispatchedAt: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  });

  assert.equal(report.status, 'READY_FOR_REVIEW');
  assert.equal(report.patient.name, 'Test Patient');
});
