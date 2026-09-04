import { DiagnosticReport, LabProfile } from '@/domain/types';

export interface ReportValidationResult {
  valid: boolean;
  errors: string[];
}

function isValidIndianPhone(phone: string): boolean {
  const digits = phone.replace(/\D/g, '');
  const normalized = digits.length === 10 ? `91${digits}` : digits;
  return /^91[6-9]\d{9}$/.test(normalized);
}

function isValidIsoDate(value: string): boolean {
  return Boolean(value) && Number.isFinite(Date.parse(value));
}

export function validateReportForVerification(
  report: DiagnosticReport,
  lab: LabProfile,
): ReportValidationResult {
  const errors: string[] = [];
  const patient = report.patient;

  if (!patient.name.trim()) errors.push('Patient name is required.');
  if (!isValidIndianPhone(patient.phone)) errors.push('A valid 10-digit Indian patient phone number is required.');
  if (!['Yrs', 'Months', 'Days'].includes(patient.ageUnit)) errors.push('Patient age unit is invalid.');
  if (!['Male', 'Female', 'Other'].includes(patient.gender)) errors.push('Patient gender is invalid.');
  if (!Number.isFinite(patient.age) || patient.age < 0 || patient.age > 120) errors.push('Patient age must be between 0 and 120.');
  if (!patient.accessionNumber.trim()) errors.push('Accession number is required.');
  if (patient.accessionNumber && !/^ACC-[A-Z0-9-]{6,64}$/.test(patient.accessionNumber.trim())) errors.push('Accession number format is invalid.');
  if (!['RECEIVED', 'PROCESSING', 'RESULTS_PENDING', 'COMPLETE'].includes(patient.specimenStatus)) {
    errors.push('Specimen must be received before the report can be verified.');
  }
  if (patient.specimenStatus === 'REJECTED' && !patient.sampleRejectionReason?.trim()) {
    errors.push('A specimen rejection reason is required.');
  }
  if (!isValidIsoDate(patient.sampleCollectedAt)) errors.push('Sample collection time is invalid.');
  if (!isValidIsoDate(patient.sampleReceivedAt)) errors.push('Sample receipt time is invalid.');
  if (!isValidIsoDate(patient.reportGeneratedAt)) errors.push('Report generation time is invalid.');
  if (isValidIsoDate(patient.sampleCollectedAt) && isValidIsoDate(patient.sampleReceivedAt)
    && Date.parse(patient.sampleReceivedAt) < Date.parse(patient.sampleCollectedAt)) {
    errors.push('Sample receipt time cannot be before collection time.');
  }

  if (!report.tests.length) {
    errors.push('At least one test panel is required.');
  }

  report.tests.forEach((test) => {
    if (!test.testName.trim()) errors.push('Every test panel must have a name.');
    test.parameters.forEach((parameter) => {
      if (!parameter.value.trim() || parameter.flag === 'PENDING') {
        errors.push(`${test.testName}: ${parameter.name} still needs a result.`);
      } else if (parameter.flag === 'INVALID') {
        errors.push(`${test.testName}: ${parameter.name} has an invalid result.`);
      }
    });
  });

  const hasCriticalResult = report.tests.some((test) => test.parameters.some((parameter) => (
    parameter.flag === 'CRITICAL_LOW' || parameter.flag === 'CRITICAL_HIGH'
  )));
  if (hasCriticalResult && report.criticalResultStatus !== 'ACKNOWLEDGED') {
    errors.push('Critical result(s) must be acknowledged before verification.');
  }

  const signatory = lab.signatories.find((item) => item.id === report.selectedSignatoryId);
  if (!signatory) errors.push('A valid consultant pathologist signatory must be selected.');

  const hasInvalidPrice = report.tests.some((test) => !Number.isFinite(test.price) || test.price < 0);
  if (hasInvalidPrice) errors.push('Every test panel must have a valid non-negative price.');
  const expectedTotal = report.tests.reduce((sum, test) => sum + (Number.isFinite(test.price) ? test.price : 0), 0);
  const { totalAmount, discount, netAmount, paidAmount } = report.billing;
  if (!Number.isFinite(totalAmount) || Math.abs(totalAmount - expectedTotal) > 0.01) {
    errors.push('Billing total does not match the selected test panels.');
  }
  if (!Number.isFinite(discount) || discount < 0 || discount > totalAmount) errors.push('Discount is invalid.');
  if (!Number.isFinite(netAmount) || Math.abs(netAmount - Math.max(0, totalAmount - discount)) > 0.01) {
    errors.push('Net billing amount is invalid.');
  }
  if (!Number.isFinite(paidAmount) || paidAmount < 0 || paidAmount > netAmount) errors.push('Paid amount is invalid.');
  const expectedPaymentStatus = paidAmount <= 0 ? 'UNPAID' : paidAmount >= netAmount ? 'PAID' : 'PARTIAL';
  if (report.billing.paymentStatus !== expectedPaymentStatus) errors.push('Payment status does not match the paid amount.');

  return { valid: errors.length === 0, errors };
}
