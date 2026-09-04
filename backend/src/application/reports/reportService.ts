import crypto from 'node:crypto';
import type { PoolClient } from 'pg';
import { pool, transaction, one } from '../../db/pool';
import { env } from '../../config/env';
import type { AuthenticatedUser, UserRole } from '../../auth/types';
import { ReportValidationError, validateReportForVerification } from './reportValidation';
import { executeIdempotent, type IdempotencyContext } from '../../db/idempotency';

export interface ReportInput {
  reportNumber?: string;
  clientId?: string;
  version?: number;
  patient: {
    uhid: string;
    name: string;
    phone: string;
    data?: Record<string, unknown>;
  };
  data: Record<string, unknown>;
}

export interface ReportRecord {
  id: string;
  labId: string;
  patientId: string;
  reportNumber: string;
  accessionNumber: string | null;
  supersedesReportId: string | null;
  amendmentReason: string | null;
  amendmentNumber: number | null;
  clientId: string | null;
  status: string;
  currentVersion: number;
  data: Record<string, unknown>;
  patient: { id: string; uhid: string; name: string; phone: string; data: Record<string, unknown> };
  verifiedBy: string | null;
  verifiedAt: string | null;
  dispatchedAt: string | null;
  createdAt: string;
  updatedAt: string;
  dispatchAttempts: DispatchAttemptRecord[];
}

export interface DispatchAttemptRecord {
  id: string;
  reportId: string;
  channel: 'DIRECT_WHATSAPP' | 'WA_WEB' | 'COPY';
  recipientPhone: string;
  templateType: 'standard' | 'detailed' | 'urgent' | 'hindi';
  status: 'PENDING' | 'SENT' | 'FAILED' | 'UNAVAILABLE';
  providerMessageId: string | null;
  errorMessage: string | null;
  attemptNumber: number;
  sentAt: string | null;
  failedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PublicReportRecord {
  reportNumber: string;
  status: string;
  data: Record<string, unknown>;
  patient: { uhid: string; name: string; data: Record<string, unknown> };
  lab: Record<string, unknown>;
  verifiedAt: string | null;
  dispatchedAt: string | null;
}

function reportNumber(): string {
  const date = new Date().toISOString().slice(0, 10).replaceAll('-', '');
  return `LAB-${date}-${crypto.randomInt(1000, 10000)}`;
}

function hashPublicToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function stringField(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function numberField(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function arrayField(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function hasCriticalResults(data: Record<string, unknown>): boolean {
  return arrayField(data.tests).filter(isRecord).some((test) => (
    arrayField(test.parameters).some((parameter) => (
      isRecord(parameter) && (parameter.flag === 'CRITICAL_LOW' || parameter.flag === 'CRITICAL_HIGH')
    ))
  ));
}

function publicString(value: unknown, maxLength = 2_000): string | undefined {
  const result = stringField(value).trim().slice(0, maxLength);
  return result || undefined;
}

function publicStringArray(value: unknown, maxItems: number, maxLength = 500): string[] {
  return arrayField(value)
    .filter((item): item is string => typeof item === 'string')
    .map((item) => item.trim().slice(0, maxLength))
    .filter(Boolean)
    .slice(0, maxItems);
}

const publicFlags = new Set([
  'NORMAL', 'PENDING', 'INVALID', 'LOW', 'HIGH', 'CRITICAL_LOW', 'CRITICAL_HIGH',
  'ABNORMAL', 'POSITIVE', 'REACTIVE', 'NEGATIVE', 'NON_REACTIVE',
]);

function sanitizePublicPatientData(data: unknown): Record<string, unknown> {
  if (!isRecord(data)) return {};
  const safe: Record<string, unknown> = {};
  const age = numberField(data.age);
  if (age !== null) safe.age = age;

  for (const field of [
    'ageUnit', 'gender', 'referringDoctor', 'sampleCollectedAt', 'sampleReceivedAt',
    'reportGeneratedAt', 'sampleType', 'accessionNumber', 'specimenStatus',
    'sampleRejectionReason', 'sampleCollectedBy', 'sampleReceivedBy', 'fastingStatus', 'sampleBarcode',
  ]) {
    const value = publicString(data[field]);
    if (value) safe[field] = value;
  }
  return safe;
}

function sanitizePublicTests(value: unknown): unknown[] {
  return arrayField(value).filter(isRecord).slice(0, 100).map((panel) => {
    const safe: Record<string, unknown> = {};
    for (const field of ['id', 'templateId', 'testName', 'category', 'sampleType', 'method', 'clinicalInterpretation']) {
      const value = publicString(panel[field]);
      if (value) safe[field] = value;
    }
    const price = numberField(panel.price);
    if (price !== null) safe.price = price;

    safe.parameters = arrayField(panel.parameters).filter(isRecord).slice(0, 500).map((parameter) => {
      const safeParameter: Record<string, unknown> = {};
      for (const field of ['id', 'name', 'shortName', 'value', 'unit', 'method', 'refRange', 'subCategory', 'notes']) {
        const value = publicString(parameter[field]);
        if (value) safeParameter[field] = value;
      }
      for (const field of ['minVal', 'maxVal', 'criticalMin', 'criticalMax']) {
        const value = numberField(parameter[field]);
        if (value !== null) safeParameter[field] = value;
      }
      if (typeof parameter.isCalculated === 'boolean') safeParameter.isCalculated = parameter.isCalculated;
      if (typeof parameter.flag === 'string' && publicFlags.has(parameter.flag)) safeParameter.flag = parameter.flag;
      safeParameter.options = publicStringArray(parameter.options, 50, 200);
      return safeParameter;
    });
    return safe;
  });
}

export function sanitizePublicData(data: Record<string, unknown>): Record<string, unknown> {
  const safe: Record<string, unknown> = {};
  for (const field of ['clinicalImpression', 'pathologistNotes', 'patientSummaryEn', 'patientSummaryHi', 'dietaryAdvice', 'selectedSignatoryId', 'createdAt', 'updatedAt']) {
    const value = publicString(data[field], 10_000);
    if (value) safe[field] = value;
  }
  safe.keyHighlights = publicStringArray(data.keyHighlights, 20, 500);
  safe.tests = sanitizePublicTests(data.tests);
  safe.patient = sanitizePublicPatientData(data.patient);
  return safe;
}

export function sanitizePublicLab(data: Record<string, unknown>): Record<string, unknown> {
  const safe: Record<string, unknown> = {};
  for (const field of [
    'name', 'tagline', 'regNumber', 'addressLine1', 'addressLine2', 'city', 'state',
    'pincode', 'phone', 'whatsapp', 'email', 'website', 'logoUrl', 'watermarkText',
    'footerDisclaimer', 'technologistName', 'technologistDegrees',
  ]) {
    const value = publicString(data[field]);
    if (value) safe[field] = value;
  }
  safe.accreditations = publicStringArray(data.accreditations, 10, 200);
  if (typeof data.showWatermark === 'boolean') safe.showWatermark = data.showWatermark;
  safe.signatories = arrayField(data.signatories).filter(isRecord).slice(0, 20).map((signatory) => {
    const safeSignatory: Record<string, unknown> = {};
    for (const field of ['id', 'name', 'degrees', 'regNumber', 'designation', 'signatureText']) {
      const value = publicString(signatory[field]);
      if (value) safeSignatory[field] = value;
    }
    return safeSignatory;
  });
  return safe;
}

function uniqueKey(value: unknown, fallback: string, used: Set<string>): string {
  const base = (stringField(value) || fallback).slice(0, 100);
  let key = base;
  let suffix = 2;
  while (used.has(key)) {
    key = `${base.slice(0, 100 - String(suffix).length - 1)}-${suffix}`;
    suffix += 1;
  }
  used.add(key);
  return key;
}

function stripNormalizedFields(data: Record<string, unknown>): Record<string, unknown> {
  const flexibleData = { ...data };
  delete flexibleData.tests;
  delete flexibleData.billing;
  return flexibleData;
}

async function replaceNormalizedReportCore(client: PoolClient, reportId: string, data: Record<string, unknown>): Promise<void> {
  const tests = arrayField(data.tests).filter(isRecord);
  const billing = isRecord(data.billing) ? data.billing : {};

  await client.query('DELETE FROM report_billing WHERE report_id = $1', [reportId]);
  await client.query('DELETE FROM report_test_panels WHERE report_id = $1', [reportId]);

  await client.query(
    `INSERT INTO report_billing (report_id, total_amount, discount, net_amount, paid_amount, payment_method, payment_status, transaction_ref)
     VALUES ($1, COALESCE($2, 0), COALESCE($3, 0), COALESCE($4, 0), COALESCE($5, 0), COALESCE($6, 'UPI'), COALESCE($7, 'UNPAID'), $8)`,
    [
      reportId,
      numberField(billing.totalAmount),
      numberField(billing.discount),
      numberField(billing.netAmount),
      numberField(billing.paidAmount),
      stringField(billing.paymentMethod) || 'UPI',
      stringField(billing.paymentStatus) || 'UNPAID',
      stringField(billing.transactionRef) || null,
    ],
  );

  const usedPanelKeys = new Set<string>();
  for (const [panelIndex, panel] of tests.entries()) {
    const panelId = crypto.randomUUID();
    const panelKey = uniqueKey(panel.id, `panel-${panelIndex + 1}`, usedPanelKeys);
    await client.query(
      `INSERT INTO report_test_panels
        (id, report_id, panel_key, position, template_id, test_name, category, sample_type, method, price, clinical_interpretation)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, COALESCE($10, 0), $11)`,
      [
        panelId,
        reportId,
        panelKey,
        panelIndex,
        stringField(panel.templateId).slice(0, 128),
        stringField(panel.testName),
        stringField(panel.category),
        stringField(panel.sampleType),
        stringField(panel.method),
        numberField(panel.price),
        stringField(panel.clinicalInterpretation),
      ],
    );

    const parameters = arrayField(panel.parameters).filter(isRecord);
    const usedParameterKeys = new Set<string>();
    for (const [parameterIndex, parameter] of parameters.entries()) {
      await client.query(
        `INSERT INTO report_test_parameters
          (id, panel_id, parameter_key, position, name, short_name, value, unit, method, ref_range,
           min_val, max_val, critical_min, critical_max, flag, options, sub_category, is_calculated, notes)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19)`,
        [
          crypto.randomUUID(),
          panelId,
          uniqueKey(parameter.id, `parameter-${parameterIndex + 1}`, usedParameterKeys),
          parameterIndex,
          stringField(parameter.name),
          stringField(parameter.shortName),
          stringField(parameter.value),
          stringField(parameter.unit),
          stringField(parameter.method),
          stringField(parameter.refRange),
          numberField(parameter.minVal),
          numberField(parameter.maxVal),
          numberField(parameter.criticalMin),
          numberField(parameter.criticalMax),
          stringField(parameter.flag) || null,
          JSON.stringify(arrayField(parameter.options)),
          stringField(parameter.subCategory),
          parameter.isCalculated === true,
          stringField(parameter.notes),
        ],
      );
    }
  }
}

const normalizedTestsSql = `(
  SELECT jsonb_agg(jsonb_build_object(
    'id', tp.panel_key, 'templateId', tp.template_id, 'testName', tp.test_name,
    'category', tp.category, 'sampleType', tp.sample_type, 'method', tp.method,
    'price', tp.price, 'clinicalInterpretation', tp.clinical_interpretation,
    'parameters', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', param.parameter_key, 'name', param.name, 'shortName', param.short_name,
        'value', param.value, 'unit', param.unit, 'method', param.method,
        'refRange', param.ref_range, 'minVal', param.min_val, 'maxVal', param.max_val,
        'criticalMin', param.critical_min, 'criticalMax', param.critical_max,
        'flag', param.flag, 'options', param.options, 'subCategory', param.sub_category,
        'isCalculated', param.is_calculated, 'notes', param.notes
      ) ORDER BY param.position)
      FROM report_test_parameters param WHERE param.panel_id = tp.id
    ), '[]'::jsonb)
  ) ORDER BY tp.position)
  FROM report_test_panels tp WHERE tp.report_id = r.id
)`;

const normalizedBillingSql = `(
  SELECT jsonb_build_object(
    'totalAmount', rb.total_amount, 'discount', rb.discount, 'netAmount', rb.net_amount,
    'paidAmount', rb.paid_amount, 'paymentMethod', rb.payment_method,
    'paymentStatus', rb.payment_status, 'transactionRef', rb.transaction_ref
  ) FROM report_billing rb WHERE rb.report_id = r.id
)`;

const currentReportDataSql = `(
  (r.data - 'tests' - 'billing')
  || CASE
       WHEN ${normalizedTestsSql} IS NOT NULL THEN jsonb_build_object('tests', ${normalizedTestsSql})
       WHEN r.data ? 'tests' THEN jsonb_build_object('tests', r.data->'tests')
       ELSE '{}'::jsonb
     END
  || CASE
       WHEN ${normalizedBillingSql} IS NOT NULL THEN jsonb_build_object('billing', ${normalizedBillingSql})
       WHEN r.data ? 'billing' THEN jsonb_build_object('billing', r.data->'billing')
       ELSE '{}'::jsonb
     END
)`;

async function audit(client: PoolClient, user: AuthenticatedUser, action: string, reportId: string, metadata: Record<string, unknown> = {}): Promise<void> {
  await client.query(
    `INSERT INTO audit_events (id, lab_id, user_id, action, entity_type, entity_id, metadata)
     VALUES ($1, $2, $3, $4, 'REPORT', $5, $6)`,
    [crypto.randomUUID(), user.labId, user.id, action, reportId, JSON.stringify(metadata)],
  );
}

const selectReport = `
  SELECT r.id, r.lab_id AS "labId", r.patient_id AS "patientId", r.report_number AS "reportNumber", r.client_id AS "clientId",
         r.accession_number AS "accessionNumber",
         r.supersedes_report_id AS "supersedesReportId", r.amendment_reason AS "amendmentReason", r.amendment_number AS "amendmentNumber",
         r.status, r.current_version AS "currentVersion", ${currentReportDataSql} AS data,
         r.verified_by AS "verifiedBy", r.verified_at AS "verifiedAt", r.dispatched_at AS "dispatchedAt",
         r.created_at AS "createdAt", r.updated_at AS "updatedAt",
         json_build_object(
           'id', p.id,
           'uhid', COALESCE(r.data->'patient'->>'uhid', p.uhid),
           'name', COALESCE(r.data->'patient'->>'name', p.name),
           'phone', COALESCE(r.data->'patient'->>'phone', p.phone),
           'data', CASE WHEN jsonb_typeof(r.data->'patient') = 'object' THEN r.data->'patient' ELSE p.data END
         ) AS patient,
         COALESCE((
           SELECT json_agg(json_build_object(
             'id', da.id, 'reportId', da.report_id, 'channel', da.channel,
             'recipientPhone', da.recipient_phone, 'templateType', da.template_type,
             'status', da.status, 'providerMessageId', da.provider_message_id,
             'errorMessage', da.error_message, 'attemptNumber', da.attempt_number,
             'sentAt', da.sent_at, 'failedAt', da.failed_at,
             'createdAt', da.created_at, 'updatedAt', da.updated_at
           ) ORDER BY da.created_at DESC)
           FROM dispatch_attempts da
          WHERE da.report_id = r.id AND da.lab_id = r.lab_id
         ), '[]'::json) AS "dispatchAttempts"
    FROM reports r JOIN patients p ON p.id = r.patient_id`;

export async function createReport(user: AuthenticatedUser, input: ReportInput, idempotency?: IdempotencyContext): Promise<ReportRecord> {
  const id = crypto.randomUUID();
  const patientId = crypto.randomUUID();
  const number = input.reportNumber || reportNumber();
  return transaction(async (client) => executeIdempotent(client, idempotency, async () => {
    if (input.clientId) {
      const existing = await client.query<{ id: string }>(
        'SELECT id FROM reports WHERE lab_id = $1 AND client_id = $2 FOR UPDATE',
        [user.labId, input.clientId],
      );
      if (existing.rows[0]) {
        const result = await client.query<ReportRecord>(`${selectReport} WHERE r.id = $1 AND r.lab_id = $2`, [existing.rows[0].id, user.labId]);
        return one(result)!;
      }
    }
    await client.query(
      `INSERT INTO patients (id, lab_id, uhid, name, phone, data)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (lab_id, uhid) DO UPDATE SET name = EXCLUDED.name, phone = EXCLUDED.phone,
       data = EXCLUDED.data, updated_at = now()`,
      [patientId, user.labId, input.patient.uhid, input.patient.name, input.patient.phone, JSON.stringify(input.patient.data || {})],
    );
    const patient = await client.query<{ id: string }>(
      'SELECT id FROM patients WHERE lab_id = $1 AND uhid = $2', [user.labId, input.patient.uhid],
    );
    const actualPatientId = patient.rows[0].id;
    await client.query(
      `INSERT INTO reports (id, lab_id, patient_id, report_number, client_id, accession_number, data)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        id,
        user.labId,
        actualPatientId,
        number,
        input.clientId || null,
        isRecord(input.patient.data) ? stringField(input.patient.data.accessionNumber) || null : null,
        JSON.stringify(stripNormalizedFields(input.data)),
      ],
    );
    await replaceNormalizedReportCore(client, id, input.data);
    await client.query(
      `INSERT INTO report_versions (id, report_id, version, data, created_by)
       VALUES ($1, $2, 1, $3, $4)`,
      [crypto.randomUUID(), id, JSON.stringify(input.data), user.id],
    );
    await audit(client, user, 'REPORT_CREATED', id, { version: 1, requestId: idempotency?.requestId });
    const result = await client.query<ReportRecord>(`${selectReport} WHERE r.id = $1 AND r.lab_id = $2`, [id, user.labId]);
    return one(result)!;
  }));
}

export async function listReports(user: AuthenticatedUser, search?: string, status?: string, limit = 100, offset = 0): Promise<ReportRecord[]> {
  const values: string[] = [user.labId];
  const conditions = ['r.lab_id = $1', 'r.archived_at IS NULL'];
  if (status) { values.push(status); conditions.push(`r.status = $${values.length}`); }
  if (search) {
    values.push(`%${search}%`);
    conditions.push(`(r.report_number ILIKE $${values.length} OR r.accession_number ILIKE $${values.length} OR COALESCE(r.data->'patient'->>'name', p.name) ILIKE $${values.length} OR COALESCE(r.data->'patient'->>'uhid', p.uhid) ILIKE $${values.length} OR COALESCE(r.data->'patient'->>'phone', p.phone) ILIKE $${values.length})`);
  }
  values.push(String(limit), String(offset));
  const result = await pool.query<ReportRecord>(`${selectReport} WHERE ${conditions.join(' AND ')} ORDER BY r.updated_at DESC LIMIT $${values.length - 1} OFFSET $${values.length}`, values);
  return result.rows;
}

export async function getReport(user: AuthenticatedUser, id: string): Promise<ReportRecord | undefined> {
  const result = await pool.query<ReportRecord>(`${selectReport} WHERE r.id = $1 AND r.lab_id = $2`, [id, user.labId]);
  return one(result);
}

export async function listDispatchAttempts(user: AuthenticatedUser, reportId: string): Promise<DispatchAttemptRecord[]> {
  const result = await pool.query<DispatchAttemptRecord>(
    `SELECT id, report_id AS "reportId", channel, recipient_phone AS "recipientPhone",
            template_type AS "templateType", status,
            provider_message_id AS "providerMessageId", error_message AS "errorMessage",
            attempt_number AS "attemptNumber", sent_at AS "sentAt", failed_at AS "failedAt",
            created_at AS "createdAt", updated_at AS "updatedAt"
       FROM dispatch_attempts
      WHERE report_id = $1 AND lab_id = $2
      ORDER BY created_at DESC`,
    [reportId, user.labId],
  );
  return result.rows;
}

export async function recordDispatchAttempt(
  user: AuthenticatedUser,
  id: string,
  dispatchLog: Record<string, unknown>,
  expectedVersion?: number,
  idempotency?: IdempotencyContext,
): Promise<ReportRecord> {
  return transaction(async (client) => executeIdempotent(client, idempotency, async () => {
    const existing = await client.query<{ status: string; currentVersion: number }>(
      `SELECT status, current_version AS "currentVersion"
         FROM reports
        WHERE id = $1 AND lab_id = $2
        FOR UPDATE`,
      [id, user.labId],
    );
    const row = existing.rows[0];
    if (!row) throw new Error('REPORT_NOT_FOUND');
    if (!['VERIFIED', 'DISPATCHED'].includes(row.status)) throw new Error('REPORT_NOT_VERIFIED');
    if (expectedVersion !== undefined && expectedVersion !== row.currentVersion) throw new Error('REPORT_CONFLICT');

    const attempt = await client.query<{ attemptNumber: number }>(
      `SELECT COALESCE(MAX(attempt_number), 0) + 1 AS "attemptNumber"
         FROM dispatch_attempts
        WHERE report_id = $1`,
      [id],
    );
    const attemptNumber = attempt.rows[0].attemptNumber;
    const deliveryStatus = 'UNAVAILABLE';
    const channel = String(dispatchLog.channel || 'DIRECT_WHATSAPP');
    const templateType = String(dispatchLog.templateType || 'standard');
    const recipientPhone = String(dispatchLog.phoneNumber || '');

    await client.query(
      `INSERT INTO dispatch_attempts
        (id, lab_id, report_id, initiated_by, channel, recipient_phone, template_type, status, error_message, attempt_number)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [
        crypto.randomUUID(),
        user.labId,
        id,
        user.id,
        channel,
        recipientPhone,
        templateType,
        deliveryStatus,
        'Browser-based WhatsApp dispatch was opened; delivery confirmation is unavailable.',
        attemptNumber,
      ],
    );
    await client.query(
      `UPDATE reports
          SET status = 'DISPATCHED',
              dispatched_at = COALESCE(dispatched_at, now()),
              updated_at = now(),
              data = jsonb_set(data, '{whatsAppLogs}', COALESCE(data->'whatsAppLogs', '[]'::jsonb) || jsonb_build_array($1::jsonb), true)
        WHERE id = $2 AND lab_id = $3`,
      [JSON.stringify({ ...dispatchLog, deliveryStatus }), id, user.labId],
    );
    await audit(client, user, 'REPORT_DISPATCH_ATTEMPTED', id, {
      deliveryStatus,
      channel,
      templateType,
      attemptNumber,
      requestId: idempotency?.requestId,
    });
    const result = await client.query<ReportRecord>(`${selectReport} WHERE r.id = $1 AND r.lab_id = $2`, [id, user.labId]);
    return one(result)!;
  }));
}

export async function updateDraft(user: AuthenticatedUser, id: string, input: ReportInput, idempotency?: IdempotencyContext): Promise<ReportRecord> {
  return transaction(async (client) => executeIdempotent(client, idempotency, async () => {
    const existing = await client.query<{ currentVersion: number; status: string; patientId: string; supersedesReportId: string | null }>(
      `SELECT current_version AS "currentVersion", status, patient_id AS "patientId", supersedes_report_id AS "supersedesReportId"
         FROM reports WHERE id = $1 AND lab_id = $2 FOR UPDATE`,
      [id, user.labId],
    );
    const row = existing.rows[0];
    if (!row) throw new Error('REPORT_NOT_FOUND');
    if (!['DRAFT', 'READY_FOR_REVIEW'].includes(row.status)) throw new Error('REPORT_NOT_EDITABLE');
    if (input.version !== undefined && input.version !== row.currentVersion) throw new Error('REPORT_CONFLICT');
    const version = row.currentVersion + 1;
    if (!row.supersedesReportId) {
      await client.query(
        `UPDATE patients SET uhid = $1, name = $2, phone = $3, data = $4, updated_at = now()
         WHERE id = $5 AND lab_id = $6`,
        [input.patient.uhid, input.patient.name, input.patient.phone, JSON.stringify(input.patient.data || {}), row.patientId, user.labId],
      );
    }
    const updatedData = {
      ...input.data,
      criticalResultStatus: hasCriticalResults(input.data) ? 'PENDING' : 'NOT_APPLICABLE',
      criticalResultNotes: '',
      criticalResultAcknowledgedBy: undefined,
      criticalResultAcknowledgedAt: undefined,
    };
    await client.query(
      `UPDATE reports SET data = $1, accession_number = $2, current_version = $3, status = 'DRAFT', updated_at = now()
       WHERE id = $4 AND lab_id = $5`,
      [
        JSON.stringify(stripNormalizedFields(updatedData)),
        isRecord(input.patient.data) ? stringField(input.patient.data.accessionNumber) || null : null,
        version,
        id,
        user.labId,
      ],
    );
    await replaceNormalizedReportCore(client, id, input.data);
    await client.query(
      `INSERT INTO report_versions (id, report_id, version, data, created_by) VALUES ($1, $2, $3, $4, $5)`,
      [crypto.randomUUID(), id, version, JSON.stringify(updatedData), user.id],
    );
    await audit(client, user, 'REPORT_UPDATED', id, { version, requestId: idempotency?.requestId });
    const result = await client.query<ReportRecord>(`${selectReport} WHERE r.id = $1 AND r.lab_id = $2`, [id, user.labId]);
    return one(result)!;
  }));
}

export async function acknowledgeCriticalResults(
  user: AuthenticatedUser,
  id: string,
  notes: string,
  expectedVersion?: number,
  idempotency?: IdempotencyContext,
): Promise<ReportRecord> {
  return transaction(async (client) => executeIdempotent(client, idempotency, async () => {
    const existing = await client.query<{ currentVersion: number; status: string; data: Record<string, unknown> }>(
      `SELECT current_version AS "currentVersion", status, ${currentReportDataSql} AS data
         FROM reports WHERE id = $1 AND lab_id = $2 FOR UPDATE`,
      [id, user.labId],
    );
    const row = existing.rows[0];
    if (!row) throw new Error('REPORT_NOT_FOUND');
    if (!['DRAFT', 'READY_FOR_REVIEW'].includes(row.status)) throw new Error('REPORT_NOT_EDITABLE');
    if (expectedVersion !== undefined && expectedVersion !== row.currentVersion) throw new Error('REPORT_CONFLICT');

    if (!hasCriticalResults(row.data)) throw new Error('NO_CRITICAL_RESULTS');

    const version = row.currentVersion + 1;
    const acknowledgedAt = new Date().toISOString();
    const data = {
      ...row.data,
      criticalResultStatus: 'ACKNOWLEDGED',
      criticalResultNotes: notes.trim(),
      criticalResultAcknowledgedBy: user.id,
      criticalResultAcknowledgedAt: acknowledgedAt,
    };
    await client.query(
      `UPDATE reports SET data = $1, current_version = $2, updated_at = now()
       WHERE id = $3 AND lab_id = $4`,
      [JSON.stringify(stripNormalizedFields(data)), version, id, user.labId],
    );
    await client.query(
      `INSERT INTO report_versions (id, report_id, version, data, created_by)
       VALUES ($1, $2, $3, $4, $5)`,
      [crypto.randomUUID(), id, version, JSON.stringify(data), user.id],
    );
    await audit(client, user, 'CRITICAL_RESULTS_ACKNOWLEDGED', id, {
      version,
      notesLength: notes.trim().length,
      requestId: idempotency?.requestId,
    });
    const result = await client.query<ReportRecord>(`${selectReport} WHERE r.id = $1 AND r.lab_id = $2`, [id, user.labId]);
    return one(result)!;
  }));
}

export async function createAmendment(
  user: AuthenticatedUser,
  id: string,
  reason: string,
  idempotency?: IdempotencyContext,
): Promise<ReportRecord> {
  return transaction(async (client) => executeIdempotent(client, idempotency, async () => {
    const existing = await client.query<{
      reportNumber: string;
      accessionNumber: string | null;
      status: string;
      data: Record<string, unknown>;
      patientId: string;
    }>(
      `SELECT r.report_number AS "reportNumber", r.accession_number AS "accessionNumber", r.status,
              ${currentReportDataSql} AS data, r.patient_id AS "patientId"
         FROM reports r WHERE r.id = $1 AND r.lab_id = $2 FOR UPDATE`,
      [id, user.labId],
    );
    const row = existing.rows[0];
    if (!row) throw new Error('REPORT_NOT_FOUND');
    if (!['VERIFIED', 'DISPATCHED'].includes(row.status)) throw new Error('REPORT_NOT_AMENDABLE');

    const count = await client.query<{ count: string }>(
      'SELECT COUNT(*)::text AS count FROM reports WHERE supersedes_report_id = $1 AND lab_id = $2',
      [id, user.labId],
    );
    const amendmentNumber = Number(count.rows[0].count) + 1;
    const reportId = crypto.randomUUID();
    const reportNumber = `${row.reportNumber}-A${amendmentNumber}`;
    const data = {
      ...row.data,
      amendmentReason: reason.trim(),
      amendmentNumber,
      amendmentOf: id,
      criticalResultStatus: hasCriticalResults(row.data) ? 'PENDING' : 'NOT_APPLICABLE',
      criticalResultNotes: '',
      criticalResultAcknowledgedBy: undefined,
      criticalResultAcknowledgedAt: undefined,
    };

    await client.query(
      `UPDATE reports SET status = 'SUPERSEDED', updated_at = now() WHERE id = $1 AND lab_id = $2`,
      [id, user.labId],
    );
    await client.query(
      `INSERT INTO reports
        (id, lab_id, patient_id, report_number, client_id, accession_number, supersedes_report_id, amendment_reason, amendment_number, data)
       VALUES ($1, $2, $3, $4, NULL, $5, $6, $7, $8, $9)`,
      [reportId, user.labId, row.patientId, reportNumber, row.accessionNumber, id, reason.trim(), amendmentNumber, JSON.stringify(stripNormalizedFields(data))],
    );
    await replaceNormalizedReportCore(client, reportId, data);
    await client.query(
      `INSERT INTO report_versions (id, report_id, version, data, created_by)
       VALUES ($1, $2, 1, $3, $4)`,
      [crypto.randomUUID(), reportId, JSON.stringify(data), user.id],
    );
    await audit(client, user, 'REPORT_SUPERSEDED', id, { amendmentId: reportId, amendmentNumber, requestId: idempotency?.requestId });
    await audit(client, user, 'REPORT_AMENDMENT_CREATED', reportId, { supersedesReportId: id, amendmentNumber, requestId: idempotency?.requestId });
    const result = await client.query<ReportRecord>(`${selectReport} WHERE r.id = $1 AND r.lab_id = $2`, [reportId, user.labId]);
    return one(result)!;
  }));
}

export async function transitionReport(user: AuthenticatedUser, id: string, nextStatus: string, allowedRoles: UserRole[], expectedVersion?: number, idempotency?: IdempotencyContext): Promise<ReportRecord> {
  if (!allowedRoles.includes(user.role)) throw new Error('FORBIDDEN');
  return transaction(async (client) => executeIdempotent(client, idempotency, async () => {
    const existing = await client.query<{
      status: string;
      currentVersion: number;
      data: Record<string, unknown>;
      patientName: string;
      patientPhone: string;
      patientData: Record<string, unknown>;
      labData: Record<string, unknown>;
    }>(
      `SELECT r.status, r.current_version AS "currentVersion", ${currentReportDataSql} AS data,
              COALESCE(r.data->'patient'->>'name', p.name) AS "patientName",
              COALESCE(r.data->'patient'->>'phone', p.phone) AS "patientPhone",
              CASE WHEN jsonb_typeof(r.data->'patient') = 'object' THEN r.data->'patient' ELSE p.data END AS "patientData",
              COALESCE(lp.data, '{}'::jsonb) AS "labData"
         FROM reports r
         JOIN patients p ON p.id = r.patient_id
         LEFT JOIN lab_profiles lp ON lp.lab_id = r.lab_id
        WHERE r.id = $1 AND r.lab_id = $2
        FOR UPDATE OF r, p`,
      [id, user.labId],
    );
    const row = existing.rows[0];
    const current = row?.status;
    if (!current) throw new Error('REPORT_NOT_FOUND');
    if (expectedVersion !== undefined && expectedVersion !== row.currentVersion) throw new Error('REPORT_CONFLICT');
    const valid = (current === 'DRAFT' && nextStatus === 'READY_FOR_REVIEW')
      || (current === 'READY_FOR_REVIEW' && nextStatus === 'VERIFIED')
      || (nextStatus === 'ARCHIVED' && ['DRAFT', 'READY_FOR_REVIEW', 'VERIFIED', 'DISPATCHED'].includes(current));
    if (!valid) throw new Error('INVALID_REPORT_TRANSITION');
    if (nextStatus === 'VERIFIED') {
      const validation = validateReportForVerification({
        patient: { name: row.patientName, phone: row.patientPhone, data: row.patientData },
        data: row.data,
        lab: row.labData,
      });
      if (!validation.valid) throw new ReportValidationError(validation.errors);
    }
    const values: unknown[] = [nextStatus, id, user.labId];
    const verification = nextStatus === 'VERIFIED' ? ', verified_by = $4, verified_at = now()' : '';
    if (nextStatus === 'VERIFIED') values.push(user.id);
    const archive = nextStatus === 'ARCHIVED' ? ', archived_at = now()' : '';
    await client.query(`UPDATE reports SET status = $1, updated_at = now()${verification}${archive} WHERE id = $2 AND lab_id = $3`, values);
    await audit(client, user, `REPORT_${nextStatus}`, id, {
      fromStatus: current,
      toStatus: nextStatus,
      version: row.currentVersion,
      requestId: idempotency?.requestId,
    });
    const result = await client.query<ReportRecord>(`${selectReport} WHERE r.id = $1 AND r.lab_id = $2`, [id, user.labId]);
    return one(result)!;
  }));
}

export async function createPublicReportLink(user: AuthenticatedUser, id: string, expectedVersion?: number, idempotency?: IdempotencyContext): Promise<{ token: string; expiresAt: string }> {
  const token = crypto.randomBytes(32).toString('base64url');
  const expiresAt = new Date(Date.now() + env.publicReportTtlDays * 24 * 60 * 60 * 1000);

  const link = await transaction(async (client) => executeIdempotent(client, idempotency, async () => {
    const report = await client.query<{ status: string; currentVersion: number }>(
      'SELECT status, current_version AS "currentVersion" FROM reports WHERE id = $1 AND lab_id = $2 FOR UPDATE',
      [id, user.labId],
    );
    if (!report.rows[0]) throw new Error('REPORT_NOT_FOUND');
    if (expectedVersion !== undefined && expectedVersion !== report.rows[0].currentVersion) throw new Error('REPORT_CONFLICT');
    if (!['VERIFIED', 'DISPATCHED'].includes(report.rows[0].status)) throw new Error('REPORT_NOT_VERIFIED');

    await client.query(
      'UPDATE report_public_links SET revoked_at = now() WHERE report_id = $1 AND revoked_at IS NULL',
      [id],
    );
    await client.query(
      `INSERT INTO report_public_links (id, report_id, token_hash, expires_at, created_by)
       VALUES ($1, $2, $3, $4, $5)`,
      [crypto.randomUUID(), id, hashPublicToken(token), expiresAt, user.id],
    );
    await audit(client, user, 'PUBLIC_LINK_CREATED', id, {
      version: report.rows[0].currentVersion,
      expiresAt: expiresAt.toISOString(),
      requestId: idempotency?.requestId,
    });
    return { token, expiresAt: expiresAt.toISOString() };
  }));

  return link;
}

export async function getPublicReport(token: string): Promise<PublicReportRecord | undefined> {
  const result = await pool.query<PublicReportRecord>(
    `SELECT r.report_number AS "reportNumber", r.status, ${currentReportDataSql} AS data,
            r.verified_at AS "verifiedAt", r.dispatched_at AS "dispatchedAt",
            json_build_object(
              'uhid', COALESCE(r.data->'patient'->>'uhid', p.uhid),
              'name', COALESCE(r.data->'patient'->>'name', p.name),
              'data', CASE WHEN jsonb_typeof(r.data->'patient') = 'object' THEN r.data->'patient' ELSE p.data END
            ) AS patient,
            COALESCE(lp.data, '{}'::jsonb) AS lab
       FROM report_public_links l
       JOIN reports r ON r.id = l.report_id
       JOIN patients p ON p.id = r.patient_id
       LEFT JOIN lab_profiles lp ON lp.lab_id = r.lab_id
      WHERE l.token_hash = $1
        AND l.revoked_at IS NULL
        AND l.expires_at > now()
        AND r.status IN ('VERIFIED', 'DISPATCHED')`,
    [hashPublicToken(token)],
  );
  const report = one(result);
  if (!report) return undefined;

  return {
    ...report,
    data: sanitizePublicData(report.data),
    patient: {
      ...report.patient,
      data: sanitizePublicPatientData(report.patient.data),
    },
    lab: sanitizePublicLab(report.lab),
  };
}
