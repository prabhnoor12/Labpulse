import { DiagnosticReport, TestTemplate } from '@/domain/types';
import { getReportTat, tatStateLabel } from '@/features/reports/tatService';

const columns = [
  'Report number', 'Accession number', 'UHID', 'Patient name', 'Phone', 'Tests',
  'Specimen status', 'TAT status', 'TAT due at', 'Report status', 'Collected at',
  'Received at', 'Verified at', 'Last updated',
];

function csvCell(value: unknown): string {
  const text = value === null || value === undefined ? '' : String(value);
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

export function buildRegistryCsv(reports: DiagnosticReport[], templates: TestTemplate[], now = new Date()): string {
  const rows = reports.map((report) => {
    const tat = getReportTat(report, templates, now);
    return [
      report.reportNumber,
      report.patient.accessionNumber,
      report.patient.uhid,
      report.patient.name,
      report.patient.phone,
      report.tests.map((test) => test.testName).join('; '),
      report.patient.specimenStatus,
      tat ? tatStateLabel(tat.state) : 'Not configured',
      tat?.dueAt || '',
      report.status,
      report.patient.sampleCollectedAt,
      report.patient.sampleReceivedAt,
      report.verifiedAt || '',
      report.updatedAt,
    ];
  });
  return [columns, ...rows].map((row) => row.map(csvCell).join(',')).join('\r\n');
}

export function downloadRegistryCsv(reports: DiagnosticReport[], templates: TestTemplate[], filename: string): void {
  const blob = new Blob([buildRegistryCsv(reports, templates)], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}
