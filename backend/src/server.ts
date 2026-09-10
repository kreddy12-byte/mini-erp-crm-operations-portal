import { connectDatabase, disconnectDatabase } from './config/database';
import { env } from './config/env';
import { app } from './app';

async function start(): Promise<void> {
  const databaseStatus = await connectDatabase();

  if (databaseStatus === 'disconnected' && env.isProduction) {
    process.exit(1);
  }

  const server = app.listen(env.PORT, () => {
    console.info(
      `${env.SERVICE_NAME} listening on http://localhost:${env.PORT} [${env.NODE_ENV}] database=${databaseStatus}`,
    );
  });

  function shutdown(signal: string): void {
    console.info(`Received ${signal}. Closing HTTP server.`);
    server.close((error) => {
      void disconnectDatabase().finally(() => {
        if (error) {
          console.error(error);
          process.exit(1);
        }
        process.exit(0);
      });
    });
  }

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

start().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
