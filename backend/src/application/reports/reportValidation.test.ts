import assert from 'node:assert/strict';
import test from 'node:test';
import { validateReportForVerification } from './reportValidation';

const validInput = {
  patient: {
    name: 'Test Patient',
    phone: '9876543210',
    data: {
      age: 35,
      sampleCollectedAt: '2026-09-03T08:00:00.000Z',
      reportGeneratedAt: '2026-09-03T10:00:00.000Z',
    },
  },
  data: {
    tests: [{
      testName: 'CBC',
      price: 500,
      parameters: [{ name: 'Haemoglobin', value: '14', flag: 'NORMAL' }],
    }],
    selectedSignatoryId: 'pathologist-1',
    billing: { totalAmount: 500, discount: 0, netAmount: 500, paidAmount: 0, paymentStatus: 'UNPAID' },
  },
  lab: { signatories: [{ id: 'pathologist-1' }] },
};

test('accepts a complete report on the backend', () => {
  assert.deepEqual(validateReportForVerification(validInput), { valid: true, errors: [] });
});

test('rejects incomplete reports on the backend', () => {
  const result = validateReportForVerification({
    ...validInput,
    patient: { ...validInput.patient, name: '', phone: '' },
    data: { ...validInput.data, tests: [], selectedSignatoryId: '' },
    lab: { signatories: [] },
  });

  assert.equal(result.valid, false);
  assert.ok(result.errors.some((error) => error.includes('Patient name')));
  assert.ok(result.errors.some((error) => error.includes('phone')));
  assert.ok(result.errors.some((error) => error.includes('test panel')));
  assert.ok(result.errors.some((error) => error.includes('signatory')));
});
