import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { test } from 'node:test';
import { app } from '../src/app';

test('GET /api/health returns a structured success payload', async () => {
  const server = createServer(app);

  await new Promise<void>((resolve) => {
    server.listen(0, '127.0.0.1', resolve);
  });

  const { port } = server.address() as AddressInfo;

  try {
    const response = await fetch(`http://127.0.0.1:${port}/api/health`);
    const body = (await response.json()) as {
      success: boolean;
      message: string;
      data: { service: string; environment: string };
    };

    assert.equal(response.status, 200);
    assert.equal(body.success, true);
    assert.equal(body.message, 'API is healthy');
    assert.equal(body.data.service, 'mini-erp-crm-api');
    assert.equal(typeof body.data.environment, 'string');
  } finally {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  }
});

test('unknown API routes return a structured 404', async () => {
  const server = createServer(app);

  await new Promise<void>((resolve) => {
    server.listen(0, '127.0.0.1', resolve);
  });

  const { port } = server.address() as AddressInfo;

  try {
    const response = await fetch(`http://127.0.0.1:${port}/api/missing`);
    const body = (await response.json()) as {
      success: boolean;
      error: { code: string; message: string };
    };

    assert.equal(response.status, 404);
    assert.equal(body.success, false);
    assert.equal(body.error.code, 'NOT_FOUND');
    assert.equal(typeof body.error.message, 'string');
    assert.equal('stack' in body, false);
  } finally {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  }
});
