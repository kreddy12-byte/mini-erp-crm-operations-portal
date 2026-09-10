import assert from 'node:assert/strict';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { test } from 'node:test';
import { app } from '../src/app';
import { prisma } from '../src/config/database';

const ADMIN_EMAIL = 'admin.dev@example.com';
const SALES_EMAIL = 'sales.dev@example.com';
const WAREHOUSE_EMAIL = 'warehouse.dev@example.com';
const DEV_PASSWORD = 'DevLogin!2026';

interface ErrorBody {
  success: boolean;
  error: { code: string; message: string };
}

interface LoginBody {
  success: boolean;
  data: { token: string; user: { id: string; role: string } };
}

interface CustomerBody {
  id: string;
  name: string;
  mobile: string;
  email: string | null;
  businessName: string;
  status: string;
  customerType: string;
  latestFollowUpAt?: string | null;
  followUps?: Array<{
    id: string;
    note: string;
    createdBy: { id: string; name: string };
  }>;
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

async function loginAs(baseUrl: string, email: string): Promise<LoginBody> {
  const response = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: DEV_PASSWORD }),
  });
  const body = (await response.json()) as LoginBody;
  assert.equal(response.status, 200, `Expected login 200 for ${email}`);
  return body;
}

function authHeader(token: string): HeadersInit {
  return {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  };
}

test('customer CRM API enforces auth, RBAC, CRUD, search, filters, pagination, and follow-ups', async (t) => {
  const server = createServer(app);
  const baseUrl = await listen(server);
  const createdIds: string[] = [];
  const suffix = `p4-${Date.now()}`;

  t.after(async () => {
    if (createdIds.length > 0) {
      await prisma.customerFollowUp.deleteMany({ where: { customerId: { in: createdIds } } });
      await prisma.customer.deleteMany({ where: { id: { in: createdIds } } });
    }
    await closeServer(server);
  });

  const unauthenticated = await fetch(`${baseUrl}/api/customers`);
  const unauthenticatedBody = (await unauthenticated.json()) as ErrorBody;
  assert.equal(unauthenticated.status, 401);
  assert.equal(unauthenticatedBody.error.code, 'UNAUTHORIZED');

  const warehouse = await loginAs(baseUrl, WAREHOUSE_EMAIL);
  const forbidden = await fetch(`${baseUrl}/api/customers`, {
    headers: authHeader(warehouse.data.token),
  });
  const forbiddenBody = (await forbidden.json()) as ErrorBody;
  assert.equal(forbidden.status, 403);
  assert.equal(forbiddenBody.error.code, 'FORBIDDEN');

  const admin = await loginAs(baseUrl, ADMIN_EMAIL);
  const sales = await loginAs(baseUrl, SALES_EMAIL);

  const invalid = await fetch(`${baseUrl}/api/customers`, {
    method: 'POST',
    headers: authHeader(admin.data.token),
    body: JSON.stringify({
      name: '',
      mobile: '123',
      customerType: 'SHOP',
      status: 'ACTIVE',
      email: 'not-an-email',
    }),
  });
  const invalidBody = (await invalid.json()) as ErrorBody;
  assert.equal(invalid.status, 400);
  assert.equal(invalidBody.error.code, 'VALIDATION_ERROR');

  const created = await fetch(`${baseUrl}/api/customers`, {
    method: 'POST',
    headers: authHeader(sales.data.token),
    body: JSON.stringify({
      name: `Priya Nair ${suffix}`,
      mobile: '9876511111',
      email: `priya.${suffix}@example.com`,
      businessName: `Nair Traders ${suffix}`,
      gstNumber: '27AAAAA0000A1Z5',
      customerType: 'WHOLESALE',
      address: '19 Market Street, Kochi',
      status: 'LEAD',
      followUpDate: '2026-09-12',
      notes: 'Called about cable pack.',
    }),
  });
  const createdBody = (await created.json()) as { success: boolean; data: { customer: CustomerBody } };
  assert.equal(created.status, 201);
  assert.equal(createdBody.data.customer.name, `Priya Nair ${suffix}`);
  assert.equal(createdBody.data.customer.status, 'LEAD');
  createdIds.push(createdBody.data.customer.id);

  const second = await fetch(`${baseUrl}/api/customers`, {
    method: 'POST',
    headers: authHeader(admin.data.token),
    body: JSON.stringify({
      name: `Arjun Rao ${suffix}`,
      mobile: '9876522222',
      customerType: 'RETAIL',
      status: 'ACTIVE',
      businessName: `Rao Stores ${suffix}`,
    }),
  });
  const secondBody = (await second.json()) as { data: { customer: CustomerBody } };
  assert.equal(second.status, 201);
  createdIds.push(secondBody.data.customer.id);

  const listed = await fetch(`${baseUrl}/api/customers?search=${encodeURIComponent(suffix)}&sortBy=name&sortOrder=asc`, {
    headers: authHeader(admin.data.token),
  });
  const listedBody = (await listed.json()) as {
    success: boolean;
    data: {
      customers: CustomerBody[];
      pagination: {
        page: number;
        pageSize: number;
        total: number;
        totalPages: number;
        hasPrevious: boolean;
        hasNext: boolean;
      };
    };
  };
  assert.equal(listed.status, 200);
  assert.equal(listedBody.data.customers.length, 2);
  assert.equal(listedBody.data.pagination.total, 2);
  assert.equal(listedBody.data.pagination.page, 1);
  assert.equal(listedBody.data.pagination.hasPrevious, false);

  const filtered = await fetch(
    `${baseUrl}/api/customers?search=${encodeURIComponent(suffix)}&status=LEAD&customerType=WHOLESALE`,
    { headers: authHeader(admin.data.token) },
  );
  const filteredBody = (await filtered.json()) as { data: { customers: CustomerBody[]; pagination: { total: number } } };
  assert.equal(filtered.status, 200);
  assert.equal(filteredBody.data.pagination.total, 1);
  assert.equal(filteredBody.data.customers[0]?.id, createdBody.data.customer.id);

  const page = await fetch(
    `${baseUrl}/api/customers?search=${encodeURIComponent(suffix)}&page=2&pageSize=1&sortBy=name&sortOrder=asc`,
    { headers: authHeader(admin.data.token) },
  );
  const pageBody = (await page.json()) as {
    data: { customers: CustomerBody[]; pagination: { page: number; totalPages: number; hasPrevious: boolean; hasNext: boolean } };
  };
  assert.equal(page.status, 200);
  assert.equal(pageBody.data.customers.length, 1);
  assert.equal(pageBody.data.pagination.page, 2);
  assert.equal(pageBody.data.pagination.totalPages, 2);
  assert.equal(pageBody.data.pagination.hasPrevious, true);
  assert.equal(pageBody.data.pagination.hasNext, false);

  const detail = await fetch(`${baseUrl}/api/customers/${createdBody.data.customer.id}`, {
    headers: authHeader(admin.data.token),
  });
  const detailBody = (await detail.json()) as { data: { customer: CustomerBody } };
  assert.equal(detail.status, 200);
  assert.equal(detailBody.data.customer.email, `priya.${suffix}@example.com`);
  assert.ok(Array.isArray(detailBody.data.customer.followUps));

  const missing = await fetch(`${baseUrl}/api/customers/does-not-exist`, {
    headers: authHeader(admin.data.token),
  });
  const missingBody = (await missing.json()) as ErrorBody;
  assert.equal(missing.status, 404);
  assert.equal(missingBody.error.code, 'NOT_FOUND');

  const updated = await fetch(`${baseUrl}/api/customers/${createdBody.data.customer.id}`, {
    method: 'PATCH',
    headers: authHeader(admin.data.token),
    body: JSON.stringify({ status: 'ACTIVE', notes: 'Converted after site visit.' }),
  });
  const updatedBody = (await updated.json()) as { data: { customer: CustomerBody } };
  assert.equal(updated.status, 200);
  assert.equal(updatedBody.data.customer.status, 'ACTIVE');
  assert.equal(updatedBody.data.customer.notes, 'Converted after site visit.');

  const followUpInvalid = await fetch(`${baseUrl}/api/customers/${createdBody.data.customer.id}/follow-ups`, {
    method: 'POST',
    headers: authHeader(admin.data.token),
    body: JSON.stringify({ note: '' }),
  });
  const followUpInvalidBody = (await followUpInvalid.json()) as ErrorBody;
  assert.equal(followUpInvalid.status, 400);
  assert.equal(followUpInvalidBody.error.code, 'VALIDATION_ERROR');

  const followUpMissingGet = await fetch(`${baseUrl}/api/customers/does-not-exist/follow-ups`, {
    headers: authHeader(admin.data.token),
  });
  assert.equal(followUpMissingGet.status, 404);

  const followUpMissingCustomer = await fetch(`${baseUrl}/api/customers/does-not-exist/follow-ups`, {
    method: 'POST',
    headers: authHeader(admin.data.token),
    body: JSON.stringify({ note: 'Should not persist.' }),
  });
  const followUpMissingBody = (await followUpMissingCustomer.json()) as ErrorBody;
  assert.equal(followUpMissingCustomer.status, 404);

  const followUpCreated = await fetch(`${baseUrl}/api/customers/${createdBody.data.customer.id}/follow-ups`, {
    method: 'POST',
    headers: authHeader(admin.data.token),
    body: JSON.stringify({ note: 'Visited showroom. Needs quotation.', followUpDate: '2026-09-15' }),
  });
  const followUpCreatedBody = (await followUpCreated.json()) as {
    data: { followUp: { note: string; createdBy: { id: string } } };
  };
  assert.equal(followUpCreated.status, 201);
  assert.equal(followUpCreatedBody.data.followUp.note, 'Visited showroom. Needs quotation.');
  assert.equal(followUpCreatedBody.data.followUp.createdBy.id, admin.data.user.id);

  const followUps = await fetch(`${baseUrl}/api/customers/${createdBody.data.customer.id}/follow-ups`, {
    headers: authHeader(sales.data.token),
  });
  const followUpsBody = (await followUps.json()) as {
    data: { followUps: Array<{ createdBy: { id: string }; note: string }> };
  };
  assert.equal(followUps.status, 200);
  assert.equal(followUpsBody.data.followUps.length >= 1, true);
  assert.equal(followUpsBody.data.followUps[0]?.createdBy.id, admin.data.user.id);
});
