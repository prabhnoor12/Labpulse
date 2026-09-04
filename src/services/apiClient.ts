import { createId } from '@/app/identifiers';
import { DiagnosticReport, DispatchAttempt, LabProfile, TestTemplate } from '@/domain/types';

export interface ApiUser {
  id: string;
  labId: string;
  email: string;
  name: string;
  role: 'OWNER' | 'PATHOLOGIST' | 'TECHNICIAN' | 'RECEPTIONIST' | 'VIEWER';
}

export type CurrentUser = ApiUser;

export interface StaffUser {
  id: string;
  name: string;
  email: string;
  role: Exclude<ApiUser['role'], 'OWNER'>;
  active: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface BackendReportRecord {
  id: string;
  reportNumber: string;
  clientId?: string | null;
  accessionNumber?: string | null;
  currentVersion?: number;
  status: string;
  data: Record<string, unknown>;
  patient: { id: string; uhid: string; name: string; phone: string; data?: Record<string, unknown> };
  dispatchAttempts?: DispatchAttempt[];
  verifiedBy: string | null;
  verifiedAt: string | null;
  dispatchedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PublicReportResponse {
  reportNumber: string;
  status: string;
  data: Record<string, unknown>;
  patient: { uhid: string; name: string; data?: Record<string, unknown> };
  lab: Record<string, unknown>;
  verifiedAt: string | null;
  dispatchedAt: string | null;
}

export class ApiError extends Error {
  constructor(public readonly status: number, message: string) {
    super(message);
    this.name = 'ApiError';
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

async function request<T>(path: string, init: RequestInit = {}, onSuccess?: (response: Response) => void): Promise<T> {
  let response: Response;
  try {
    response = await fetch(path, {
      ...init,
      credentials: 'include',
      headers: { 'Content-Type': 'application/json', ...(init.headers || {}) },
    });
  } catch {
    throw new ApiError(0, 'The server is unavailable. Please try again.');
  }

  const text = await response.text();
  let payload: unknown;
  try {
    payload = text ? JSON.parse(text) : undefined;
  } catch {
    payload = undefined;
  }

  if (!response.ok) {
    if (response.status === 401 && !path.startsWith('/api/auth/') && typeof window !== 'undefined') {
      window.dispatchEvent(new Event('labpulse-session-expired'));
    }
    const message = isRecord(payload) && typeof payload.error === 'string' ? payload.error : 'Request failed.';
    throw new ApiError(response.status, message);
  }
  onSuccess?.(response);
  return payload as T;
}

let labProfileEtag = '"0"';
let templatesEtag = '"0"';

export function toDiagnosticReport(record: BackendReportRecord | PublicReportResponse): DiagnosticReport {
  const data = isRecord(record.data) ? record.data : {};
  const dataPatient = isRecord(data.patient) ? data.patient : {};
  const backendPatient = record.patient;
  const dataBilling = isRecord(data.billing) ? data.billing : {};
  const status: DiagnosticReport['status'] = record.status === 'READY_FOR_REVIEW' || record.status === 'VERIFIED' || record.status === 'DISPATCHED' || record.status === 'ARCHIVED' || record.status === 'SUPERSEDED'
    ? record.status
    : 'DRAFT';

  return {
    ...(data as unknown as DiagnosticReport),
    id: 'id' in record ? record.id : String(data.id || record.reportNumber),
    reportNumber: record.reportNumber,
    supersedesReportId: typeof data.supersedesReportId === 'string' ? data.supersedesReportId : undefined,
    amendmentReason: typeof data.amendmentReason === 'string' ? data.amendmentReason : undefined,
    amendmentNumber: typeof data.amendmentNumber === 'number' ? data.amendmentNumber : undefined,
    version: 'currentVersion' in record && typeof record.currentVersion === 'number'
      ? record.currentVersion
      : typeof data.version === 'number' ? data.version : undefined,
    offlinePending: false,
    patient: {
      ...(dataPatient as unknown as DiagnosticReport['patient']),
      ...(backendPatient.data || {}),
      id: String('id' in backendPatient ? backendPatient.id : dataPatient.id || `patient-${record.reportNumber}`),
      uhid: backendPatient.uhid,
      accessionNumber: String(('accessionNumber' in record && record.accessionNumber) || dataPatient.accessionNumber || ''),
      name: backendPatient.name,
      phone: 'phone' in backendPatient ? backendPatient.phone : '',
      specimenStatus: ['ORDERED', 'COLLECTED', 'RECEIVED', 'PROCESSING', 'REJECTED', 'RESULTS_PENDING', 'COMPLETE'].includes(String(dataPatient.specimenStatus))
        ? String(dataPatient.specimenStatus) as DiagnosticReport['patient']['specimenStatus']
        : 'ORDERED',
      sampleRejectionReason: typeof dataPatient.sampleRejectionReason === 'string' ? dataPatient.sampleRejectionReason : '',
      sampleCollectedBy: typeof dataPatient.sampleCollectedBy === 'string' ? dataPatient.sampleCollectedBy : '',
      sampleReceivedBy: typeof dataPatient.sampleReceivedBy === 'string' ? dataPatient.sampleReceivedBy : '',
    },
    tests: Array.isArray(data.tests) ? data.tests as DiagnosticReport['tests'] : [],
    billing: {
      totalAmount: 0,
      discount: 0,
      netAmount: 0,
      paidAmount: 0,
      paymentMethod: 'UPI',
      paymentStatus: 'UNPAID',
      ...(dataBilling as Partial<DiagnosticReport['billing']>),
    },
    clinicalImpression: typeof data.clinicalImpression === 'string' ? data.clinicalImpression : '',
    pathologistNotes: typeof data.pathologistNotes === 'string' ? data.pathologistNotes : '',
    patientSummaryEn: typeof data.patientSummaryEn === 'string' ? data.patientSummaryEn : '',
    patientSummaryHi: typeof data.patientSummaryHi === 'string' ? data.patientSummaryHi : '',
    selectedSignatoryId: typeof data.selectedSignatoryId === 'string' ? data.selectedSignatoryId : '',
    keyHighlights: Array.isArray(data.keyHighlights) ? data.keyHighlights as string[] : [],
    dietaryAdvice: typeof data.dietaryAdvice === 'string' ? data.dietaryAdvice : '',
    status,
    verifiedAt: record.verifiedAt || undefined,
    verifiedBy: 'verifiedBy' in record ? record.verifiedBy || undefined : undefined,
    whatsAppLogs: Array.isArray(data.whatsAppLogs) ? data.whatsAppLogs as DiagnosticReport['whatsAppLogs'] : [],
    dispatchAttempts: 'dispatchAttempts' in record && Array.isArray(record.dispatchAttempts)
      ? record.dispatchAttempts
      : [],
    createdAt: typeof data.createdAt === 'string' ? data.createdAt : ('createdAt' in record ? record.createdAt : new Date().toISOString()),
    updatedAt: typeof data.updatedAt === 'string' ? data.updatedAt : ('updatedAt' in record ? record.updatedAt : new Date().toISOString()),
  };
}

function reportPayload(report: DiagnosticReport) {
  const { offlinePending: _offlinePending, ...serverData } = report;
  return {
    reportNumber: report.reportNumber,
    clientId: report.id,
    ...(report.version === undefined ? {} : { version: report.version }),
    patient: {
      uhid: report.patient.uhid,
      name: report.patient.name,
      phone: report.patient.phone,
      data: report.patient,
    },
    data: serverData,
  };
}

function mutationHeaders(idempotencyKey: string): HeadersInit {
  return { 'Idempotency-Key': idempotencyKey };
}

export const apiClient = {
  signup(labName: string, name: string, email: string, password: string) {
    return request<{ user: ApiUser }>('/api/auth/signup', {
      method: 'POST',
      body: JSON.stringify({ labName, name, email, password }),
    });
  },
  login(email: string, password: string) {
    return request<{ user: ApiUser }>('/api/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) });
  },
  me() {
    return request<{ user: ApiUser }>('/api/auth/me');
  },
  staffUsers() {
    return request<{ users: StaffUser[] }>('/api/users');
  },
  createStaff(input: { name: string; email: string; password: string; role: StaffUser['role'] }) {
    return request<{ user: StaffUser }>('/api/users', { method: 'POST', body: JSON.stringify(input) });
  },
  updateStaff(id: string, input: { name?: string; password?: string; role?: StaffUser['role']; active?: boolean }) {
    return request<{ user: StaffUser }>(`/api/users/${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify(input) });
  },
  logout() {
    return request<void>('/api/auth/logout', { method: 'POST' });
  },
  labProfile() {
    return request<{ profile: Partial<LabProfile>; updatedAt: string | null; version: number }>('/api/lab/profile', {}, (response) => {
      labProfileEtag = response.headers.get('ETag') || '"0"';
    });
  },
  updateLabProfile(profile: LabProfile) {
    return request<{ profile: LabProfile; updatedAt: string; version: number }>('/api/lab/profile', {
      method: 'PATCH',
      headers: { 'If-Match': labProfileEtag },
      body: JSON.stringify(profile),
    }, (response) => {
      labProfileEtag = response.headers.get('ETag') || labProfileEtag;
    });
  },
  reports(limit = 100, offset = 0) {
    return request<{ reports: BackendReportRecord[] }>(`/api/reports?limit=${limit}&offset=${offset}`);
  },
  createReport(report: DiagnosticReport, idempotencyKey = `create-${report.id}`) {
    return request<{ report: BackendReportRecord }>('/api/reports', { method: 'POST', headers: mutationHeaders(idempotencyKey), body: JSON.stringify(reportPayload(report)) });
  },
  updateReport(report: DiagnosticReport, idempotencyKey = `update-${report.id}-${report.version ?? report.updatedAt}`) {
    return request<{ report: BackendReportRecord }>(`/api/reports/${encodeURIComponent(report.id)}`, { method: 'PATCH', headers: mutationHeaders(idempotencyKey), body: JSON.stringify(reportPayload(report)) });
  },
  submitReport(id: string, version?: number, idempotencyKey = `submit-${id}-${version ?? 'latest'}`) {
    return request<{ report: BackendReportRecord }>(`/api/reports/${encodeURIComponent(id)}/submit`, { method: 'POST', headers: mutationHeaders(idempotencyKey), body: JSON.stringify(version === undefined ? {} : { version }) });
  },
  verifyReport(id: string, version?: number, idempotencyKey = `verify-${id}-${version ?? 'latest'}`) {
    return request<{ report: BackendReportRecord }>(`/api/reports/${encodeURIComponent(id)}/verify`, { method: 'POST', headers: mutationHeaders(idempotencyKey), body: JSON.stringify(version === undefined ? {} : { version }) });
  },
  acknowledgeCriticalResults(id: string, version: number | undefined, notes: string, idempotencyKey = `critical-ack-${id}-${version ?? 'latest'}`) {
    return request<{ report: BackendReportRecord }>(`/api/reports/${encodeURIComponent(id)}/critical-results/acknowledge`, {
      method: 'POST',
      headers: mutationHeaders(idempotencyKey),
      body: JSON.stringify({ ...(version === undefined ? {} : { version }), notes }),
    });
  },
  amendReport(id: string, reason: string, idempotencyKey = `amend-${id}-${crypto.randomUUID()}`) {
    return request<{ report: BackendReportRecord }>(`/api/reports/${encodeURIComponent(id)}/amend`, {
      method: 'POST',
      headers: mutationHeaders(idempotencyKey),
      body: JSON.stringify({ reason }),
    });
  },
  dispatchReport(id: string, dispatchLog?: Record<string, unknown>, version?: number, idempotencyKey = `dispatch-${id}-${crypto.randomUUID()}`) {
    return request<{ report: BackendReportRecord }>(`/api/reports/${encodeURIComponent(id)}/dispatch`, {
      method: 'POST',
      headers: mutationHeaders(idempotencyKey),
      body: JSON.stringify({ ...(dispatchLog || {}), ...(version === undefined ? {} : { version }) }),
    });
  },
  dispatchAttempts(id: string) {
    return request<{ attempts: DispatchAttempt[] }>(`/api/reports/${encodeURIComponent(id)}/dispatch-attempts`);
  },
  archiveReport(id: string, version?: number, idempotencyKey = `archive-${id}-${version ?? 'latest'}`) {
    return request<{ report: BackendReportRecord }>(`/api/reports/${encodeURIComponent(id)}/archive`, { method: 'POST', headers: mutationHeaders(idempotencyKey), body: JSON.stringify(version === undefined ? {} : { version }) });
  },
  createPublicLink(id: string, version?: number, idempotencyKey = createId(`public-link-${id}`)) {
    return request<{ link: { token: string; expiresAt: string } }>(`/api/reports/${encodeURIComponent(id)}/public-link`, { method: 'POST', headers: mutationHeaders(idempotencyKey), body: JSON.stringify(version === undefined ? {} : { version }) });
  },
  publicReport(token: string) {
    return request<{ report: PublicReportResponse }>(`/api/public/reports/${encodeURIComponent(token)}`);
  },
  templates() {
    return request<{ templates: Array<{ templateKey: string; data: Record<string, unknown> }>; version: number }>('/api/lab/templates', {}, (response) => {
      templatesEtag = response.headers.get('ETag') || '"0"';
    });
  },
  saveTemplates(templates: TestTemplate[]) {
    return request<{ templates: Array<{ id: string; data: Record<string, unknown> }> }>('/api/lab/templates', {
      method: 'PUT',
      headers: { 'If-Match': templatesEtag },
      body: JSON.stringify(templates.map((template) => ({ id: template.id, data: template }))),
    }, (response) => {
      templatesEtag = response.headers.get('ETag') || templatesEtag;
    }).then(({ templates: saved }) => saved.map((item) => ({ ...(item.data as unknown as TestTemplate), id: item.id })));
  },
};

export const api = {
  async me(): Promise<CurrentUser> {
    return (await apiClient.me()).user;
  },
  async login(email: string, password: string): Promise<CurrentUser> {
    return (await apiClient.login(email, password)).user;
  },
  async signup(labName: string, name: string, email: string, password: string): Promise<CurrentUser> {
    return (await apiClient.signup(labName, name, email, password)).user;
  },
  logout: apiClient.logout,
  async staffUsers(): Promise<StaffUser[]> {
    return (await apiClient.staffUsers()).users;
  },
  async createStaff(input: { name: string; email: string; password: string; role: StaffUser['role'] }): Promise<StaffUser> {
    return (await apiClient.createStaff(input)).user;
  },
  async updateStaff(id: string, input: { name?: string; password?: string; role?: StaffUser['role']; active?: boolean }): Promise<StaffUser> {
    return (await apiClient.updateStaff(id, input)).user;
  },
  async labProfile(): Promise<LabProfile> {
    return (await apiClient.labProfile()).profile as LabProfile;
  },
  async saveLabProfile(profile: LabProfile): Promise<LabProfile> {
    return (await apiClient.updateLabProfile(profile)).profile as LabProfile;
  },
  async templates(): Promise<TestTemplate[]> {
    const result = await apiClient.templates();
    return result.templates.map((item) => ({ ...(item.data as unknown as TestTemplate), id: item.templateKey }));
  },
  async saveTemplates(templates: TestTemplate[]): Promise<TestTemplate[]> {
    return apiClient.saveTemplates(templates);
  },
  async reports(): Promise<DiagnosticReport[]> {
    const pageSize = 100;
    const records: BackendReportRecord[] = [];
    let offset = 0;
    while (true) {
      const page = (await apiClient.reports(pageSize, offset)).reports;
      records.push(...page);
      if (page.length < pageSize) break;
      offset += pageSize;
    }
    return records.map(toDiagnosticReport);
  },
  async createReport(report: DiagnosticReport, idempotencyKey?: string): Promise<DiagnosticReport> {
    return toDiagnosticReport((await apiClient.createReport(report, idempotencyKey)).report);
  },
  async updateReport(report: DiagnosticReport, idempotencyKey?: string): Promise<DiagnosticReport> {
    return toDiagnosticReport((await apiClient.updateReport(report, idempotencyKey)).report);
  },
  async submitReport(id: string, version?: number): Promise<DiagnosticReport> {
    return toDiagnosticReport((await apiClient.submitReport(id, version)).report);
  },
  async verifyReport(id: string, version?: number): Promise<DiagnosticReport> {
    return toDiagnosticReport((await apiClient.verifyReport(id, version)).report);
  },
  async acknowledgeCriticalResults(id: string, version: number | undefined, notes: string): Promise<DiagnosticReport> {
    return toDiagnosticReport((await apiClient.acknowledgeCriticalResults(id, version, notes)).report);
  },
  async amendReport(id: string, reason: string): Promise<DiagnosticReport> {
    return toDiagnosticReport((await apiClient.amendReport(id, reason)).report);
  },
  async dispatchReport(id: string, dispatchLog?: Record<string, unknown>, version?: number): Promise<DiagnosticReport> {
    return toDiagnosticReport((await apiClient.dispatchReport(id, dispatchLog, version)).report);
  },
  async archiveReport(id: string, version?: number): Promise<void> {
    await apiClient.archiveReport(id, version);
  },
  async createPublicLink(id: string, version?: number): Promise<{ token: string; expiresAt: string }> {
    return (await apiClient.createPublicLink(id, version)).link;
  },
};
