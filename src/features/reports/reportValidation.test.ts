import assert from 'node:assert/strict';
import test from 'node:test';
import { defaultLabProfile } from '@/config/defaultLabProfile';
import { standardTestTemplates } from '@/data/defaultTemplates';
import { createBlankReport } from './reportFactory';
import { validateReportForVerification } from './reportValidation';

test('rejects an incomplete report before verification', () => {
  const report = createBlankReport(standardTestTemplates, defaultLabProfile);
  const result = validateReportForVerification(report, defaultLabProfile);

  assert.equal(result.valid, false);
  assert.ok(result.errors.some((error) => error.includes('Patient name')));
  assert.ok(result.errors.some((error) => error.includes('phone number')));
});

test('accepts a complete report with consistent billing', () => {
  const report = createBlankReport(standardTestTemplates, defaultLabProfile);
  const lab = {
    ...defaultLabProfile,
    signatories: [{
      id: 'pathologist-1',
      name: 'Dr. Test',
      degrees: 'MD',
      regNumber: 'REG-1',
      designation: 'Pathologist',
    }],
  };
  report.patient.name = 'Test Patient';
  report.patient.phone = '9876543210';
  report.patient.specimenStatus = 'COMPLETE';
  report.patient.sampleReceivedAt = new Date().toISOString();
  report.selectedSignatoryId = 'pathologist-1';

  const result = validateReportForVerification(report, lab);
  assert.deepEqual(result, { valid: true, errors: [] });
});
