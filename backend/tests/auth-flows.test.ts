import assert from 'node:assert/strict';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { test } from 'node:test';
import { AuthTokenType } from '@prisma/client';
import { app } from '../src/app';
import { prisma } from '../src/config/database';
import { setEmailSenderForTests, type OutboundEmail } from '../src/services/email.service';
import { setGoogleVerifierForTests } from '../src/services/google-identity.service';
import { hashOpaqueToken } from '../src/utils/secure-token';

const STRONG_PASSWORD = 'ValidPass12';
const NEXT_PASSWORD = 'ValidPass99';

interface ErrorBody {
  success: boolean;
  error: { code: string; message: string };
}

interface AuthBody {
  success: boolean;
  message: string;
  data: {
    token?: string;
    user?: { id: string; name: string; email: string; role: string; passwordHash?: unknown };
  };
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

function assertNoSecrets(payload: unknown): void {
  const serialized = JSON.stringify(payload);
  assert.equal(serialized.includes('passwordHash'), false);
  assert.equal(serialized.includes('"password"'), false);
  assert.equal(serialized.toLowerCase().includes('tokenhash'), false);
}

function tokenFromEmail(mailbox: OutboundEmail[], haystack: string): string {
  const email = mailbox.find((item) => item.text.includes(haystack) || item.html.includes(haystack));
  assert.ok(email, `Expected an email containing ${haystack}`);
  const match = /token=([A-Za-z0-9_-]+)/.exec(email.text) ?? /token=([A-Za-z0-9_-]+)/.exec(email.html);
  assert.ok(match?.[1], 'Expected a token in the email');
  return match[1];
}

test('signup, verification, password reset, and Google identity follow production auth rules', async (t) => {
  const mailbox: OutboundEmail[] = [];
  const suffix = `af-${Date.now()}`;
  setEmailSenderForTests(async (message) => {
    mailbox.push(message);
  });
  setGoogleVerifierForTests(async (idToken) => {
    if (idToken === 'invalid-google-id-token-value') {
      throw new Error('invalid');
    }
    if (idToken === 'google-existing-id-token') {
      return {
        googleId: 'google-existing-sub',
        email: `priya.${suffix}@example.com`,
        name: 'Priya Google',
        emailVerified: true,
      };
    }
    if (idToken === 'google-new-id-token-value') {
      return {
        googleId: `google-new-${suffix}`,
        email: `google.${suffix}@example.com`,
        name: 'Google New',
        emailVerified: true,
      };
    }
    throw new Error('unknown token');
  });

  const server = createServer(app);
  const baseUrl = await listen(server);
  const createdEmails = [
    `priya.${suffix}@example.com`,
    `google.${suffix}@example.com`,
    `reset.${suffix}@example.com`,
  ];

  t.after(async () => {
    setEmailSenderForTests(undefined);
    setGoogleVerifierForTests(undefined);
    await prisma.user.deleteMany({ where: { email: { in: createdEmails } } });
    await closeServer(server);
  });

  const invalidEmail = await fetch(`${baseUrl}/api/auth/signup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'Priya Nair',
      email: 'not-an-email',
      password: STRONG_PASSWORD,
      confirmPassword: STRONG_PASSWORD,
    }),
  });
  assert.equal(invalidEmail.status, 400);

  const missing = await fetch(`${baseUrl}/api/auth/signup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: `priya.${suffix}@example.com` }),
  });
  assert.equal(missing.status, 400);

  const weak = await fetch(`${baseUrl}/api/auth/signup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'Priya Nair',
      email: `priya.${suffix}@example.com`,
      password: 'short1',
      confirmPassword: 'short1',
    }),
  });
  const weakBody = (await weak.json()) as ErrorBody;
  assert.equal(weak.status, 400);
  assert.equal(weakBody.error.code, 'VALIDATION_ERROR');

  const mismatch = await fetch(`${baseUrl}/api/auth/signup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'Priya Nair',
      email: `priya.${suffix}@example.com`,
      password: STRONG_PASSWORD,
      confirmPassword: 'ValidPass13',
    }),
  });
  assert.equal(mismatch.status, 400);

  const created = await fetch(`${baseUrl}/api/auth/signup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'Priya Nair',
      email: `  Priya.${suffix}@example.com  `,
      password: STRONG_PASSWORD,
      confirmPassword: STRONG_PASSWORD,
      role: 'ADMIN',
    }),
  });
  const createdBody = (await created.json()) as AuthBody;
  assert.equal(created.status, 201);
  assert.equal(createdBody.data.user?.email, `priya.${suffix}@example.com`);
  assert.equal(createdBody.data.user?.role, 'SALES');
  assert.equal(createdBody.data.token, undefined);
  assertNoSecrets(createdBody);

  const duplicate = await fetch(`${baseUrl}/api/auth/signup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'Priya Nair',
      email: `priya.${suffix}@example.com`,
      password: STRONG_PASSWORD,
      confirmPassword: STRONG_PASSWORD,
    }),
  });
  const duplicateBody = (await duplicate.json()) as ErrorBody;
  assert.equal(duplicate.status, 409);
  assert.equal(duplicateBody.error.code, 'DUPLICATE_EMAIL');

  const unverifiedLogin = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: `priya.${suffix}@example.com`, password: STRONG_PASSWORD }),
  });
  const unverifiedBody = (await unverifiedLogin.json()) as ErrorBody;
  assert.equal(unverifiedLogin.status, 403);
  assert.equal(unverifiedBody.error.code, 'EMAIL_NOT_VERIFIED');

  const verifyToken = tokenFromEmail(mailbox, '/verify-email');
  const invalidVerify = await fetch(`${baseUrl}/api/auth/verify-email`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token: 'this-token-is-not-valid-at-all' }),
  });
  assert.equal(invalidVerify.status, 400);

  const expiredRow = await prisma.authToken.create({
    data: {
      userId: createdBody.data.user!.id,
      type: AuthTokenType.EMAIL_VERIFICATION,
      tokenHash: hashOpaqueToken(`expired-${suffix}`),
      expiresAt: new Date(Date.now() - 60_000),
    },
  });
  const expiredVerify = await fetch(`${baseUrl}/api/auth/verify-email`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token: `expired-${suffix}` }),
  });
  assert.equal(expiredVerify.status, 400);
  await prisma.authToken.delete({ where: { id: expiredRow.id } });

  const verified = await fetch(`${baseUrl}/api/auth/verify-email`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token: verifyToken }),
  });
  const verifiedBody = (await verified.json()) as AuthBody;
  assert.equal(verified.status, 200);
  assert.equal(typeof verifiedBody.data.token, 'string');
  assert.equal(verifiedBody.data.user?.role, 'SALES');
  assertNoSecrets(verifiedBody);

  const reusedVerify = await fetch(`${baseUrl}/api/auth/verify-email`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token: verifyToken }),
  });
  assert.equal(reusedVerify.status, 400);

  const resend = await fetch(`${baseUrl}/api/auth/resend-verification`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: `missing.${suffix}@example.com` }),
  });
  const resendBody = (await resend.json()) as { success: boolean; message: string };
  assert.equal(resend.status, 200);
  assert.match(resendBody.message.toLowerCase(), /if an unverified account exists/);

  const loginOk = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: `priya.${suffix}@example.com`, password: STRONG_PASSWORD }),
  });
  const loginOkBody = (await loginOk.json()) as AuthBody;
  assert.equal(loginOk.status, 200);
  const previousSession = loginOkBody.data.token as string;

  const forgotUnknown = await fetch(`${baseUrl}/api/auth/forgot-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: `missing.${suffix}@example.com` }),
  });
  const forgotKnown = await fetch(`${baseUrl}/api/auth/forgot-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: `priya.${suffix}@example.com` }),
  });
  const forgotUnknownBody = (await forgotUnknown.json()) as { message: string };
  const forgotKnownBody = (await forgotKnown.json()) as { message: string };
  assert.equal(forgotUnknown.status, 200);
  assert.equal(forgotKnown.status, 200);
  assert.equal(forgotUnknownBody.message, forgotKnownBody.message);

  const resetToken = tokenFromEmail(mailbox, '/reset-password');
  const badReset = await fetch(`${baseUrl}/api/auth/reset-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      token: 'this-token-is-not-valid-at-all',
      password: NEXT_PASSWORD,
      confirmPassword: NEXT_PASSWORD,
    }),
  });
  assert.equal(badReset.status, 400);

  const expiredResetRow = await prisma.authToken.create({
    data: {
      userId: createdBody.data.user!.id,
      type: AuthTokenType.PASSWORD_RESET,
      tokenHash: hashOpaqueToken(`expired-reset-${suffix}`),
      expiresAt: new Date(Date.now() - 60_000),
    },
  });
  const expiredReset = await fetch(`${baseUrl}/api/auth/reset-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      token: `expired-reset-${suffix}`,
      password: NEXT_PASSWORD,
      confirmPassword: NEXT_PASSWORD,
    }),
  });
  assert.equal(expiredReset.status, 400);
  await prisma.authToken.delete({ where: { id: expiredResetRow.id } });

  const resetOk = await fetch(`${baseUrl}/api/auth/reset-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      token: resetToken,
      password: NEXT_PASSWORD,
      confirmPassword: NEXT_PASSWORD,
    }),
  });
  assert.equal(resetOk.status, 200);

  const reusedReset = await fetch(`${baseUrl}/api/auth/reset-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      token: resetToken,
      password: NEXT_PASSWORD,
      confirmPassword: NEXT_PASSWORD,
    }),
  });
  assert.equal(reusedReset.status, 400);

  const oldPassword = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: `priya.${suffix}@example.com`, password: STRONG_PASSWORD }),
  });
  assert.equal(oldPassword.status, 401);

  const staleSession = await fetch(`${baseUrl}/api/auth/me`, {
    headers: { Authorization: `Bearer ${previousSession}` },
  });
  assert.equal(staleSession.status, 401);

  const newPasswordLogin = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: `priya.${suffix}@example.com`, password: NEXT_PASSWORD }),
  });
  assert.equal(newPasswordLogin.status, 200);

  const invalidGoogle = await fetch(`${baseUrl}/api/auth/google`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ idToken: 'invalid-google-id-token-value' }),
  });
  const invalidGoogleBody = (await invalidGoogle.json()) as ErrorBody;
  assert.equal(invalidGoogle.status, 401);
  assert.equal(invalidGoogleBody.error.code, 'GOOGLE_AUTH_FAILED');

  const linkedGoogle = await fetch(`${baseUrl}/api/auth/google`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ idToken: 'google-existing-id-token' }),
  });
  const linkedGoogleBody = (await linkedGoogle.json()) as AuthBody;
  assert.equal(linkedGoogle.status, 200);
  assert.equal(linkedGoogleBody.data.user?.email, `priya.${suffix}@example.com`);
  assert.equal(linkedGoogleBody.data.user?.role, 'SALES');

  const newGoogle = await fetch(`${baseUrl}/api/auth/google`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ idToken: 'google-new-id-token-value' }),
  });
  const newGoogleBody = (await newGoogle.json()) as AuthBody;
  assert.equal(newGoogle.status, 200);
  assert.equal(newGoogleBody.data.user?.email, `google.${suffix}@example.com`);
  assert.equal(newGoogleBody.data.user?.role, 'SALES');
  assertNoSecrets(newGoogleBody);
});
