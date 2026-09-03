import { env } from './config/env';
import { pool } from './db/pool';
import { runMigrations } from './db/migrate';
import { app } from './app';
import { incrementMetric } from './observability/metrics';

async function start(): Promise<void> {
  await runMigrations();
  const server = app.listen(env.port, env.host, () => {
    console.log(`LabPulse API listening on http://${env.host}:${env.port}`);
  });

  let shuttingDown = false;
  const shutdown = async (signal: string, exitCode = 0) => {
    if (shuttingDown) return;
    shuttingDown = true;
    console.log(JSON.stringify({ event: 'process_shutdown', signal, exitCode }));
    const forceExit = setTimeout(() => process.exit(exitCode), 10_000);
    forceExit.unref();
    server.close(async () => {
      await pool.end();
      process.exit(exitCode);
    });
  };
  process.once('SIGTERM', () => void shutdown('SIGTERM'));
  process.once('SIGINT', () => void shutdown('SIGINT'));
  process.on('unhandledRejection', (reason) => {
    incrementMetric('process_unhandled_rejections_total');
    console.error(JSON.stringify({
      event: 'process_unhandled_rejection',
      message: reason instanceof Error ? reason.message : 'Unknown rejection',
    }));
    void shutdown('unhandledRejection', 1);
  });
  process.on('uncaughtException', (error) => {
    incrementMetric('process_uncaught_exceptions_total');
    console.error(JSON.stringify({ event: 'process_uncaught_exception', message: error.message, stack: error.stack }));
    void shutdown('uncaughtException', 1);
  });
}

start().catch(async (error) => {
  console.error('LabPulse API failed to start:', error instanceof Error ? error.message : error);
  await pool.end();
  process.exitCode = 1;
});
