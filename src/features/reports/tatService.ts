import { DiagnosticReport, TestTemplate } from '@/domain/types';

export type TatState =
  | 'NOT_STARTED'
  | 'ON_TRACK'
  | 'DUE_SOON'
  | 'OVERDUE'
  | 'COMPLETED_ON_TIME'
  | 'COMPLETED_LATE'
  | 'NOT_APPLICABLE';

export interface ReportTat {
  hours: number;
  dueAt: string;
  state: TatState;
}

export function parseTatHours(tat: string): number | null {
  const match = tat.trim().match(/^(\d+(?:\.\d+)?)\s*(minute|min|hour|hr|day|d)s?$/i);
  if (!match) return null;
  const value = Number(match[1]);
  if (!Number.isFinite(value) || value <= 0) return null;
  const unit = match[2].toLowerCase();
  if (unit.startsWith('minute') || unit === 'min') return value / 60;
  if (unit.startsWith('day') || unit === 'd') return value * 24;
  return value;
}

function isValidDate(value: string | undefined): value is string {
  return Boolean(value && Number.isFinite(Date.parse(value)));
}

function expectedHours(report: DiagnosticReport, templates: TestTemplate[]): number | null {
  const hours = report.tests
    .map((test) => templates.find((template) => template.id === test.templateId)?.tat)
    .map((tat) => tat ? parseTatHours(tat) : null)
    .filter((value): value is number => value !== null);
  return hours.length > 0 ? Math.max(...hours) : null;
}

export function getReportTat(report: DiagnosticReport, templates: TestTemplate[], now = new Date()): ReportTat | null {
  if (report.status === 'ARCHIVED' || report.status === 'SUPERSEDED' || report.patient.specimenStatus === 'REJECTED') {
    return null;
  }

  const hours = expectedHours(report, templates);
  if (hours === null) return null;
  const specimenHasBeenReceived = ['RECEIVED', 'PROCESSING', 'RESULTS_PENDING', 'COMPLETE'].includes(report.patient.specimenStatus);
  if (!specimenHasBeenReceived || !isValidDate(report.patient.sampleReceivedAt)) {
    return { hours, dueAt: '', state: 'NOT_STARTED' };
  }

  const dueAt = new Date(Date.parse(report.patient.sampleReceivedAt) + hours * 60 * 60 * 1000).toISOString();
  const completedAt = report.verifiedAt && isValidDate(report.verifiedAt)
    ? Date.parse(report.verifiedAt)
    : null;
  if (completedAt !== null) {
    return { hours, dueAt, state: completedAt <= Date.parse(dueAt) ? 'COMPLETED_ON_TIME' : 'COMPLETED_LATE' };
  }

  const remainingMs = Date.parse(dueAt) - now.getTime();
  if (remainingMs < 0) return { hours, dueAt, state: 'OVERDUE' };
  if (remainingMs <= Math.max(30 * 60 * 1000, hours * 60 * 60 * 1000 * 0.25)) {
    return { hours, dueAt, state: 'DUE_SOON' };
  }
  return { hours, dueAt, state: 'ON_TRACK' };
}

export function tatStateLabel(state: TatState): string {
  return {
    NOT_STARTED: 'Awaiting receipt',
    ON_TRACK: 'On track',
    DUE_SOON: 'Due soon',
    OVERDUE: 'Overdue',
    COMPLETED_ON_TIME: 'On time',
    COMPLETED_LATE: 'Completed late',
    NOT_APPLICABLE: 'Not applicable',
  }[state];
}
