import test from 'node:test';
import assert from 'node:assert/strict';
import { DiagnosticReport, TestTemplate } from '@/domain/types';
import { getReportTat, parseTatHours } from '@/features/reports/tatService';

const template = { id: 'cbc', tat: '2 Hours' } as TestTemplate;

function report(overrides: Partial<DiagnosticReport> = {}): DiagnosticReport {
  return {
    id: 'report-1', reportNumber: 'LAB-1', version: 1,
    patient: {
      id: 'patient-1', uhid: 'UHID-1', accessionNumber: 'ACC-1', name: 'Test Patient', age: 30,
      ageUnit: 'Yrs', gender: 'Male', phone: '9999999999', referringDoctor: 'Self',
      sampleCollectedAt: '2026-09-04T08:00:00.000Z', sampleReceivedAt: '2026-09-04T09:00:00.000Z',
      reportGeneratedAt: '2026-09-04T09:00:00.000Z', sampleType: 'Serum', specimenStatus: 'RECEIVED',
      fastingStatus: 'N/A', sampleBarcode: 'BAR-1',
    },
    tests: [{ id: 'panel-1', templateId: 'cbc', testName: 'CBC', category: 'Hematology', sampleType: 'Blood', price: 100, parameters: [] }],
    clinicalImpression: '', pathologistNotes: '', criticalResultStatus: 'NOT_APPLICABLE', patientSummaryEn: '', patientSummaryHi: '',
    selectedSignatoryId: '', status: 'DRAFT', billing: { totalAmount: 100, discount: 0, netAmount: 100, paidAmount: 0, paymentMethod: 'Cash', paymentStatus: 'UNPAID' },
    whatsAppLogs: [], createdAt: '2026-09-04T09:00:00.000Z', updatedAt: '2026-09-04T09:00:00.000Z', ...overrides,
  };
}

test('parses supported TAT units', () => {
  assert.equal(parseTatHours('2 Hours'), 2);
  assert.equal(parseTatHours('30 Minutes'), 0.5);
  assert.equal(parseTatHours('1 Day'), 24);
  assert.equal(parseTatHours('same day'), null);
});

test('marks an unfinished report overdue from sample receipt time', () => {
  const result = getReportTat(report(), [template], new Date('2026-09-04T12:01:00.000Z'));
  assert.equal(result?.state, 'OVERDUE');
  assert.equal(result?.dueAt, '2026-09-04T11:00:00.000Z');
});

test('does not start TAT before the specimen is received', () => {
  const result = getReportTat(report({ patient: { ...report().patient, specimenStatus: 'COLLECTED' } }), [template]);
  assert.equal(result?.state, 'NOT_STARTED');
});

test('marks a verified report on time or late', () => {
  assert.equal(getReportTat(report({ status: 'VERIFIED', verifiedAt: '2026-09-04T10:45:00.000Z' }), [template], new Date())?.state, 'COMPLETED_ON_TIME');
  assert.equal(getReportTat(report({ status: 'VERIFIED', verifiedAt: '2026-09-04T11:15:00.000Z' }), [template], new Date())?.state, 'COMPLETED_LATE');
});
