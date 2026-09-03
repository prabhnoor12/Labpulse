import { DiagnosticReport } from '@/domain/types';

export function replaceReport(
  reports: DiagnosticReport[],
  updatedReport: DiagnosticReport,
): DiagnosticReport[] {
  return reports.map((report) =>
    report.id === updatedReport.id ? updatedReport : report,
  );
}

export function removeReport(
  reports: DiagnosticReport[],
  reportId: string,
): DiagnosticReport[] {
  return reports.filter((report) => report.id !== reportId);
}
