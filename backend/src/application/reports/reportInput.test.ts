import assert from 'node:assert/strict';
import test from 'node:test';
import { parseReportInput } from './reportInput';

const input = {
  reportNumber: 'LAB-1',
  patient: { uhid: 'UHID-1', name: 'Test Patient', phone: '9876543210', data: { age: 35, privateField: 'drop' } },
  data: {
    status: 'VERIFIED',
    tests: [
      { id: 'a', templateId: 'a', testName: 'A', category: 'Lab', sampleType: 'Blood', price: 100, parameters: [] },
      { id: 'b', templateId: 'b', testName: 'B', category: 'Lab', sampleType: 'Blood', price: 50, parameters: [] },
    ],
    billing: { totalAmount: 999, discount: 25, netAmount: 1, paidAmount: 75, paymentStatus: 'UNPAID', paymentMethod: 'Cash' },
    selectedSignatoryId: 'doctor-1',
  },
};

test('strips client workflow fields and derives billing values', () => {
  const parsed = parseReportInput(input);

  assert.equal((parsed.data as Record<string, unknown>).status, undefined);
  assert.deepEqual((parsed.data as Record<string, unknown>).billing, {
    totalAmount: 150,
    discount: 25,
    netAmount: 125,
    paidAmount: 75,
    paymentMethod: 'Cash',
    paymentStatus: 'PARTIAL',
  });
  assert.equal((parsed.patient.data as Record<string, unknown>).privateField, undefined);
});

test('rejects payment values above the derived net amount', () => {
  assert.throws(
    () => parseReportInput({ ...input, data: { ...input.data, billing: { discount: 0, paidAmount: 151 } } }),
    /REPORT_PAYMENT_INVALID/,
  );
});
