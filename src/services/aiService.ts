import { DiagnosticReport, TestPanel } from '@/domain/types';
import { isClinicallyAbnormalFlag } from '@/domain/rangeEvaluator';

const AI_CLIENT_TIMEOUT_MS = 30_000;

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

async function postJson<T>(url: string, body: unknown): Promise<T> {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), AI_CLIENT_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    if (!response.ok) throw new Error('AI service temporarily unavailable');
    const payload: unknown = await response.json();
    if (!isRecord(payload)) throw new Error('AI service returned an invalid response');
    return payload as T;
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new Error('AI service request timed out');
    }
    throw error;
  } finally {
    window.clearTimeout(timeout);
  }
}

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
      .filter((parameter) => isClinicallyAbnormalFlag(parameter.flag))
      .map((parameter) => ({
        test: test.testName,
        name: parameter.name,
        value: parameter.value,
        unit: parameter.unit,
        flag: parameter.flag,
        refRange: parameter.refRange,
      })),
  );

  return postJson<ClinicalImpressionResult>('/api/ai/clinical-impression', {
    // Do not send direct identifiers or contact details to the AI provider.
    patient: {
      age: report.patient.age,
      ageUnit: report.patient.ageUnit,
      gender: report.patient.gender,
      sampleType: report.patient.sampleType,
      fastingStatus: report.patient.fastingStatus,
    },
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
  });
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
  return postJson<PrescriptionParseResult>('/api/ai/parse-doctor-rx', { rxText });
}
