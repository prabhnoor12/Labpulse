import { LabProfile, TestTemplate } from '@/domain/types';

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

export function isLabProfile(value: unknown): value is LabProfile {
  return isRecord(value)
    && typeof value.id === 'string'
    && typeof value.name === 'string'
    && Array.isArray(value.accreditations)
    && Array.isArray(value.signatories);
}

export function isTestTemplateList(value: unknown): value is TestTemplate[] {
  return Array.isArray(value) && value.every((template) => (
    isRecord(template)
    && typeof template.id === 'string'
    && typeof template.name === 'string'
    && Array.isArray(template.parameters)
  ));
}
