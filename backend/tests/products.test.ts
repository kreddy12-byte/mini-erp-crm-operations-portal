import assert from 'node:assert/strict';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { test } from 'node:test';
import { app } from '../src/app';
import { prisma } from '../src/config/database';

const ADMIN_EMAIL = 'admin.dev@example.com';
const SALES_EMAIL = 'sales.dev@example.com';
const WAREHOUSE_EMAIL = 'warehouse.dev@example.com';
const ACCOUNTS_EMAIL = 'accounts.dev@example.com';
const DEV_PASSWORD = 'DevLogin!2026';

interface ErrorBody {
  success: boolean;
  error: { code: string; message: string };
}

interface LoginBody {
  success: boolean;
  data: { token: string; user: { id: string; role: string } };
}

interface ProductBody {
  id: string;
  name: string;
  sku: string;
  category: string;
  unitPrice: string;
  currentStock: number;
  minStock: number;
  location: string;
  stockStatus: 'HEALTHY' | 'LOW' | 'CRITICAL';
}

interface MovementBody {
  id: string;
  productId: string;
  quantity: number;
  movementType: 'IN' | 'OUT';
  reason: string;
  createdAt: string;
  createdBy: { id: string; name: string; role: string };
}

interface PaginationBody {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  hasPrevious: boolean;
  hasNext: boolean;
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

test('product and inventory APIs enforce auth, RBAC, CRUD, stock rules, and movement history', async (t) => {
  const server = createServer(app);
  const baseUrl = await listen(server);
  const createdIds: string[] = [];
  const suffix = `p5-${Date.now()}`;

  t.after(async () => {
    const leftovers = await prisma.product.findMany({
      where: {
        OR: [{ id: { in: createdIds } }, { sku: { startsWith: `P5-${suffix}` } }],
      },
      select: { id: true },
    });
    const leftoverIds = leftovers.map((row) => row.id);
    if (leftoverIds.length > 0) {
      await prisma.stockMovement.deleteMany({ where: { productId: { in: leftoverIds } } });
      await prisma.product.deleteMany({ where: { id: { in: leftoverIds } } });
    }
    await closeServer(server);
  });

  const unauthenticated = await fetch(`${baseUrl}/api/products`);
  const unauthenticatedBody = (await unauthenticated.json()) as ErrorBody;
  assert.equal(unauthenticated.status, 401);
  assert.equal(unauthenticatedBody.error.code, 'UNAUTHORIZED');

  const admin = await loginAs(baseUrl, ADMIN_EMAIL);
  const warehouse = await loginAs(baseUrl, WAREHOUSE_EMAIL);
  const sales = await loginAs(baseUrl, SALES_EMAIL);
  const accounts = await loginAs(baseUrl, ACCOUNTS_EMAIL);

  const salesForbiddenCreate = await fetch(`${baseUrl}/api/products`, {
    method: 'POST',
    headers: authHeader(sales.data.token),
    body: JSON.stringify({
      name: 'Should not persist',
      sku: `P5-${suffix}-SALES`,
      category: 'Electrical',
      unitPrice: 10,
      currentStock: 1,
      minStock: 1,
      location: 'Main store',
    }),
  });
  const salesForbiddenCreateBody = (await salesForbiddenCreate.json()) as ErrorBody;
  assert.equal(salesForbiddenCreate.status, 403);
  assert.equal(salesForbiddenCreateBody.error.code, 'FORBIDDEN');

  const invalid = await fetch(`${baseUrl}/api/products`, {
    method: 'POST',
    headers: authHeader(admin.data.token),
    body: JSON.stringify({
      name: '',
      sku: '',
      category: 'Electrical',
      unitPrice: -5,
      currentStock: -1,
      minStock: -2,
      location: '',
    }),
  });
  const invalidBody = (await invalid.json()) as ErrorBody;
  assert.equal(invalid.status, 400);
  assert.equal(invalidBody.error.code, 'VALIDATION_ERROR');

  const created = await fetch(`${baseUrl}/api/products`, {
    method: 'POST',
    headers: authHeader(warehouse.data.token),
    body: JSON.stringify({
      name: `Copper lug ${suffix}`,
      sku: `P5-${suffix}-LUG`,
      category: 'Accessories',
      unitPrice: 45.5,
      currentStock: 20,
      minStock: 5,
      location: 'Main store',
    }),
  });
  const createdBody = (await created.json()) as { data: { product: ProductBody } };
  assert.equal(created.status, 201);
  assert.equal(createdBody.data.product.sku, `P5-${suffix}-LUG`);
  assert.equal(createdBody.data.product.currentStock, 20);
  assert.equal(createdBody.data.product.stockStatus, 'HEALTHY');
  assert.equal(createdBody.data.product.unitPrice, '45.50');
  createdIds.push(createdBody.data.product.id);

  const duplicate = await fetch(`${baseUrl}/api/products`, {
    method: 'POST',
    headers: authHeader(admin.data.token),
    body: JSON.stringify({
      name: 'Duplicate SKU product',
      sku: `P5-${suffix}-LUG`,
      category: 'Accessories',
      unitPrice: 10,
      currentStock: 0,
      minStock: 0,
      location: 'Main store',
    }),
  });
  const duplicateBody = (await duplicate.json()) as ErrorBody;
  assert.equal(duplicate.status, 409);
  assert.equal(duplicateBody.error.code, 'DUPLICATE_SKU');

  const lowStock = await fetch(`${baseUrl}/api/products`, {
    method: 'POST',
    headers: authHeader(admin.data.token),
    body: JSON.stringify({
      name: `Low tape ${suffix}`,
      sku: `P5-${suffix}-LOW`,
      category: 'Accessories',
      unitPrice: 12,
      currentStock: 3,
      minStock: 8,
      location: 'Secondary rack',
    }),
  });
  const lowStockBody = (await lowStock.json()) as { data: { product: ProductBody } };
  assert.equal(lowStock.status, 201);
  assert.equal(lowStockBody.data.product.stockStatus, 'LOW');
  createdIds.push(lowStockBody.data.product.id);

  const critical = await fetch(`${baseUrl}/api/products`, {
    method: 'POST',
    headers: authHeader(admin.data.token),
    body: JSON.stringify({
      name: `Empty fuse ${suffix}`,
      sku: `P5-${suffix}-CRIT`,
      category: 'Electrical',
      unitPrice: 8,
      currentStock: 0,
      minStock: 4,
      location: 'Main store',
    }),
  });
  const criticalBody = (await critical.json()) as { data: { product: ProductBody } };
  assert.equal(critical.status, 201);
  assert.equal(criticalBody.data.product.stockStatus, 'CRITICAL');
  createdIds.push(criticalBody.data.product.id);

  const zeroMinHealthy = await fetch(`${baseUrl}/api/products`, {
    method: 'POST',
    headers: authHeader(admin.data.token),
    body: JSON.stringify({
      name: `Zero min clamp ${suffix}`,
      sku: `P5-${suffix}-ZMIN`,
      category: 'Electrical',
      unitPrice: 22,
      currentStock: 1,
      minStock: 0,
      location: 'Main store',
    }),
  });
  const zeroMinHealthyBody = (await zeroMinHealthy.json()) as { data: { product: ProductBody } };
  assert.equal(zeroMinHealthy.status, 201);
  assert.equal(zeroMinHealthyBody.data.product.stockStatus, 'HEALTHY');
  createdIds.push(zeroMinHealthyBody.data.product.id);

  const listed = await fetch(
    `${baseUrl}/api/products?search=${encodeURIComponent(suffix)}&sortBy=name&sortOrder=asc`,
    { headers: authHeader(accounts.data.token) },
  );
  const listedBody = (await listed.json()) as {
    data: { products: ProductBody[]; pagination: PaginationBody };
  };
  assert.equal(listed.status, 200);
  assert.equal(listedBody.data.products.length, 4);
  assert.equal(listedBody.data.pagination.total, 4);
  assert.equal(listedBody.data.pagination.page, 1);
  assert.equal(listedBody.data.pagination.hasPrevious, false);

  const searched = await fetch(`${baseUrl}/api/products?search=${encodeURIComponent(`P5-${suffix}-LUG`)}`, {
    headers: authHeader(admin.data.token),
  });
  const searchedBody = (await searched.json()) as { data: { products: ProductBody[]; pagination: { total: number } } };
  assert.equal(searched.status, 200);
  assert.equal(searchedBody.data.pagination.total, 1);
  assert.equal(searchedBody.data.products[0]?.sku, `P5-${suffix}-LUG`);

  const filtered = await fetch(
    `${baseUrl}/api/products?search=${encodeURIComponent(suffix)}&category=Accessories&stockStatus=LOW`,
    { headers: authHeader(admin.data.token) },
  );
  const filteredBody = (await filtered.json()) as { data: { products: ProductBody[]; pagination: { total: number } } };
  assert.equal(filtered.status, 200);
  assert.equal(filteredBody.data.pagination.total, 1);
  assert.equal(filteredBody.data.products[0]?.id, lowStockBody.data.product.id);

  const page = await fetch(
    `${baseUrl}/api/products?search=${encodeURIComponent(suffix)}&page=2&pageSize=1&sortBy=name&sortOrder=asc`,
    { headers: authHeader(admin.data.token) },
  );
  const pageBody = (await page.json()) as {
    data: { products: ProductBody[]; pagination: PaginationBody };
  };
  assert.equal(page.status, 200);
  assert.equal(pageBody.data.products.length, 1);
  assert.equal(pageBody.data.pagination.page, 2);
  assert.equal(pageBody.data.pagination.totalPages, 4);
  assert.equal(pageBody.data.pagination.hasPrevious, true);
  assert.equal(pageBody.data.pagination.hasNext, true);

  const detail = await fetch(`${baseUrl}/api/products/${createdBody.data.product.id}`, {
    headers: authHeader(sales.data.token),
  });
  const detailBody = (await detail.json()) as {
    data: { product: ProductBody & { recentMovements: MovementBody[] } };
  };
  assert.equal(detail.status, 200);
  assert.equal(detailBody.data.product.location, 'Main store');
  assert.equal(detailBody.data.product.recentMovements.length, 1);
  assert.equal(detailBody.data.product.recentMovements[0]?.reason, 'Initial stock');
  assert.equal(detailBody.data.product.recentMovements[0]?.createdBy.id, warehouse.data.user.id);

  const criticalDetail = await fetch(`${baseUrl}/api/products/${criticalBody.data.product.id}`, {
    headers: authHeader(admin.data.token),
  });
  const criticalDetailBody = (await criticalDetail.json()) as {
    data: { product: { recentMovements: MovementBody[] } };
  };
  assert.equal(criticalDetail.status, 200);
  assert.equal(criticalDetailBody.data.product.recentMovements.length, 0);

  const missing = await fetch(`${baseUrl}/api/products/does-not-exist`, {
    headers: authHeader(admin.data.token),
  });
  const missingBody = (await missing.json()) as ErrorBody;
  assert.equal(missing.status, 404);
  assert.equal(missingBody.error.code, 'NOT_FOUND');

  const stockOverwrite = await fetch(`${baseUrl}/api/products/${createdBody.data.product.id}`, {
    method: 'PATCH',
    headers: authHeader(admin.data.token),
    body: JSON.stringify({ currentStock: 999 }),
  });
  const stockOverwriteBody = (await stockOverwrite.json()) as ErrorBody;
  assert.equal(stockOverwrite.status, 400);
  assert.equal(stockOverwriteBody.error.code, 'VALIDATION_ERROR');

  const updated = await fetch(`${baseUrl}/api/products/${createdBody.data.product.id}`, {
    method: 'PATCH',
    headers: authHeader(admin.data.token),
    body: JSON.stringify({ name: `Copper lug updated ${suffix}`, location: 'Aisle B' }),
  });
  const updatedBody = (await updated.json()) as { data: { product: ProductBody } };
  assert.equal(updated.status, 200);
  assert.equal(updatedBody.data.product.name, `Copper lug updated ${suffix}`);
  assert.equal(updatedBody.data.product.location, 'Aisle B');
  assert.equal(updatedBody.data.product.currentStock, 20);

  const skuClash = await fetch(`${baseUrl}/api/products/${createdBody.data.product.id}`, {
    method: 'PATCH',
    headers: authHeader(admin.data.token),
    body: JSON.stringify({ sku: 'CBL-1.5-100' }),
  });
  const skuClashBody = (await skuClash.json()) as ErrorBody;
  assert.equal(skuClash.status, 409);
  assert.equal(skuClashBody.error.code, 'DUPLICATE_SKU');

  const inventory = await fetch(
    `${baseUrl}/api/inventory?search=${encodeURIComponent(suffix)}&sortBy=name&sortOrder=asc`,
    { headers: authHeader(accounts.data.token) },
  );
  const inventoryBody = (await inventory.json()) as {
    data: {
      products: ProductBody[];
      pagination: PaginationBody;
      summary: { total: number; healthy: number; low: number; critical: number };
    };
  };
  assert.equal(inventory.status, 200);
  assert.equal(inventoryBody.data.pagination.total, 4);
  assert.equal(inventoryBody.data.summary.total, 4);
  assert.equal(inventoryBody.data.summary.healthy, 2);
  assert.equal(inventoryBody.data.summary.low, 1);
  assert.equal(inventoryBody.data.summary.critical, 1);

  const salesForbiddenMove = await fetch(
    `${baseUrl}/api/inventory/${createdBody.data.product.id}/movements`,
    {
      method: 'POST',
      headers: authHeader(sales.data.token),
      body: JSON.stringify({ movementType: 'IN', quantity: 1, reason: 'Should be rejected' }),
    },
  );
  const salesForbiddenMoveBody = (await salesForbiddenMove.json()) as ErrorBody;
  assert.equal(salesForbiddenMove.status, 403);
  assert.equal(salesForbiddenMoveBody.error.code, 'FORBIDDEN');

  const accountsForbiddenMove = await fetch(
    `${baseUrl}/api/inventory/${createdBody.data.product.id}/movements`,
    {
      method: 'POST',
      headers: authHeader(accounts.data.token),
      body: JSON.stringify({ movementType: 'OUT', quantity: 1, reason: 'Should be rejected' }),
    },
  );
  assert.equal(accountsForbiddenMove.status, 403);

  const invalidType = await fetch(`${baseUrl}/api/inventory/${createdBody.data.product.id}/movements`, {
    method: 'POST',
    headers: authHeader(admin.data.token),
    body: JSON.stringify({ movementType: 'TRANSFER', quantity: 1, reason: 'Invalid type' }),
  });
  const invalidTypeBody = (await invalidType.json()) as ErrorBody;
  assert.equal(invalidType.status, 400);
  assert.equal(invalidTypeBody.error.code, 'VALIDATION_ERROR');

  const invalidQty = await fetch(`${baseUrl}/api/inventory/${createdBody.data.product.id}/movements`, {
    method: 'POST',
    headers: authHeader(admin.data.token),
    body: JSON.stringify({ movementType: 'IN', quantity: 0, reason: 'Invalid quantity' }),
  });
  const invalidQtyBody = (await invalidQty.json()) as ErrorBody;
  assert.equal(invalidQty.status, 400);
  assert.equal(invalidQtyBody.error.code, 'VALIDATION_ERROR');

  const missingMove = await fetch(`${baseUrl}/api/inventory/does-not-exist/movements`, {
    method: 'POST',
    headers: authHeader(admin.data.token),
    body: JSON.stringify({ movementType: 'IN', quantity: 1, reason: 'Missing product' }),
  });
  const missingMoveBody = (await missingMove.json()) as ErrorBody;
  assert.equal(missingMove.status, 404);
  assert.equal(missingMoveBody.error.code, 'NOT_FOUND');

  const beforeFailedOut = await prisma.stockMovement.count({
    where: { productId: createdBody.data.product.id },
  });

  const insufficient = await fetch(`${baseUrl}/api/inventory/${createdBody.data.product.id}/movements`, {
    method: 'POST',
    headers: authHeader(warehouse.data.token),
    body: JSON.stringify({
      movementType: 'OUT',
      quantity: 25,
      reason: 'Attempted oversell',
      createdBy: 'should-be-ignored',
    }),
  });
  const insufficientBody = (await insufficient.json()) as ErrorBody;
  assert.equal(insufficient.status, 409);
  assert.equal(insufficientBody.error.code, 'INSUFFICIENT_STOCK');
  assert.match(insufficientBody.error.message, /Only 20 units are available/);

  const afterFailedOut = await fetch(`${baseUrl}/api/products/${createdBody.data.product.id}`, {
    headers: authHeader(admin.data.token),
  });
  const afterFailedOutBody = (await afterFailedOut.json()) as {
    data: { product: ProductBody; recentMovements?: MovementBody[] };
  };
  assert.equal(afterFailedOutBody.data.product.currentStock, 20);
  const failedOutMovementCount = await prisma.stockMovement.count({
    where: { productId: createdBody.data.product.id },
  });
  assert.equal(failedOutMovementCount, beforeFailedOut);

  const inbound = await fetch(`${baseUrl}/api/inventory/${createdBody.data.product.id}/movements`, {
    method: 'POST',
    headers: authHeader(admin.data.token),
    body: JSON.stringify({
      movementType: 'IN',
      quantity: 5,
      reason: 'Supplier receipt',
      createdBy: sales.data.user.id,
    }),
  });
  const inboundBody = (await inbound.json()) as {
    data: {
      product: ProductBody;
      previousStock: number;
      quantity: number;
      movementType: string;
      newStock: number;
      movement: MovementBody;
    };
  };
  assert.equal(inbound.status, 201);
  assert.equal(inboundBody.data.previousStock, 20);
  assert.equal(inboundBody.data.newStock, 25);
  assert.equal(inboundBody.data.product.currentStock, 25);
  assert.equal(inboundBody.data.movement.createdBy.id, admin.data.user.id);
  assert.notEqual(inboundBody.data.movement.createdBy.id, sales.data.user.id);

  const outbound = await fetch(`${baseUrl}/api/inventory/${createdBody.data.product.id}/movements`, {
    method: 'POST',
    headers: authHeader(warehouse.data.token),
    body: JSON.stringify({ movementType: 'OUT', quantity: 7, reason: 'Issued to counter' }),
  });
  const outboundBody = (await outbound.json()) as {
    data: { product: ProductBody; previousStock: number; newStock: number };
  };
  assert.equal(outbound.status, 201);
  assert.equal(outboundBody.data.previousStock, 25);
  assert.equal(outboundBody.data.newStock, 18);
  assert.equal(outboundBody.data.product.currentStock, 18);
  assert.equal(outboundBody.data.product.stockStatus, 'HEALTHY');

  const history = await fetch(
    `${baseUrl}/api/inventory/${createdBody.data.product.id}/movements?sortOrder=desc&pageSize=20`,
    { headers: authHeader(sales.data.token) },
  );
  const historyBody = (await history.json()) as {
    data: { movements: MovementBody[]; pagination: PaginationBody };
  };
  assert.equal(history.status, 200);
  assert.equal(historyBody.data.pagination.total, 3);
  assert.equal(historyBody.data.movements[0]?.movementType, 'OUT');
  assert.equal(historyBody.data.movements[0]?.createdBy.id, warehouse.data.user.id);

  const inboundOnly = await fetch(
    `${baseUrl}/api/inventory/${createdBody.data.product.id}/movements?movementType=IN`,
    { headers: authHeader(admin.data.token) },
  );
  const inboundOnlyBody = (await inboundOnly.json()) as { data: { pagination: { total: number } } };
  assert.equal(inboundOnly.status, 200);
  assert.equal(inboundOnlyBody.data.pagination.total, 2);

  const missingHistory = await fetch(`${baseUrl}/api/inventory/does-not-exist/movements`, {
    headers: authHeader(admin.data.token),
  });
  assert.equal(missingHistory.status, 404);
});
