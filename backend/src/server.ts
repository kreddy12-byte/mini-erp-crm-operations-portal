import { env } from './config/env';
import { app } from './app';

const server = app.listen(env.PORT, () => {
  console.info(`${env.SERVICE_NAME} listening on http://localhost:${env.PORT} [${env.NODE_ENV}]`);
});

function shutdown(signal: string): void {
  console.info(`Received ${signal}. Closing HTTP server.`);
  server.close((error) => {
    if (error) {
      console.error(error);
      process.exit(1);
    }
    process.exit(0);
  });
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
