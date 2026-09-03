export type UserRole = 'OWNER' | 'PATHOLOGIST' | 'TECHNICIAN' | 'RECEPTIONIST' | 'VIEWER';

export interface AuthenticatedUser {
  id: string;
  labId: string;
  email: string;
  name: string;
  role: UserRole;
}
