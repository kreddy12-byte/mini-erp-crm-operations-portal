import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import { env } from './config/env';
import { errorHandler } from './middleware/error-handler';
import { notFoundHandler } from './middleware/not-found';
import { requestLogger } from './middleware/request-logger';
import { apiRouter } from './routes';

export const app = express();

// Behind Render/Railway/etc. so req.ip and secure cookies (if added later) reflect the client.
if (env.isProduction) {
  app.set('trust proxy', 1);
}

app.disable('x-powered-by');

// Standard HTTP security headers. CSP is omitted: this process is a JSON API;
// the SPA host (Vercel/Netlify) should set its own Content-Security-Policy.
// CORP is cross-origin so a separately hosted frontend can call the API.
app.use(
  helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false,
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  }),
);

app.use(
  cors({
    origin: env.FRONTEND_URL,
    credentials: true,
  }),
);
app.use(express.json({ limit: '1mb' }));
app.use(requestLogger);

app.use('/api', apiRouter);

app.use(notFoundHandler);
app.use(errorHandler);
