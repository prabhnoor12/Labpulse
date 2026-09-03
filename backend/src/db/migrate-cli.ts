import { pool } from './pool';
import { runMigrations } from './migrate';

runMigrations().catch((error) => {
  console.error('Database migration failed:', error);
  process.exitCode = 1;
}).finally(() => pool.end());
