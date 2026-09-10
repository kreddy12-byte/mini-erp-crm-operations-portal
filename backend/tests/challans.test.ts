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

interface PaginationBody {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  hasPrevious: boolean;
  hasNext: boolean;
}

interface ChallanItemBody {
  id: string;
  productId: string;
  quantity: number;
  productNameSnapshot: string;
  skuSnapshot: string;
  unitPriceSnapshot: string;
}

interface ChallanBody {
  id: string;
  challanNumber: string;
  status: 'DRAFT' | 'CONFIRMED' | 'CANCELLED';
  totalQuantity: number;
  createdAt: string;
  updatedAt: string;
  customer: { id: string; name: string; businessName: string };
  createdBy: { id: string; name: string; role: string };
  items: ChallanItemBody[];
}

interface ProductBody {
  id: string;
  name: string;
  sku: string;
  unitPrice: string;
  currentStock: number;
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

async function json<T>(response: Response): Promise<T> {
  return (await response.json()) as T;
}

test('sales challan APIs enforce auth, RBAC, snapshots, draft edits, and atomic confirmation', async (t) => {
  const server = createServer(app);
  const baseUrl = await listen(server);
  const suffix = `p6-${Date.now()}`;
  const customerIds: string[] = [];
  const productIds: string[] = [];
  const challanIds: string[] = [];

  t.after(async () => {
    if (challanIds.length > 0) {
      await prisma.salesChallan.deleteMany({ where: { id: { in: challanIds } } });
    }
    const leftoverChallans = await prisma.salesChallan.findMany({
      where: { customerId: { in: customerIds } },
      select: { id: true },
    });
    if (leftoverChallans.length > 0) {
      await prisma.salesChallan.deleteMany({
        where: { id: { in: leftoverChallans.map((row) => row.id) } },
      });
    }
    if (productIds.length > 0) {
      await prisma.stockMovement.deleteMany({ where: { productId: { in: productIds } } });
      await prisma.product.deleteMany({ where: { id: { in: productIds } } });
    }
    if (customerIds.length > 0) {
      await prisma.customer.deleteMany({ where: { id: { in: customerIds } } });
    }
    await closeServer(server);
  });

  const unauthenticated = await fetch(`${baseUrl}/api/challans`);
  const unauthenticatedBody = await json<ErrorBody>(unauthenticated);
  assert.equal(unauthenticated.status, 401);
  assert.equal(unauthenticatedBody.error.code, 'UNAUTHORIZED');

  const admin = await loginAs(baseUrl, ADMIN_EMAIL);
  const sales = await loginAs(baseUrl, SALES_EMAIL);
  const warehouse = await loginAs(baseUrl, WAREHOUSE_EMAIL);
  const accounts = await loginAs(baseUrl, ACCOUNTS_EMAIL);

  const warehouseCreate = await fetch(`${baseUrl}/api/challans`, {
    method: 'POST',
    headers: authHeader(warehouse.data.token),
    body: JSON.stringify({ customerId: 'x', items: [{ productId: 'y', quantity: 1 }] }),
  });
  const warehouseCreateBody = await json<ErrorBody>(warehouseCreate);
  assert.equal(warehouseCreate.status, 403);
  assert.equal(warehouseCreateBody.error.code, 'FORBIDDEN');

  const accountsCreate = await fetch(`${baseUrl}/api/challans`, {
    method: 'POST',
    headers: authHeader(accounts.data.token),
    body: JSON.stringify({ customerId: 'x', items: [{ productId: 'y', quantity: 1 }] }),
  });
  assert.equal(accountsCreate.status, 403);

  const warehouseList = await fetch(`${baseUrl}/api/challans`, {
    headers: authHeader(warehouse.data.token),
  });
  assert.equal(warehouseList.status, 200);

  const accountsList = await fetch(`${baseUrl}/api/challans`, {
    headers: authHeader(accounts.data.token),
  });
  assert.equal(accountsList.status, 200);

  const customerRes = await fetch(`${baseUrl}/api/customers`, {
    method: 'POST',
    headers: authHeader(sales.data.token),
    body: JSON.stringify({
      name: `Challan Buyer ${suffix}`,
      mobile: '9876599001',
      customerType: 'WHOLESALE',
      status: 'ACTIVE',
      businessName: `Challan Traders ${suffix}`,
      address: '1 Dispatch Road',
    }),
  });
  const customerBody = await json<{ data: { customer: { id: string } } }>(customerRes);
  assert.equal(customerRes.status, 201);
  const customerId = customerBody.data.customer.id;
  customerIds.push(customerId);

  const secondCustomerRes = await fetch(`${baseUrl}/api/customers`, {
    method: 'POST',
    headers: authHeader(admin.data.token),
    body: JSON.stringify({
      name: `Second Buyer ${suffix}`,
      mobile: '9876599002',
      customerType: 'RETAIL',
      status: 'ACTIVE',
      businessName: `Second Stores ${suffix}`,
    }),
  });
  const secondCustomerBody = await json<{ data: { customer: { id: string } } }>(secondCustomerRes);
  assert.equal(secondCustomerRes.status, 201);
  const secondCustomerId = secondCustomerBody.data.customer.id;
  customerIds.push(secondCustomerId);

  async function createProduct(input: {
    name: string;
    sku: string;
    unitPrice: number;
    currentStock: number;
  }): Promise<ProductBody> {
    const response = await fetch(`${baseUrl}/api/products`, {
      method: 'POST',
      headers: authHeader(warehouse.data.token),
      body: JSON.stringify({
        name: input.name,
        sku: input.sku,
        category: 'ChallanTest',
        unitPrice: input.unitPrice,
        currentStock: input.currentStock,
        minStock: 1,
        location: 'Main store',
      }),
    });
    const body = await json<{ data: { product: ProductBody } }>(response);
    assert.equal(response.status, 201, `Expected product create 201 for ${input.sku}`);
    productIds.push(body.data.product.id);
    return body.data.product;
  }

  const cable = await createProduct({
    name: `Test cable ${suffix}`,
    sku: `P6-${suffix}-CBL`,
    unitPrice: 1850,
    currentStock: 20,
  });
  const switchboard = await createProduct({
    name: `Test switch ${suffix}`,
    sku: `P6-${suffix}-SWB`,
    unitPrice: 640.5,
    currentStock: 10,
  });
  const scarce = await createProduct({
    name: `Scarce lamp ${suffix}`,
    sku: `P6-${suffix}-LMP`,
    unitPrice: 95.5,
    currentStock: 2,
  });
  const raceProduct = await createProduct({
    name: `Race stock ${suffix}`,
    sku: `P6-${suffix}-RACE`,
    unitPrice: 10,
    currentStock: 5,
  });

  const cableStockBeforeDraft = cable.currentStock;
  const switchStockBeforeDraft = switchboard.currentStock;
  const movementsBeforeDraft = await prisma.stockMovement.count({
    where: { productId: { in: [cable.id, switchboard.id] } },
  });

  const missingCustomer = await fetch(`${baseUrl}/api/challans`, {
    method: 'POST',
    headers: authHeader(sales.data.token),
    body: JSON.stringify({
      customerId: 'missing-customer-id',
      items: [{ productId: cable.id, quantity: 1 }],
    }),
  });
  const missingCustomerBody = await json<ErrorBody>(missingCustomer);
  assert.equal(missingCustomer.status, 404);
  assert.equal(missingCustomerBody.error.code, 'NOT_FOUND');

  const missingItems = await fetch(`${baseUrl}/api/challans`, {
    method: 'POST',
    headers: authHeader(sales.data.token),
    body: JSON.stringify({ customerId }),
  });
  const missingItemsBody = await json<ErrorBody>(missingItems);
  assert.equal(missingItems.status, 400);
  assert.equal(missingItemsBody.error.code, 'VALIDATION_ERROR');

  const emptyItems = await fetch(`${baseUrl}/api/challans`, {
    method: 'POST',
    headers: authHeader(sales.data.token),
    body: JSON.stringify({ customerId, items: [] }),
  });
  assert.equal(emptyItems.status, 400);

  const invalidProduct = await fetch(`${baseUrl}/api/challans`, {
    method: 'POST',
    headers: authHeader(sales.data.token),
    body: JSON.stringify({
      customerId,
      items: [{ productId: 'missing-product-id', quantity: 1 }],
    }),
  });
  const invalidProductBody = await json<ErrorBody>(invalidProduct);
  assert.equal(invalidProduct.status, 404);
  assert.equal(invalidProductBody.error.code, 'NOT_FOUND');

  const zeroQty = await fetch(`${baseUrl}/api/challans`, {
    method: 'POST',
    headers: authHeader(sales.data.token),
    body: JSON.stringify({
      customerId,
      items: [{ productId: cable.id, quantity: 0 }],
    }),
  });
  const zeroQtyBody = await json<ErrorBody>(zeroQty);
  assert.equal(zeroQty.status, 400);
  assert.equal(zeroQtyBody.error.code, 'VALIDATION_ERROR');

  const negativeQty = await fetch(`${baseUrl}/api/challans`, {
    method: 'POST',
    headers: authHeader(sales.data.token),
    body: JSON.stringify({
      customerId,
      items: [{ productId: cable.id, quantity: -3 }],
    }),
  });
  assert.equal(negativeQty.status, 400);

  const duplicateLines = await fetch(`${baseUrl}/api/challans`, {
    method: 'POST',
    headers: authHeader(sales.data.token),
    body: JSON.stringify({
      customerId,
      items: [
        { productId: cable.id, quantity: 1 },
        { productId: cable.id, quantity: 2 },
      ],
    }),
  });
  const duplicateLinesBody = await json<ErrorBody>(duplicateLines);
  assert.equal(duplicateLines.status, 400);
  assert.equal(duplicateLinesBody.error.code, 'VALIDATION_ERROR');

  const created = await fetch(`${baseUrl}/api/challans`, {
    method: 'POST',
    headers: authHeader(sales.data.token),
    body: JSON.stringify({
      customerId,
      createdBy: 'should-be-ignored',
      createdById: 'should-be-ignored',
      challanNumber: 'CLIENT-999',
      status: 'CONFIRMED',
      totalQuantity: 99,
      items: [
        {
          productId: cable.id,
          quantity: 2,
          productNameSnapshot: 'forged',
          skuSnapshot: 'FORGED',
          unitPriceSnapshot: '1.00',
        },
        { productId: switchboard.id, quantity: 3 },
      ],
    }),
  });
  const createdBody = await json<{ data: { challan: ChallanBody } }>(created);
  assert.equal(created.status, 201);
  const draft = createdBody.data.challan;
  challanIds.push(draft.id);
  assert.equal(draft.status, 'DRAFT');
  assert.equal(draft.totalQuantity, 5);
  assert.equal(draft.createdBy.id, sales.data.user.id);
  assert.equal(draft.createdBy.role, 'SALES');
  assert.match(draft.challanNumber, /^CHL-\d{8}-\d{4}$/);
  assert.notEqual(draft.challanNumber, 'CLIENT-999');
  assert.equal(draft.items.length, 2);
  const cableItem = draft.items.find((item) => item.productId === cable.id);
  const switchItem = draft.items.find((item) => item.productId === switchboard.id);
  assert.equal(cableItem?.productNameSnapshot, cable.name);
  assert.equal(cableItem?.skuSnapshot, cable.sku);
  assert.equal(cableItem?.unitPriceSnapshot, '1850.00');
  assert.equal(switchItem?.quantity, 3);
  assert.equal(switchItem?.unitPriceSnapshot, '640.50');

  const cableAfterDraft = await prisma.product.findUnique({
    where: { id: cable.id },
    select: { currentStock: true },
  });
  const switchAfterDraft = await prisma.product.findUnique({
    where: { id: switchboard.id },
    select: { currentStock: true },
  });
  assert.equal(cableAfterDraft?.currentStock, cableStockBeforeDraft);
  assert.equal(switchAfterDraft?.currentStock, switchStockBeforeDraft);
  const movementsAfterDraft = await prisma.stockMovement.count({
    where: { productId: { in: [cable.id, switchboard.id] }, movementType: 'OUT' },
  });
  assert.equal(movementsAfterDraft, 0);

  const patched = await fetch(`${baseUrl}/api/challans/${draft.id}`, {
    method: 'PATCH',
    headers: authHeader(admin.data.token),
    body: JSON.stringify({
      customerId: secondCustomerId,
      items: [
        { productId: cable.id, quantity: 4 },
        { productId: switchboard.id, quantity: 1 },
      ],
    }),
  });
  const patchedBody = await json<{ data: { challan: ChallanBody } }>(patched);
  assert.equal(patched.status, 200);
  assert.equal(patchedBody.data.challan.customer.id, secondCustomerId);
  assert.equal(patchedBody.data.challan.totalQuantity, 5);
  assert.equal(patchedBody.data.challan.status, 'DRAFT');

  const invalidPatch = await fetch(`${baseUrl}/api/challans/${draft.id}`, {
    method: 'PATCH',
    headers: authHeader(sales.data.token),
    body: JSON.stringify({}),
  });
  assert.equal(invalidPatch.status, 400);

  await fetch(`${baseUrl}/api/products/${cable.id}`, {
    method: 'PATCH',
    headers: authHeader(warehouse.data.token),
    body: JSON.stringify({ name: `Renamed cable ${suffix}`, sku: `P6-${suffix}-CBL-NEW`, unitPrice: 10 }),
  });

  const snapshotAfterRename = await fetch(`${baseUrl}/api/challans/${draft.id}`, {
    headers: authHeader(sales.data.token),
  });
  const snapshotAfterRenameBody = await json<{ data: { challan: ChallanBody } }>(snapshotAfterRename);
  const cableSnapshotBeforeConfirm = snapshotAfterRenameBody.data.challan.items.find(
    (item) => item.productId === cable.id,
  );
  assert.equal(cableSnapshotBeforeConfirm?.productNameSnapshot, `Test cable ${suffix}`);
  assert.equal(cableSnapshotBeforeConfirm?.skuSnapshot, `P6-${suffix}-CBL`);
  assert.equal(cableSnapshotBeforeConfirm?.unitPriceSnapshot, '1850.00');

  const refreshPatch = await fetch(`${baseUrl}/api/challans/${draft.id}`, {
    method: 'PATCH',
    headers: authHeader(sales.data.token),
    body: JSON.stringify({
      items: [
        { productId: cable.id, quantity: 4 },
        { productId: switchboard.id, quantity: 1 },
      ],
    }),
  });
  const refreshPatchBody = await json<{ data: { challan: ChallanBody } }>(refreshPatch);
  assert.equal(refreshPatch.status, 200);
  const refreshedCable = refreshPatchBody.data.challan.items.find((item) => item.productId === cable.id);
  assert.equal(refreshedCable?.productNameSnapshot, `Renamed cable ${suffix}`);
  assert.equal(refreshedCable?.skuSnapshot, `P6-${suffix}-CBL-NEW`);
  assert.equal(refreshedCable?.unitPriceSnapshot, '10.00');

  const confirmed = await fetch(`${baseUrl}/api/challans/${draft.id}/confirm`, {
    method: 'POST',
    headers: authHeader(sales.data.token),
  });
  const confirmedBody = await json<{ data: { challan: ChallanBody } }>(confirmed);
  assert.equal(confirmed.status, 200);
  assert.equal(confirmedBody.data.challan.status, 'CONFIRMED');
  assert.equal(confirmedBody.data.challan.totalQuantity, 5);

  const cableAfterConfirm = await prisma.product.findUnique({
    where: { id: cable.id },
    select: { currentStock: true, name: true },
  });
  const switchAfterConfirm = await prisma.product.findUnique({
    where: { id: switchboard.id },
    select: { currentStock: true },
  });
  assert.equal(cableAfterConfirm?.currentStock, cableStockBeforeDraft - 4);
  assert.equal(switchAfterConfirm?.currentStock, switchStockBeforeDraft - 1);

  const outMovements = await prisma.stockMovement.findMany({
    where: {
      productId: { in: [cable.id, switchboard.id] },
      movementType: 'OUT',
      reason: { contains: confirmedBody.data.challan.challanNumber },
    },
    orderBy: { createdAt: 'asc' },
  });
  assert.equal(outMovements.length, 2);
  assert.equal(
    outMovements.reduce((sum, row) => sum + row.quantity, 0),
    5,
  );
  assert.ok(outMovements.every((row) => row.createdById === sales.data.user.id));

  await fetch(`${baseUrl}/api/products/${cable.id}`, {
    method: 'PATCH',
    headers: authHeader(warehouse.data.token),
    body: JSON.stringify({ name: `Cable after confirm ${suffix}`, unitPrice: 1 }),
  });
  const snapshotAfterConfirm = await fetch(`${baseUrl}/api/challans/${draft.id}`, {
    headers: authHeader(accounts.data.token),
  });
  const snapshotAfterConfirmBody = await json<{ data: { challan: ChallanBody } }>(snapshotAfterConfirm);
  const frozen = snapshotAfterConfirmBody.data.challan.items.find((item) => item.productId === cable.id);
  assert.equal(frozen?.productNameSnapshot, `Renamed cable ${suffix}`);
  assert.equal(frozen?.unitPriceSnapshot, '10.00');

  const confirmAgain = await fetch(`${baseUrl}/api/challans/${draft.id}/confirm`, {
    method: 'POST',
    headers: authHeader(admin.data.token),
  });
  const confirmAgainBody = await json<ErrorBody>(confirmAgain);
  assert.equal(confirmAgain.status, 409);
  assert.equal(confirmAgainBody.error.code, 'INVALID_CHALLAN_STATE');

  const editConfirmed = await fetch(`${baseUrl}/api/challans/${draft.id}`, {
    method: 'PATCH',
    headers: authHeader(sales.data.token),
    body: JSON.stringify({ items: [{ productId: cable.id, quantity: 1 }] }),
  });
  const editConfirmedBody = await json<ErrorBody>(editConfirmed);
  assert.equal(editConfirmed.status, 409);
  assert.equal(editConfirmedBody.error.code, 'INVALID_CHALLAN_STATE');

  const cancelConfirmed = await fetch(`${baseUrl}/api/challans/${draft.id}/cancel`, {
    method: 'POST',
    headers: authHeader(sales.data.token),
  });
  const cancelConfirmedBody = await json<ErrorBody>(cancelConfirmed);
  assert.equal(cancelConfirmed.status, 409);
  assert.equal(cancelConfirmedBody.error.code, 'INVALID_CHALLAN_STATE');

  const toCancel = await fetch(`${baseUrl}/api/challans`, {
    method: 'POST',
    headers: authHeader(sales.data.token),
    body: JSON.stringify({
      customerId,
      items: [{ productId: scarce.id, quantity: 1 }],
    }),
  });
  const toCancelBody = await json<{ data: { challan: ChallanBody } }>(toCancel);
  assert.equal(toCancel.status, 201);
  challanIds.push(toCancelBody.data.challan.id);

  const cancelled = await fetch(`${baseUrl}/api/challans/${toCancelBody.data.challan.id}/cancel`, {
    method: 'POST',
    headers: authHeader(sales.data.token),
  });
  const cancelledBody = await json<{ data: { challan: ChallanBody } }>(cancelled);
  assert.equal(cancelled.status, 200);
  assert.equal(cancelledBody.data.challan.status, 'CANCELLED');

  const scarceAfterCancel = await prisma.product.findUnique({
    where: { id: scarce.id },
    select: { currentStock: true },
  });
  assert.equal(scarceAfterCancel?.currentStock, 2);

  const editCancelled = await fetch(`${baseUrl}/api/challans/${toCancelBody.data.challan.id}`, {
    method: 'PATCH',
    headers: authHeader(sales.data.token),
    body: JSON.stringify({ items: [{ productId: scarce.id, quantity: 1 }] }),
  });
  assert.equal(editCancelled.status, 409);

  const confirmCancelled = await fetch(`${baseUrl}/api/challans/${toCancelBody.data.challan.id}/confirm`, {
    method: 'POST',
    headers: authHeader(sales.data.token),
  });
  assert.equal(confirmCancelled.status, 409);

  const insufficientDraft = await fetch(`${baseUrl}/api/challans`, {
    method: 'POST',
    headers: authHeader(sales.data.token),
    body: JSON.stringify({
      customerId,
      items: [
        { productId: scarce.id, quantity: 1 },
        { productId: raceProduct.id, quantity: 1 },
      ],
    }),
  });
  const insufficientDraftBody = await json<{ data: { challan: ChallanBody } }>(insufficientDraft);
  assert.equal(insufficientDraft.status, 201);
  challanIds.push(insufficientDraftBody.data.challan.id);

  const insufficient = await fetch(`${baseUrl}/api/challans/${insufficientDraftBody.data.challan.id}`, {
    method: 'PATCH',
    headers: authHeader(sales.data.token),
    body: JSON.stringify({
      items: [
        { productId: scarce.id, quantity: 9 },
        { productId: raceProduct.id, quantity: 1 },
      ],
    }),
  });
  assert.equal(insufficient.status, 200);

  const scarceBeforeFail = await prisma.product.findUnique({
    where: { id: scarce.id },
    select: { currentStock: true },
  });
  const raceBeforeFail = await prisma.product.findUnique({
    where: { id: raceProduct.id },
    select: { currentStock: true },
  });
  const movementsBeforeFail = await prisma.stockMovement.count({
    where: { productId: { in: [scarce.id, raceProduct.id] }, movementType: 'OUT' },
  });

  const failedConfirm = await fetch(`${baseUrl}/api/challans/${insufficientDraftBody.data.challan.id}/confirm`, {
    method: 'POST',
    headers: authHeader(sales.data.token),
  });
  const failedConfirmBody = await json<ErrorBody>(failedConfirm);
  assert.equal(failedConfirm.status, 409);
  assert.equal(failedConfirmBody.error.code, 'INSUFFICIENT_STOCK');

  const failedDetail = await fetch(`${baseUrl}/api/challans/${insufficientDraftBody.data.challan.id}`, {
    headers: authHeader(sales.data.token),
  });
  const failedDetailBody = await json<{ data: { challan: ChallanBody } }>(failedDetail);
  assert.equal(failedDetailBody.data.challan.status, 'DRAFT');

  const scarceAfterFail = await prisma.product.findUnique({
    where: { id: scarce.id },
    select: { currentStock: true },
  });
  const raceAfterFail = await prisma.product.findUnique({
    where: { id: raceProduct.id },
    select: { currentStock: true },
  });
  assert.equal(scarceAfterFail?.currentStock, scarceBeforeFail?.currentStock);
  assert.equal(raceAfterFail?.currentStock, raceBeforeFail?.currentStock);
  const movementsAfterFail = await prisma.stockMovement.count({
    where: { productId: { in: [scarce.id, raceProduct.id] }, movementType: 'OUT' },
  });
  assert.equal(movementsAfterFail, movementsBeforeFail);

  const raceA = await fetch(`${baseUrl}/api/challans`, {
    method: 'POST',
    headers: authHeader(sales.data.token),
    body: JSON.stringify({
      customerId,
      items: [{ productId: raceProduct.id, quantity: 4 }],
    }),
  });
  const raceB = await fetch(`${baseUrl}/api/challans`, {
    method: 'POST',
    headers: authHeader(admin.data.token),
    body: JSON.stringify({
      customerId,
      items: [{ productId: raceProduct.id, quantity: 4 }],
    }),
  });
  const raceABody = await json<{ data: { challan: ChallanBody } }>(raceA);
  const raceBBody = await json<{ data: { challan: ChallanBody } }>(raceB);
  assert.equal(raceA.status, 201);
  assert.equal(raceB.status, 201);
  challanIds.push(raceABody.data.challan.id, raceBBody.data.challan.id);

  const [raceConfirmA, raceConfirmB] = await Promise.all([
    fetch(`${baseUrl}/api/challans/${raceABody.data.challan.id}/confirm`, {
      method: 'POST',
      headers: authHeader(sales.data.token),
    }),
    fetch(`${baseUrl}/api/challans/${raceBBody.data.challan.id}/confirm`, {
      method: 'POST',
      headers: authHeader(admin.data.token),
    }),
  ]);
  const raceStatuses = [raceConfirmA.status, raceConfirmB.status].sort();
  assert.deepEqual(raceStatuses, [200, 409]);
  const raceStock = await prisma.product.findUnique({
    where: { id: raceProduct.id },
    select: { currentStock: true },
  });
  assert.ok((raceStock?.currentStock ?? -1) >= 0);
  assert.equal(raceStock?.currentStock, 1);

  const listed = await fetch(
    `${baseUrl}/api/challans?customerId=${encodeURIComponent(customerId)}&status=DRAFT&page=1&pageSize=10&sortBy=createdAt&sortOrder=desc`,
    { headers: authHeader(sales.data.token) },
  );
  const listedBody = await json<{ data: { challans: ChallanBody[]; pagination: PaginationBody } }>(listed);
  assert.equal(listed.status, 200);
  assert.ok(listedBody.data.pagination.total >= 1);
  assert.equal(listedBody.data.pagination.page, 1);
  assert.equal(listedBody.data.pagination.pageSize, 10);
  assert.ok(listedBody.data.challans.every((row) => row.status === 'DRAFT'));
  assert.ok(listedBody.data.challans.every((row) => row.customer.id === customerId));

  const searched = await fetch(
    `${baseUrl}/api/challans?search=${encodeURIComponent(`Challan Traders ${suffix}`)}&page=1&pageSize=20`,
    { headers: authHeader(warehouse.data.token) },
  );
  const searchedBody = await json<{ data: { challans: ChallanBody[]; pagination: PaginationBody } }>(searched);
  assert.equal(searched.status, 200);
  assert.ok(searchedBody.data.challans.length >= 1);
  assert.ok(searchedBody.data.pagination.total >= searchedBody.data.challans.length);

  const invalidStatus = await fetch(`${baseUrl}/api/challans?status=SHIPPED`, {
    headers: authHeader(sales.data.token),
  });
  assert.equal(invalidStatus.status, 400);

  const missingDetail = await fetch(`${baseUrl}/api/challans/does-not-exist`, {
    headers: authHeader(sales.data.token),
  });
  const missingDetailBody = await json<ErrorBody>(missingDetail);
  assert.equal(missingDetail.status, 404);
  assert.equal(missingDetailBody.error.code, 'NOT_FOUND');

  const warehouseConfirm = await fetch(`${baseUrl}/api/challans/${insufficientDraftBody.data.challan.id}/confirm`, {
    method: 'POST',
    headers: authHeader(warehouse.data.token),
  });
  assert.equal(warehouseConfirm.status, 403);

  const warehouseCancel = await fetch(`${baseUrl}/api/challans/${insufficientDraftBody.data.challan.id}/cancel`, {
    method: 'POST',
    headers: authHeader(accounts.data.token),
  });
  assert.equal(warehouseCancel.status, 403);
});
