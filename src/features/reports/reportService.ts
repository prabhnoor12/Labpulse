import { BillingInfo, DiagnosticReport, Patient, TestPanel } from '@/domain/types';

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

const defaultPatient: Patient = {
  id: '',
  uhid: '',
  accessionNumber: '',
  name: '',
  age: 0,
  ageUnit: 'Yrs',
  gender: 'Other',
  phone: '',
  referringDoctor: '',
  sampleCollectedAt: new Date(0).toISOString(),
  sampleReceivedAt: new Date(0).toISOString(),
  reportGeneratedAt: new Date(0).toISOString(),
  sampleType: '',
  specimenStatus: 'ORDERED',
  sampleRejectionReason: '',
  sampleCollectedBy: '',
  sampleReceivedBy: '',
  fastingStatus: 'N/A',
  sampleBarcode: '',
};

const defaultBilling: BillingInfo = {
  totalAmount: 0,
  discount: 0,
  netAmount: 0,
  paidAmount: 0,
  paymentMethod: 'UPI',
  paymentStatus: 'UNPAID',
};

export function normalizeStoredReports(value: unknown): DiagnosticReport[] {
  if (!Array.isArray(value)) return [];

  return value
    .filter(isRecord)
    .map((item) => {
      const patient = isRecord(item.patient) ? item.patient : {};
      const billing = isRecord(item.billing) ? item.billing : {};
      const tests = Array.isArray(item.tests)
        ? item.tests
          .filter(isRecord)
          .map((test) => ({
            ...(test as unknown as TestPanel),
            parameters: Array.isArray(test.parameters) ? test.parameters : [],
          }))
        : [];
      const status: DiagnosticReport['status'] = item.status === 'READY_FOR_REVIEW' || item.status === 'VERIFIED' || item.status === 'DISPATCHED' || item.status === 'ARCHIVED' || item.status === 'SUPERSEDED'
        ? item.status
        : 'DRAFT';

      return {
        ...(item as unknown as DiagnosticReport),
        id: item.id as string,
        reportNumber: item.reportNumber as string,
        version: typeof item.version === 'number' ? item.version : 1,
        patient: { ...defaultPatient, ...patient } as Patient,
        tests,
        status,
        billing: { ...defaultBilling, ...billing } as BillingInfo,
        whatsAppLogs: Array.isArray(item.whatsAppLogs) ? item.whatsAppLogs as DiagnosticReport['whatsAppLogs'] : [],
        clinicalImpression: typeof item.clinicalImpression === 'string' ? item.clinicalImpression : '',
        pathologistNotes: typeof item.pathologistNotes === 'string' ? item.pathologistNotes : '',
        criticalResultStatus: item.criticalResultStatus === 'ACKNOWLEDGED' || item.criticalResultStatus === 'PENDING'
          ? item.criticalResultStatus
          : 'NOT_APPLICABLE' as DiagnosticReport['criticalResultStatus'],
        criticalResultNotes: typeof item.criticalResultNotes === 'string' ? item.criticalResultNotes : '',
        patientSummaryEn: typeof item.patientSummaryEn === 'string' ? item.patientSummaryEn : '',
        patientSummaryHi: typeof item.patientSummaryHi === 'string' ? item.patientSummaryHi : '',
        selectedSignatoryId: typeof item.selectedSignatoryId === 'string' ? item.selectedSignatoryId : '',
        createdAt: typeof item.createdAt === 'string' ? item.createdAt : new Date(0).toISOString(),
        updatedAt: typeof item.updatedAt === 'string' ? item.updatedAt : new Date(0).toISOString(),
      };
    })
    .filter((report) => typeof report.id === 'string' && report.id.trim() && typeof report.reportNumber === 'string' && report.reportNumber.trim());
}

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
