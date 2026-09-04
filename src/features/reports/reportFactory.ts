import {
  DiagnosticReport,
  LabProfile,
  TestPanel,
  TestParameter,
  TestTemplate,
} from '@/domain/types';
import { computeDerivedValues } from '@/domain/rangeEvaluator';
import { createAccessionNumber, createId, createReportNumber, createUhid } from '@/app/identifiers';

export function createPanelFromTemplate(template: TestTemplate, gender: 'Male' | 'Female' | 'Other'): TestPanel {
  const parameters: TestParameter[] = computeDerivedValues(
    template.parameters.map((parameter) => ({
      id: parameter.id,
      name: parameter.name,
      shortName: parameter.shortName,
      value: parameter.defaultVal || '',
      unit: parameter.unit,
      method: parameter.method,
      refRange: gender === 'Female' ? parameter.femaleRefRange : parameter.maleRefRange,
      minVal: parameter.minVal,
      maxVal: parameter.maxVal,
      criticalMin: parameter.criticalMin,
      criticalMax: parameter.criticalMax,
      options: parameter.options,
      subCategory: parameter.subCategory,
      isCalculated: parameter.isCalculated,
    })),
  );

  return {
    id: createId(`panel-${template.id}`),
    templateId: template.id,
    testName: template.name,
    category: template.category,
    sampleType: template.sampleType,
    method: template.method,
    price: template.defaultPrice,
    parameters,
    clinicalInterpretation: template.defaultNotes,
  };
}

export function createBlankReport(
  templates: TestTemplate[],
  labProfile: LabProfile,
): DiagnosticReport {
  const template = templates.find((item) => item.id === 'cbc') || templates[0];
  if (!template) {
    throw new Error('Add at least one test template before creating a report.');
  }

  const now = new Date().toISOString();
  const panel = createPanelFromTemplate(template, 'Other');

  return {
    id: createId('rep'),
    reportNumber: createReportNumber(new Date(now)),
    version: 1,
    patient: {
      id: createId('pat'),
      uhid: createUhid(new Date(now)),
      accessionNumber: createAccessionNumber(new Date(now)),
      name: '',
      age: 0,
      ageUnit: 'Yrs',
      gender: 'Other',
      phone: '',
      email: '',
      referringDoctor: '',
      sampleCollectedAt: now,
      sampleReceivedAt: '',
      reportGeneratedAt: now,
      sampleBarcode: createId('SMPL').replace(/-/g, '').slice(0, 16).toUpperCase(),
      sampleType: template.sampleType,
      specimenStatus: 'COLLECTED',
      sampleCollectedBy: '',
      sampleReceivedBy: '',
      fastingStatus: 'N/A',
    },
    tests: [panel],
    clinicalImpression: '',
    pathologistNotes: '',
    criticalResultStatus: 'NOT_APPLICABLE',
    criticalResultNotes: '',
    patientSummaryEn: '',
    patientSummaryHi: '',
    status: 'DRAFT',
    selectedSignatoryId: labProfile.signatories[0]?.id || '',
    billing: {
      totalAmount: panel.price,
      discount: 0,
      netAmount: panel.price,
      paidAmount: 0,
      paymentStatus: 'UNPAID',
      paymentMethod: 'UPI',
    },
    whatsAppLogs: [],
    createdAt: now,
    updatedAt: now,
  };
}
