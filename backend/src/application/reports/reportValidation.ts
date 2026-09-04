export interface ReportVerificationInput {
  patient: {
    name: string;
    phone: string;
    data?: Record<string, unknown>;
  };
  data: Record<string, unknown>;
  lab: Record<string, unknown>;
}

export interface ReportValidationResult {
  valid: boolean;
  errors: string[];
}

export class ReportValidationError extends Error {
  constructor(public readonly errors: string[]) {
    super('REPORT_INVALID_FOR_VERIFICATION');
    this.name = 'ReportValidationError';
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function stringValue(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function numberValue(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function isValidIndianPhone(phone: string): boolean {
  const digits = phone.replace(/\D/g, '');
  const normalized = digits.length === 10 ? `91${digits}` : digits;
  return /^91[6-9]\d{9}$/.test(normalized);
}

function isValidIsoDate(value: unknown): boolean {
  return typeof value === 'string' && Boolean(value) && Number.isFinite(Date.parse(value));
}

export function validateReportForVerification(input: ReportVerificationInput): ReportValidationResult {
  const errors: string[] = [];
  const dataPatient = isRecord(input.data.patient) ? input.data.patient : {};
  const patientData = { ...dataPatient, ...(input.patient.data || {}) };

  if (!input.patient.name.trim()) errors.push('Patient name is required.');
  if (!isValidIndianPhone(input.patient.phone)) errors.push('A valid 10-digit Indian patient phone number is required.');

  const accessionNumber = stringValue(patientData.accessionNumber);
  if (accessionNumber && !/^ACC-[A-Z0-9-]{6,64}$/.test(accessionNumber)) errors.push('Accession number format is invalid.');
  const specimenStatus = stringValue(patientData.specimenStatus);
  if (specimenStatus === 'REJECTED') errors.push('A rejected specimen cannot be verified.');
  if (specimenStatus && !['RECEIVED', 'PROCESSING', 'RESULTS_PENDING', 'COMPLETE'].includes(specimenStatus)) {
    errors.push('Specimen must be received before the report can be verified.');
  }
  if (specimenStatus === 'REJECTED' && !stringValue(patientData.sampleRejectionReason)) {
    errors.push('A specimen rejection reason is required.');
  }

  const age = numberValue(patientData.age);
  if (age === undefined || age < 0 || age > 120) errors.push('Patient age must be between 0 and 120.');
  if (!isValidIsoDate(patientData.sampleCollectedAt)) errors.push('Sample collection time is invalid.');
  if (!isValidIsoDate(patientData.sampleReceivedAt)) errors.push('Sample receipt time is invalid.');
  if (!isValidIsoDate(patientData.reportGeneratedAt)) errors.push('Report generation time is invalid.');
  if (isValidIsoDate(patientData.sampleCollectedAt) && isValidIsoDate(patientData.sampleReceivedAt)
    && Date.parse(String(patientData.sampleReceivedAt)) < Date.parse(String(patientData.sampleCollectedAt))) {
    errors.push('Sample receipt time cannot be before collection time.');
  }

  const tests = Array.isArray(input.data.tests) ? input.data.tests.filter(isRecord) : [];
  if (!tests.length) {
    errors.push('At least one test panel is required.');
  }

  tests.forEach((test) => {
    const testName = stringValue(test.testName);
    if (!testName) errors.push('Every test panel must have a name.');

    const parameters = Array.isArray(test.parameters) ? test.parameters.filter(isRecord) : [];
    parameters.forEach((parameter) => {
      const value = stringValue(parameter.value);
      if (!value || parameter.flag === 'PENDING') {
        errors.push(`${testName || 'Test panel'}: ${stringValue(parameter.name) || 'A parameter'} still needs a result.`);
      } else if (parameter.flag === 'INVALID') {
        errors.push(`${testName || 'Test panel'}: ${stringValue(parameter.name) || 'A parameter'} has an invalid result.`);
      }
    });
  });

  const hasCriticalResult = tests.some((test) => (
    Array.isArray(test.parameters)
      && test.parameters.some((parameter) => parameter.flag === 'CRITICAL_LOW' || parameter.flag === 'CRITICAL_HIGH')
  ));
  if (hasCriticalResult && stringValue(input.data.criticalResultStatus) !== 'ACKNOWLEDGED') {
    errors.push('Critical result(s) must be acknowledged before verification.');
  }

  const selectedSignatoryId = stringValue(input.data.selectedSignatoryId);
  const signatories = Array.isArray(input.lab.signatories) ? input.lab.signatories.filter(isRecord) : [];
  if (!selectedSignatoryId || !signatories.some((signatory) => stringValue(signatory.id) === selectedSignatoryId)) {
    errors.push('A valid consultant pathologist signatory must be selected.');
  }

  const billing = isRecord(input.data.billing) ? input.data.billing : {};
  const prices = tests.map((test) => numberValue(test.price));
  if (prices.some((price) => price !== undefined && price < 0)) {
    errors.push('Every test panel must have a valid non-negative price.');
  }
  const expectedTotal = prices.every((price) => price !== undefined)
    ? prices.reduce((sum, price) => sum + price!, 0)
    : undefined;
  const totalAmount = numberValue(billing.totalAmount);
  const discount = numberValue(billing.discount);
  const netAmount = numberValue(billing.netAmount);
  const paidAmount = numberValue(billing.paidAmount);

  if (expectedTotal === undefined || totalAmount === undefined || Math.abs(totalAmount - expectedTotal) > 0.01) {
    errors.push('Billing total does not match the selected test panels.');
  }
  if (discount === undefined || totalAmount === undefined || discount < 0 || discount > totalAmount) {
    errors.push('Discount is invalid.');
  }
  if (netAmount === undefined || totalAmount === undefined || discount === undefined || Math.abs(netAmount - Math.max(0, totalAmount - discount)) > 0.01) {
    errors.push('Net billing amount is invalid.');
  }
  if (paidAmount === undefined || netAmount === undefined || paidAmount < 0 || paidAmount > netAmount) {
    errors.push('Paid amount is invalid.');
  }
  const paymentStatus = stringValue(billing.paymentStatus);
  const expectedPaymentStatus = paidAmount === undefined || netAmount === undefined
    ? undefined
    : paidAmount <= 0
    ? 'UNPAID'
    : paidAmount >= netAmount
    ? 'PAID'
    : 'PARTIAL';
  if (expectedPaymentStatus && paymentStatus !== expectedPaymentStatus) {
    errors.push('Payment status does not match the paid amount.');
  }

  return { valid: errors.length === 0, errors };
}
