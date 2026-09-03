import { DiagnosticReport, TestPanel } from '@/domain/types';

export interface ClinicalImpressionResult {
  impression?: string;
  pathologistNote?: string;
  patientSummaryEn?: string;
  patientSummaryHi?: string;
  keyHighlights?: string[];
  dietaryAdvice?: string;
}

export async function generateClinicalImpression(
  report: DiagnosticReport,
): Promise<ClinicalImpressionResult> {
  const abnormalParameters = report.tests.flatMap((test) =>
    test.parameters
      .filter((parameter) => parameter.flag && parameter.flag !== 'NORMAL')
      .map((parameter) => ({
        test: test.testName,
        name: parameter.name,
        value: parameter.value,
        unit: parameter.unit,
        flag: parameter.flag,
        refRange: parameter.refRange,
      })),
  );

  const response = await fetch('/api/ai/clinical-impression', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      patient: report.patient,
      tests: report.tests.map((test: TestPanel) => ({
        name: test.testName,
        parameters: test.parameters.map((parameter) => ({
          name: parameter.name,
          value: parameter.value,
          unit: parameter.unit,
          flag: parameter.flag,
        })),
      })),
      abnormalParameters,
      notes: report.pathologistNotes,
    }),
  });

  if (!response.ok) {
    throw new Error('AI interpretation service temporarily unavailable');
  }

  return response.json() as Promise<ClinicalImpressionResult>;
}

export interface PrescriptionParseResult {
  suggestedTestIds?: string[];
  patientName?: string;
  patientAge?: number;
  patientGender?: string;
  doctorName?: string;
  fastingRequired?: boolean;
  specialInstructions?: string;
}

export async function parseDoctorPrescription(
  rxText: string,
): Promise<PrescriptionParseResult> {
  const response = await fetch('/api/ai/parse-doctor-rx', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ rxText }),
  });

  if (!response.ok) {
    throw new Error('Failed to parse prescription');
  }

  return response.json() as Promise<PrescriptionParseResult>;
}
