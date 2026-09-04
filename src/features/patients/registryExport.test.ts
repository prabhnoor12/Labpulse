import test from 'node:test';
import assert from 'node:assert/strict';
import { standardTestTemplates } from '@/data/defaultTemplates';
import { defaultLabProfile } from '@/config/defaultLabProfile';
import { createBlankReport } from '@/features/reports/reportFactory';
import { buildRegistryCsv } from './registryExport';

test('exports an auditable queue CSV with escaped patient values', () => {
  const report = createBlankReport(standardTestTemplates, defaultLabProfile);
  report.patient.name = 'Pat, ient';
  report.patient.specimenStatus = 'RECEIVED';
  report.patient.sampleCollectedAt = '2026-09-04T06:00:00.000Z';
  report.patient.sampleReceivedAt = '2026-09-04T06:00:00.000Z';
  const csv = buildRegistryCsv([report], standardTestTemplates, new Date('2026-09-04T09:00:00.000Z'));
  assert.match(csv, /^Report number,Accession number/);
  assert.match(csv, /"Pat, ient"/);
  assert.match(csv, /Overdue/);
});
