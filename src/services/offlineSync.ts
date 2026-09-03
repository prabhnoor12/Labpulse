import type { CurrentUser } from './apiClient';
import { ApiError, api } from './apiClient';
import {
  listPendingOfflineReportOperations,
  markOfflineOperationFailed,
  removeOfflineOperation,
  remapOfflineReportUpdates,
  type OfflineReportOperation,
} from '@/app/offlineStore';
import type { DiagnosticReport } from '@/domain/types';

export interface OfflineSyncResult {
  syncedReports: DiagnosticReport[];
  idMappings: Array<{ localId: string; report: DiagnosticReport }>;
  pendingCount: number;
  failedCount: number;
}

export async function flushOfflineReportOperations(user: CurrentUser): Promise<OfflineSyncResult> {
  const operations = await listPendingOfflineReportOperations(user.id, user.labId);
  const syncedReports: DiagnosticReport[] = [];
  const idMappings: Array<{ localId: string; report: DiagnosticReport }> = [];
  let pendingCount = 0;
  let failedCount = 0;

  for (const operation of operations) {
    try {
      const savedReport = operation.kind === 'CREATE_REPORT'
        ? await api.createReport(operation.payload, operation.idempotencyKey)
        : await api.updateReport(operation.payload, operation.idempotencyKey);
      syncedReports.push(savedReport);
      await removeOfflineOperation(operation.id);
      if (operation.kind === 'CREATE_REPORT') {
        idMappings.push({ localId: operation.reportId, report: savedReport });
        await remapOfflineReportUpdates(user.id, user.labId, operation.reportId, savedReport);
      }
    } catch (error: unknown) {
      if (error instanceof ApiError && error.status === 0) {
        pendingCount += 1;
        continue;
      }

      failedCount += 1;
      await markOfflineOperationFailed(
        operation.id,
        error instanceof Error ? error.message : 'Unable to synchronize offline report operation.',
      );
    }
  }

  return { syncedReports, idMappings, pendingCount, failedCount };
}

export const flushOfflineReportUpdates = flushOfflineReportOperations;

export function offlineCreateOperation(user: CurrentUser, report: DiagnosticReport): OfflineReportOperation {
  const idempotencyKey = `create-${report.id}`;
  return {
    id: `${user.labId}:${user.id}:${report.id}:${idempotencyKey}`,
    userId: user.id,
    labId: user.labId,
    kind: 'CREATE_REPORT',
    reportId: report.id,
    idempotencyKey,
    payload: report,
    createdAt: new Date().toISOString(),
    attempts: 0,
    status: 'PENDING',
  };
}

export function offlineUpdateOperation(user: CurrentUser, report: DiagnosticReport): OfflineReportOperation {
  const idempotencyKey = `update-${report.id}-${report.version ?? report.updatedAt}`;
  return {
    id: `${user.labId}:${user.id}:${report.id}:${idempotencyKey}`,
    userId: user.id,
    labId: user.labId,
    kind: 'UPDATE_REPORT',
    reportId: report.id,
    idempotencyKey,
    payload: report,
    createdAt: new Date().toISOString(),
    attempts: 0,
    status: 'PENDING',
  };
}
