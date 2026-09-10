import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { test } from 'node:test';
import { app } from '../src/app';
import { prisma } from '../src/config/database';

const ADMIN_EMAIL = 'admin.dev@example.com';
const SALES_EMAIL = 'sales.dev@example.com';
const WAREHOUSE_EMAIL = 'warehouse.dev@example.com';
const DEV_PASSWORD = 'DevLogin!2026';

interface LoginBody {
  success: boolean;
  data: { token: string };
}

interface ChallanBody {
  id: string;
  challanNumber: string;
  items: Array<{
    productId: string;
    productNameSnapshot: string;
    skuSnapshot: string;
    unitPriceSnapshot: string;
    quantity: number;
  }>;
}

async function json<T>(response: Response): Promise<T> {
  return (await response.json()) as T;
}

async function loginAs(baseUrl: string, email: string): Promise<string> {
  const response = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: DEV_PASSWORD }),
  });
  const body = await json<LoginBody>(response);
  assert.equal(response.status, 200);
  return body.data.token;
}

function authHeader(token: string): HeadersInit {
  return { Authorization: `Bearer ${token}` };
}

/** PDFKit emits text as hex TJ operands; decode those for content assertions. */
function extractPdfText(buffer: Buffer): string {
  const raw = buffer.toString('latin1');
  const parts: string[] = [];
  for (const match of raw.matchAll(/<([0-9A-Fa-f]+)>/g)) {
    const hex = match[1];
    if (hex.length % 2 !== 0) continue;
    let decoded = '';
    for (let i = 0; i < hex.length; i += 2) {
      decoded += String.fromCharCode(Number.parseInt(hex.slice(i, i + 2), 16));
    }
    parts.push(decoded);
  }
  return parts.join('');
}

test('GET /api/challans/:id/pdf exports a read-only PDF using historical snapshots', async (t) => {
  const server = createServer(app);
  await new Promise<void>((resolve) => {
    server.listen(0, '127.0.0.1', resolve);
  });
  const { port } = server.address() as AddressInfo;
  const baseUrl = `http://127.0.0.1:${port}`;

  const customerIds: string[] = [];
  const productIds: string[] = [];
  const challanIds: string[] = [];

  t.after(async () => {
    if (challanIds.length > 0) {
      await prisma.salesChallanItem.deleteMany({ where: { challanId: { in: challanIds } } });
      await prisma.salesChallan.deleteMany({ where: { id: { in: challanIds } } });
    }
    if (productIds.length > 0) {
      await prisma.stockMovement.deleteMany({ where: { productId: { in: productIds } } });
      await prisma.product.deleteMany({ where: { id: { in: productIds } } });
    }
    if (customerIds.length > 0) {
      await prisma.customerFollowUp.deleteMany({ where: { customerId: { in: customerIds } } });
      await prisma.customer.deleteMany({ where: { id: { in: customerIds } } });
    }
    await new Promise<void>((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  });

  const salesToken = await loginAs(baseUrl, SALES_EMAIL);
  const warehouseToken = await loginAs(baseUrl, WAREHOUSE_EMAIL);
  const adminToken = await loginAs(baseUrl, ADMIN_EMAIL);
  const suffix = `pdf-${Date.now()}`;

  const unauthenticated = await fetch(`${baseUrl}/api/challans/does-not-exist/pdf`);
  assert.equal(unauthenticated.status, 401);

  const missing = await fetch(`${baseUrl}/api/challans/does-not-exist/pdf`, {
    headers: authHeader(salesToken),
  });
  assert.equal(missing.status, 404);

  const customerRes = await fetch(`${baseUrl}/api/customers`, {
    method: 'POST',
    headers: { ...authHeader(salesToken), 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: `PDF Customer ${suffix}`,
      mobile: '9888777666',
      email: `pdf.${suffix}@example.com`,
      businessName: `PDF Biz ${suffix}`,
      customerType: 'RETAIL',
      status: 'ACTIVE',
      gstNumber: '22AAAAA0000A1Z5',
      address: '12 Export Lane',
    }),
  });
  const customerBody = await json<{ data: { customer: { id: string } } }>(customerRes);
  assert.equal(customerRes.status, 201);
  customerIds.push(customerBody.data.customer.id);

  const productRes = await fetch(`${baseUrl}/api/products`, {
    method: 'POST',
    headers: { ...authHeader(warehouseToken), 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'Historical Widget Name',
      sku: `SKU-PDF-HIST-${suffix}`,
      category: 'Accessories',
      unitPrice: '125.50',
      currentStock: 20,
      minStock: 2,
      location: 'Main store',
    }),
  });
  const productBody = await json<{ data: { product: { id: string } } }>(productRes);
  assert.equal(productRes.status, 201);
  productIds.push(productBody.data.product.id);

  const createRes = await fetch(`${baseUrl}/api/challans`, {
    method: 'POST',
    headers: { ...authHeader(salesToken), 'Content-Type': 'application/json' },
    body: JSON.stringify({
      customerId: customerBody.data.customer.id,
      items: [{ productId: productBody.data.product.id, quantity: 2 }],
    }),
  });
  const createBody = await json<{ data: { challan: ChallanBody } }>(createRes);
  assert.equal(createRes.status, 201, JSON.stringify(createBody));
  challanIds.push(createBody.data.challan.id);

  const item = createBody.data.challan.items[0];
  assert.equal(item.productNameSnapshot, 'Historical Widget Name');
  assert.equal(item.skuSnapshot, `SKU-PDF-HIST-${suffix}`);
  assert.equal(item.unitPriceSnapshot, '125.50');

  // Change live product master data after the challan snapshot was taken.
  const patchRes = await fetch(`${baseUrl}/api/products/${productBody.data.product.id}`, {
    method: 'PATCH',
    headers: { ...authHeader(adminToken), 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'LIVE PRODUCT SHOULD NOT APPEAR',
      sku: `SKU-PDF-LIVE-${suffix}`,
      unitPrice: '999.99',
    }),
  });
  assert.equal(patchRes.status, 200);

  const pdfRes = await fetch(`${baseUrl}/api/challans/${createBody.data.challan.id}/pdf`, {
    headers: authHeader(salesToken),
  });
  assert.equal(pdfRes.status, 200);
  assert.match(pdfRes.headers.get('content-type') ?? '', /application\/pdf/i);
  const disposition = pdfRes.headers.get('content-disposition') ?? '';
  assert.match(disposition, /attachment/i);
  assert.match(disposition, /sales-challan-/i);
  assert.match(disposition, /\.pdf/i);

  const bytes = Buffer.from(await pdfRes.arrayBuffer());
  assert.ok(bytes.length > 500, 'PDF should not be empty');
  assert.equal(bytes.subarray(0, 5).toString('utf8'), '%PDF-');
  assert.match(bytes.toString('latin1'), /\/Count\s+1\b/, 'short challan should be a single page');

  const pdfText = extractPdfText(bytes);
  assert.match(pdfText, /Historical Widget Name/);
  assert.match(pdfText, new RegExp(`SKU-PDF-HIST-${suffix}`));
  assert.match(pdfText, /125\.50/);
  assert.doesNotMatch(pdfText, /LIVE PRODUCT SHOULD NOT APPEAR/);
  assert.doesNotMatch(pdfText, new RegExp(`SKU-PDF-LIVE-${suffix}`));
  assert.doesNotMatch(pdfText, /999\.99/);
  assert.match(pdfText, /SALES CHALLAN/);
  assert.match(pdfText, /PDF Customer/);

  // Warehouse may view challans and therefore export PDF (read-only).
  const warehousePdf = await fetch(`${baseUrl}/api/challans/${createBody.data.challan.id}/pdf`, {
    headers: authHeader(warehouseToken),
  });
  assert.equal(warehousePdf.status, 200);
  assert.match(warehousePdf.headers.get('content-type') ?? '', /application\/pdf/i);
});
