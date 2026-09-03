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

export function createReportNumber(date = new Date()): string {
  const datePart = date.toISOString().slice(0, 10).replace(/-/g, '');
  const uniquePart = randomUuid().replace(/-/g, '').slice(0, 8).toUpperCase();
  return `LAB-${datePart}-${uniquePart}`;
}

export function createUhid(date = new Date()): string {
  const datePart = date.toISOString().slice(2, 10).replace(/-/g, '');
  const uniquePart = randomUuid().replace(/-/g, '').slice(0, 6).toUpperCase();
  return `UHID-${datePart}-${uniquePart}`;
}
