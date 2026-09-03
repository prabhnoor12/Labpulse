import { DiagnosticReport, Gender, TestTemplate } from '@/domain/types';
import { computeDerivedValues } from '@/domain/rangeEvaluator';
import { createPanelFromTemplate } from '@/features/reports/reportFactory';
import { PrescriptionParseResult } from '@/services/aiService';

function matchTemplate(query: string, templates: TestTemplate[]): TestTemplate | undefined {
  const normalizedQuery = query.toLowerCase().trim();

  return templates.find((template) => {
    const id = template.id.toLowerCase();
    const code = template.code.toLowerCase();
    const name = template.name.toLowerCase();

    if (id === normalizedQuery || code.includes(normalizedQuery) || name.includes(normalizedQuery)) {
      return true;
    }

    if ((normalizedQuery === 'cbc' || normalizedQuery.includes('hemo') || normalizedQuery.includes('platelet')) && id === 'cbc') return true;
    if ((normalizedQuery === 'lft' || normalizedQuery.includes('liver') || normalizedQuery.includes('sgot') || normalizedQuery.includes('sgpt') || normalizedQuery.includes('bili')) && id === 'lft') return true;
    if ((normalizedQuery === 'kft' || normalizedQuery === 'rft' || normalizedQuery.includes('kidney') || normalizedQuery.includes('renal') || normalizedQuery.includes('creatinine') || normalizedQuery.includes('urea')) && id === 'kft') return true;
    if ((normalizedQuery === 'lipid' || normalizedQuery.includes('cholesterol') || normalizedQuery.includes('triglyceride')) && id === 'lipid') return true;
    if ((normalizedQuery === 'diabetes' || normalizedQuery === 'fbs_ppbs' || normalizedQuery.includes('sugar') || normalizedQuery.includes('glucose') || normalizedQuery.includes('hba1c')) && id === 'diabetes') return true;
    if ((normalizedQuery === 'thyroid' || normalizedQuery.includes('tsh') || normalizedQuery.includes('t3') || normalizedQuery.includes('t4')) && id === 'thyroid') return true;
    if ((normalizedQuery === 'urine' || normalizedQuery === 'urine_rm' || normalizedQuery.includes('routine')) && id === 'urine_rm') return true;
    if ((normalizedQuery === 'vitamins' || normalizedQuery.includes('vit') || normalizedQuery.includes('b12')) && id === 'vitamins') return true;
    if ((normalizedQuery === 'fever' || normalizedQuery === 'fever_serology' || normalizedQuery.includes('widal') || normalizedQuery.includes('dengue') || normalizedQuery.includes('malaria') || normalizedQuery.includes('crp') || normalizedQuery.includes('typhoid')) && id === 'fever_serology') return true;

    return false;
  });
}

export function applyPrescriptionToReport(
  report: DiagnosticReport,
  templates: TestTemplate[],
  data: PrescriptionParseResult,
): { report: DiagnosticReport; panelCount: number } {
  const patient = { ...report.patient };
  if (data.patientName) patient.name = data.patientName;
  if (data.patientAge) patient.age = data.patientAge;
  if (data.patientGender && ['Male', 'Female', 'Other'].includes(data.patientGender)) {
    patient.gender = data.patientGender as Gender;
  }
  if (data.doctorName) patient.referringDoctor = data.doctorName;
  if (data.fastingRequired) patient.fastingStatus = 'Fasting (12h)';

  const panels = (data.suggestedTestIds || [])
    .map((id) => matchTemplate(id, templates))
    .filter((template): template is TestTemplate => Boolean(template))
    .filter((template, index, all) => all.findIndex((item) => item.id === template.id) === index)
    .map((template) => {
      const panel = createPanelFromTemplate(template, patient.gender);
      return {
        ...panel,
        parameters: computeDerivedValues(panel.parameters),
      };
    });

  const tests = panels.length > 0 ? panels : report.tests;
  const totalAmount = tests.reduce((sum, test) => sum + test.price, 0);

  return {
    report: {
      ...report,
      patient,
      tests,
      pathologistNotes: data.specialInstructions
        ? `Requisition instruction: ${data.specialInstructions}`
        : report.pathologistNotes,
      billing: {
        ...report.billing,
        totalAmount,
        netAmount: Math.max(0, totalAmount - report.billing.discount),
      },
    },
    panelCount: panels.length,
  };
}
