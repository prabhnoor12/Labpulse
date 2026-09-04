function randomUuid(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }

  // Compatibility fallback for older browsers.
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`;
}

export function createId(prefix: string): string {
  return `${prefix}-${randomUuid()}`;
}

function localDatePart(date: Date): string {
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}`;
}

export function createReportNumber(date = new Date()): string {
  const datePart = localDatePart(date);
  const uniquePart = randomUuid().replace(/-/g, '').slice(0, 8).toUpperCase();
  return `LAB-${datePart}-${uniquePart}`;
}

export function createAccessionNumber(date = new Date()): string {
  const datePart = localDatePart(date);
  const uniquePart = randomUuid().replace(/-/g, '').slice(0, 8).toUpperCase();
  return `ACC-${datePart}-${uniquePart}`;
}

export function createUhid(date = new Date()): string {
  const datePart = localDatePart(date).slice(2);
  const uniquePart = randomUuid().replace(/-/g, '').slice(0, 6).toUpperCase();
  return `UHID-${datePart}-${uniquePart}`;
}
