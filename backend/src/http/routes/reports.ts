import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../middleware/async';
import { requireAuth, requireRole } from '../middleware/auth';
import { createPublicReportLink, createReport, getReport, listDispatchAttempts, listReports, recordDispatchAttempt, transitionReport, updateDraft, type ReportInput } from '../../application/reports/reportService';
import { ReportValidationError } from '../../application/reports/reportValidation';
import type { UserRole } from '../../auth/types';
import { idempotencyContext, requireIdempotencyKey } from '../middleware/idempotency';
import { parseReportInput } from '../../application/reports/reportInput';

const router = Router();
const idSchema = z.string().uuid();
const dispatchInput = z.object({
  version: z.number().int().positive().optional(),
  phoneNumber: z.string().trim().regex(/^91[6-9]\d{9}$/, 'A valid Indian WhatsApp number is required.'),
  templateType: z.enum(['standard', 'detailed', 'urgent', 'hindi']),
  channel: z.enum(['DIRECT_WHATSAPP', 'WA_WEB', 'COPY']).default('DIRECT_WHATSAPP'),
});

function transition(nextStatus: string, roles: UserRole[]) {
  return asyncHandler(async (request, response) => {
    try {
      const expectedVersion = typeof request.body?.version === 'number' ? request.body.version : undefined;
      response.json({ report: await transitionReport(request.user!, idSchema.parse(request.params.id), nextStatus, roles, expectedVersion, idempotencyContext(request)) });
    } catch (error) {
      if (error instanceof Error && error.message === 'REPORT_NOT_FOUND') { response.status(404).json({ error: 'Report not found.' }); return; }
      if (error instanceof Error && error.message === 'INVALID_REPORT_TRANSITION') { response.status(409).json({ error: 'Invalid report status transition.' }); return; }
      if (error instanceof Error && error.message === 'FORBIDDEN') { response.status(403).json({ error: 'You do not have permission to perform this action.' }); return; }
      if (error instanceof Error && error.message === 'REPORT_CONFLICT') { response.status(409).json({ error: 'This report was changed by another user. Reload it before trying again.' }); return; }
      if (error instanceof ReportValidationError) { response.status(422).json({ error: 'Report is not ready for verification.', errors: error.errors }); return; }
      throw error;
    }
  });
}

router.use(requireAuth);

router.get('/', asyncHandler(async (request, response) => {
  const search = typeof request.query.search === 'string' ? request.query.search.trim().slice(0, 100) : undefined;
  const status = typeof request.query.status === 'string' ? request.query.status.trim().slice(0, 32) : undefined;
  response.json({ reports: await listReports(request.user!, search, status) });
}));

router.post('/', requireRole('OWNER', 'TECHNICIAN', 'RECEPTIONIST'), requireIdempotencyKey, asyncHandler(async (request, response) => {
  const report = await createReport(request.user!, parseReportInput(request.body) as ReportInput, idempotencyContext(request));
  response.status(201).json({ report });
}));

router.get('/:id', asyncHandler(async (request, response) => {
  const report = await getReport(request.user!, idSchema.parse(request.params.id));
  if (!report) { response.status(404).json({ error: 'Report not found.' }); return; }
  response.json({ report });
}));

router.get('/:id/dispatch-attempts', asyncHandler(async (request, response) => {
  const report = await getReport(request.user!, idSchema.parse(request.params.id));
  if (!report) { response.status(404).json({ error: 'Report not found.' }); return; }
  response.json({ attempts: await listDispatchAttempts(request.user!, request.params.id) });
}));

router.patch('/:id', requireRole('OWNER', 'TECHNICIAN', 'RECEPTIONIST'), requireIdempotencyKey, asyncHandler(async (request, response) => {
  try {
    const report = await updateDraft(request.user!, idSchema.parse(request.params.id), parseReportInput(request.body) as ReportInput, idempotencyContext(request));
    response.json({ report });
  } catch (error) {
    if (error instanceof Error && error.message === 'REPORT_NOT_FOUND') { response.status(404).json({ error: 'Report not found.' }); return; }
    if (error instanceof Error && error.message === 'REPORT_NOT_EDITABLE') { response.status(409).json({ error: 'Only draft or review reports can be edited.' }); return; }
    if (error instanceof Error && error.message === 'REPORT_CONFLICT') { response.status(409).json({ error: 'This report was changed by another user. Reload it before trying again.' }); return; }
    throw error;
  }
}));

router.post('/:id/submit', requireRole('OWNER', 'TECHNICIAN'), requireIdempotencyKey, transition('READY_FOR_REVIEW', ['OWNER', 'TECHNICIAN']));

router.post('/:id/verify', requireRole('OWNER', 'PATHOLOGIST'), requireIdempotencyKey, transition('VERIFIED', ['OWNER', 'PATHOLOGIST']));

router.post('/:id/dispatch', requireRole('OWNER', 'RECEPTIONIST', 'PATHOLOGIST'), requireIdempotencyKey, asyncHandler(async (request, response) => {
  try {
    const { version, ...details } = dispatchInput.parse(request.body);
    response.json({ report: await recordDispatchAttempt(
      request.user!,
      idSchema.parse(request.params.id),
      { ...details, sentAt: new Date().toISOString() },
      version,
      idempotencyContext(request),
    ) });
  } catch (error) {
    if (error instanceof Error && error.message === 'REPORT_NOT_FOUND') { response.status(404).json({ error: 'Report not found.' }); return; }
    if (error instanceof Error && error.message === 'REPORT_NOT_VERIFIED') { response.status(409).json({ error: 'Only verified reports can be dispatched.' }); return; }
    if (error instanceof Error && error.message === 'REPORT_CONFLICT') { response.status(409).json({ error: 'This report was changed by another user. Reload it before trying again.' }); return; }
    throw error;
  }
}));

router.post('/:id/archive', requireRole('OWNER'), requireIdempotencyKey, transition('ARCHIVED', ['OWNER']));

router.post('/:id/public-link', requireRole('OWNER', 'PATHOLOGIST'), requireIdempotencyKey, asyncHandler(async (request, response) => {
  try {
    const expectedVersion = typeof request.body?.version === 'number' ? request.body.version : undefined;
    response.status(201).json({ link: await createPublicReportLink(request.user!, idSchema.parse(request.params.id), expectedVersion, idempotencyContext(request)) });
  } catch (error) {
    if (error instanceof Error && error.message === 'REPORT_NOT_FOUND') { response.status(404).json({ error: 'Report not found.' }); return; }
    if (error instanceof Error && error.message === 'REPORT_NOT_VERIFIED') { response.status(409).json({ error: 'Only verified reports can have public links.' }); return; }
    if (error instanceof Error && error.message === 'REPORT_CONFLICT') { response.status(409).json({ error: 'This report was changed by another user. Reload it before trying again.' }); return; }
    throw error;
  }
}));

export default router;
