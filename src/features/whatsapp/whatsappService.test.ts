import assert from 'node:assert/strict';
import test from 'node:test';
import { defaultLabProfile } from '@/config/defaultLabProfile';
import { standardTestTemplates } from '@/data/defaultTemplates';
import { createBlankReport } from '@/features/reports/reportFactory';
import { generateWhatsAppMessage } from './whatsappService';

test('does not describe a report awaiting review as verified', () => {
  const report = createBlankReport(standardTestTemplates, defaultLabProfile);
  report.status = 'READY_FOR_REVIEW';
  report.patient.name = 'Test Patient';

  const standard = generateWhatsAppMessage(report, defaultLabProfile, { templateType: 'standard' });
  const detailed = generateWhatsAppMessage(report, defaultLabProfile, { templateType: 'detailed' });

  assert.match(standard, /awaiting pathologist verification/);
  assert.match(detailed, /draft document and must not be used as a final report/);
  assert.doesNotMatch(detailed, /authorized diagnostic document verified/);
  assert.equal(report.status, 'READY_FOR_REVIEW');
});
