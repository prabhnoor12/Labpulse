import type { CurrentUser } from '@/services/apiClient';

export type AppPermission =
  | 'createReport'
  | 'editReport'
  | 'submitReport'
  | 'verifyReport'
  | 'dispatchReport'
  | 'archiveReport'
  | 'createPublicLink'
  | 'manageLab';

const permissionRoles: Record<AppPermission, CurrentUser['role'][]> = {
  createReport: ['OWNER', 'TECHNICIAN', 'RECEPTIONIST'],
  editReport: ['OWNER', 'TECHNICIAN', 'RECEPTIONIST'],
  submitReport: ['OWNER', 'TECHNICIAN'],
  verifyReport: ['OWNER', 'PATHOLOGIST'],
  dispatchReport: ['OWNER', 'RECEPTIONIST', 'PATHOLOGIST'],
  archiveReport: ['OWNER'],
  createPublicLink: ['OWNER', 'PATHOLOGIST', 'RECEPTIONIST'],
  manageLab: ['OWNER'],
};

export function can(user: CurrentUser | null | undefined, permission: AppPermission): boolean {
  return Boolean(user && permissionRoles[permission].includes(user.role));
}
