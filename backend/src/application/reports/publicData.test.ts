import assert from 'node:assert/strict';
import test from 'node:test';

process.env.DATABASE_URL ||= 'postgresql://test:test@localhost:5432/test';

const { sanitizePublicData, sanitizePublicLab } = await import('./reportService');

test('public report data is an explicit safe projection', () => {
  const safe = sanitizePublicData({
    clinicalImpression: 'Review with your physician.',
    tests: [{
      id: 'cbc',
      testName: 'CBC',
      price: 500,
      parameters: [{ name: 'Haemoglobin', value: '14', unit: 'g/dL', flag: 'NORMAL', secret: 'remove' }],
    }],
    patient: {
      age: 35,
      gender: 'Other',
      phone: '919876543210',
      email: 'patient@example.com',
      address: 'Private address',
      sampleType: 'Blood',
    },
    billing: { totalAmount: 500, transactionRef: 'private-payment-ref' },
    whatsAppLogs: [{ phoneNumber: '919876543210' }],
    internalNote: 'private',
  });

  assert.equal(safe.clinicalImpression, 'Review with your physician.');
  assert.equal((safe.tests as Array<Record<string, unknown>>)[0].testName, 'CBC');
  assert.deepEqual((safe.tests as Array<Record<string, unknown>>)[0].parameters, [{
    name: 'Haemoglobin',
    value: '14',
    unit: 'g/dL',
    flag: 'NORMAL',
    options: [],
  }]);
  assert.deepEqual(safe.patient, { age: 35, gender: 'Other', sampleType: 'Blood' });
  assert.equal('billing' in safe, false);
  assert.equal('whatsAppLogs' in safe, false);
  assert.equal('internalNote' in safe, false);
});

test('public lab data excludes financial and internal fields', () => {
  const safe = sanitizePublicLab({
    name: 'Safe Lab',
    phone: '+91 9876543210',
    email: 'lab@example.com',
    upiId: 'lab@upi',
    gstin: 'private-gstin',
    signatories: [{ id: 'doctor-1', name: 'Dr. Test', signatureUrl: 'private-url' }],
    internalSecret: 'private',
  });

  assert.equal(safe.name, 'Safe Lab');
  assert.equal(safe.upiId, undefined);
  assert.equal(safe.gstin, undefined);
  assert.equal(safe.internalSecret, undefined);
  assert.deepEqual(safe.signatories, [{ id: 'doctor-1', name: 'Dr. Test' }]);
});
