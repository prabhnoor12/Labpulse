import type { AuthenticatedUser } from '../auth/types';
import type { IdempotencyContext } from '../db/idempotency';

declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
      id: string;
      idempotency?: Pick<IdempotencyContext, 'key' | 'requestHash'>;
    }
  }
}

export {};
