import assert from 'node:assert/strict';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { test } from 'node:test';
import { UserRole } from '@prisma/client';
import express from 'express';
import jwt from 'jsonwebtoken';
import { app } from '../src/app';
import { env } from '../src/config/env';
import { authenticate } from '../src/middleware/authenticate';
import { authorizeRoles } from '../src/middleware/authorize';
import { errorHandler } from '../src/middleware/error-handler';
import { sendSuccess } from '../src/utils/http';

const DEV_EMAIL = 'admin.dev@example.com';
const DEV_PASSWORD = 'DevLogin!2026';
const SALES_EMAIL = 'sales.dev@example.com';

interface ErrorBody {
  success: boolean;
  error: { code: string; message: string };
}

interface LoginBody {
  success: boolean;
  message: string;
  data: {
    token: string;
    user: { id: string; name: string; email: string; role: string; passwordHash?: unknown };
  };
}

interface MeBody {
  success: boolean;
  data: { user: { id: string; name: string; email: string; role: string; passwordHash?: unknown } };
}

async function listen(server: Server): Promise<string> {
  await new Promise<void>((resolve) => {
    server.listen(0, '127.0.0.1', resolve);
  });
  const { port } = server.address() as AddressInfo;
  return `http://127.0.0.1:${port}`;
}

async function closeServer(server: Server): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
}

function assertNoPasswordLeak(payload: unknown): void {
  const serialized = JSON.stringify(payload);
  assert.equal(serialized.includes('passwordHash'), false);
  assert.equal(serialized.includes('"password"'), false);
}

async function loginAs(baseUrl: string, email: string, password: string): Promise<LoginBody> {
  const response = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const body = (await response.json()) as LoginBody;
  assert.equal(response.status, 200, `Expected login 200 for ${email}`);
  return body;
}

function createRbacApp() {
  const rbacApp = express();
  rbacApp.get(
    '/admin-only',
    authenticate,
    authorizeRoles(UserRole.ADMIN),
    (_req, res) => {
      sendSuccess(res, { ok: true }, 'Allowed');
    },
  );
  rbacApp.use(errorHandler);
  return rbacApp;
}

test('POST /api/auth/login succeeds with valid development credentials', async () => {
  const server = createServer(app);
  const baseUrl = await listen(server);

  try {
    const response = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: '  Admin.Dev@example.com  ', password: DEV_PASSWORD }),
    });
    const body = (await response.json()) as LoginBody;

    assert.equal(response.status, 200);
    assert.equal(body.success, true);
    assert.equal(body.message, 'Login successful');
    assert.equal(typeof body.data.token, 'string');
    assert.ok(body.data.token.length > 20);
    assert.equal(body.data.user.email, DEV_EMAIL);
    assert.equal(body.data.user.role, 'ADMIN');
    assert.equal(typeof body.data.user.id, 'string');
    assert.equal(typeof body.data.user.name, 'string');
    assertNoPasswordLeak(body);

    const decoded = jwt.decode(body.data.token);
    assert.ok(decoded && typeof decoded === 'object');
    assert.equal('passwordHash' in decoded, false);
    assert.equal(decoded.sub, body.data.user.id);
    assert.equal(decoded.role, 'ADMIN');
  } finally {
    await closeServer(server);
  }
});

test('POST /api/auth/login rejects wrong password and unknown email with the same error', async () => {
  const server = createServer(app);
  const baseUrl = await listen(server);

  try {
    const wrongPassword = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: DEV_EMAIL, password: 'WrongPassword!1' }),
    });
    const unknownUser = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'missing.dev@example.com', password: DEV_PASSWORD }),
    });

    const wrongBody = (await wrongPassword.json()) as ErrorBody;
    const unknownBody = (await unknownUser.json()) as ErrorBody;

    assert.equal(wrongPassword.status, 401);
    assert.equal(unknownUser.status, 401);
    assert.equal(wrongBody.error.code, 'INVALID_CREDENTIALS');
    assert.equal(unknownBody.error.code, 'INVALID_CREDENTIALS');
    assert.equal(wrongBody.error.message, unknownBody.error.message);
    assert.equal(wrongBody.error.message.includes('exists'), false);
    assertNoPasswordLeak(wrongBody);
    assertNoPasswordLeak(unknownBody);
  } finally {
    await closeServer(server);
  }
});

test('POST /api/auth/login rejects invalid email and missing password', async () => {
  const server = createServer(app);
  const baseUrl = await listen(server);

  try {
    const invalidEmail = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'not-an-email', password: DEV_PASSWORD }),
    });
    const missingPassword = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: DEV_EMAIL }),
    });

    const invalidEmailBody = (await invalidEmail.json()) as ErrorBody;
    const missingPasswordBody = (await missingPassword.json()) as ErrorBody;

    assert.equal(invalidEmail.status, 400);
    assert.equal(missingPassword.status, 400);
    assert.equal(invalidEmailBody.error.code, 'VALIDATION_ERROR');
    assert.equal(missingPasswordBody.error.code, 'VALIDATION_ERROR');
  } finally {
    await closeServer(server);
  }
});

test('GET /api/auth/me requires a valid JWT and never returns passwordHash', async () => {
  const server = createServer(app);
  const baseUrl = await listen(server);

  try {
    const unauthenticated = await fetch(`${baseUrl}/api/auth/me`);
    const unauthenticatedBody = (await unauthenticated.json()) as ErrorBody;
    assert.equal(unauthenticated.status, 401);
    assert.equal(unauthenticatedBody.error.code, 'UNAUTHORIZED');

    const loginBody = await loginAs(baseUrl, DEV_EMAIL, DEV_PASSWORD);
    const me = await fetch(`${baseUrl}/api/auth/me`, {
      headers: { Authorization: `Bearer ${loginBody.data.token}` },
    });
    const meBody = (await me.json()) as MeBody;

    assert.equal(me.status, 200);
    assert.equal(meBody.data.user.email, DEV_EMAIL);
    assert.equal(meBody.data.user.role, 'ADMIN');
    assertNoPasswordLeak(meBody);
  } finally {
    await closeServer(server);
  }
});

test('JWT middleware rejects missing, malformed, invalid, and expired tokens', async () => {
  const server = createServer(app);
  const baseUrl = await listen(server);

  try {
    const loginBody = await loginAs(baseUrl, DEV_EMAIL, DEV_PASSWORD);

    const missing = await fetch(`${baseUrl}/api/auth/me`);
    const malformedHeader = await fetch(`${baseUrl}/api/auth/me`, {
      headers: { Authorization: loginBody.data.token },
    });
    const malformedToken = await fetch(`${baseUrl}/api/auth/me`, {
      headers: { Authorization: 'Bearer not-a-jwt' },
    });
    const invalidSignature = await fetch(`${baseUrl}/api/auth/me`, {
      headers: {
        Authorization: `Bearer ${jwt.sign({ sub: loginBody.data.user.id, role: 'ADMIN' }, 'other-secret')}`,
      },
    });
    const expired = await fetch(`${baseUrl}/api/auth/me`, {
      headers: {
        Authorization: `Bearer ${jwt.sign(
          {
            sub: loginBody.data.user.id,
            role: 'ADMIN',
            exp: Math.floor(Date.now() / 1000) - 30,
          },
          env.JWT_SECRET,
        )}`,
      },
    });

    for (const response of [missing, malformedHeader, malformedToken, invalidSignature, expired]) {
      const body = (await response.json()) as ErrorBody;
      assert.equal(response.status, 401);
      assert.equal(body.error.code, 'UNAUTHORIZED');
      assert.equal(body.error.message.toLowerCase().includes('jwt'), false);
      assert.equal(body.error.message.toLowerCase().includes('secret'), false);
    }
  } finally {
    await closeServer(server);
  }
});

test('RBAC allows ADMIN and returns 403 for authenticated SALES', async () => {
  const apiServer = createServer(app);
  const rbacServer = createServer(createRbacApp());
  const apiUrl = await listen(apiServer);
  const rbacUrl = await listen(rbacServer);

  try {
    const adminLogin = await loginAs(apiUrl, DEV_EMAIL, DEV_PASSWORD);
    const salesLogin = await loginAs(apiUrl, SALES_EMAIL, DEV_PASSWORD);

    const allowed = await fetch(`${rbacUrl}/admin-only`, {
      headers: { Authorization: `Bearer ${adminLogin.data.token}` },
    });
    const denied = await fetch(`${rbacUrl}/admin-only`, {
      headers: { Authorization: `Bearer ${salesLogin.data.token}` },
    });
    const anonymous = await fetch(`${rbacUrl}/admin-only`);

    const allowedBody = (await allowed.json()) as { success: boolean; data: { ok: boolean } };
    const deniedBody = (await denied.json()) as ErrorBody;
    const anonymousBody = (await anonymous.json()) as ErrorBody;

    assert.equal(allowed.status, 200);
    assert.equal(allowedBody.data.ok, true);
    assert.equal(denied.status, 403);
    assert.equal(deniedBody.error.code, 'FORBIDDEN');
    assert.equal(anonymous.status, 401);
    assert.equal(anonymousBody.error.code, 'UNAUTHORIZED');
  } finally {
    await closeServer(apiServer);
    await closeServer(rbacServer);
  }
});
