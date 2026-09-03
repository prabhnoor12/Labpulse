import type { NextFunction, Request, Response } from 'express';
import { getSessionUser } from '../../auth/session';
import type { UserRole } from '../../auth/types';

export async function requireAuth(request: Request, response: Response, next: NextFunction): Promise<void> {
  try {
    const user = await getSessionUser(request);
    if (!user) {
      response.status(401).json({ error: 'Authentication required.' });
      return;
    }
    request.user = user;
    next();
  } catch (error) {
    next(error);
  }
}

export function requireRole(...roles: UserRole[]) {
  return (request: Request, response: Response, next: NextFunction): void => {
    if (!request.user || !roles.includes(request.user.role)) {
      response.status(403).json({ error: 'You do not have permission to perform this action.' });
      return;
    }
    next();
  };
}
