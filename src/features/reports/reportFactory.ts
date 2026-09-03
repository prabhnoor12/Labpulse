import {
  DiagnosticReport,
  LabProfile,
  TestPanel,
  TestParameter,
  TestTemplate,
} from '@/domain/types';
import { computeDerivedValues } from '@/domain/rangeEvaluator';

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
    id: `panel-${template.id}-${Date.now()}`,
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
  const timestamp = Date.now();
  const date = now.slice(0, 10).replace(/-/g, '');
  const panel = createPanelFromTemplate(template, 'Other');

  return {
    id: `rep-${timestamp}`,
    reportNumber: `LAB-${date}-${Math.floor(1000 + Math.random() * 9000)}`,
    patient: {
      id: `pat-${timestamp}`,
      uhid: `UHID-${date.slice(2)}-${Math.floor(100 + Math.random() * 900)}`,
      name: '',
      age: 0,
      ageUnit: 'Yrs',
      gender: 'Other',
      phone: '',
      email: '',
      referringDoctor: '',
      sampleCollectedAt: now,
      sampleReceivedAt: now,
      reportGeneratedAt: now,
      sampleBarcode: `SMPL-${String(timestamp).slice(-6)}`,
      sampleType: template.sampleType,
      fastingStatus: 'N/A',
    },
    tests: [panel],
    clinicalImpression: '',
    pathologistNotes: '',
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
