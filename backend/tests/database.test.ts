import assert from 'node:assert/strict';
import { test } from 'node:test';
import { prisma } from '../src/config/database';

const expectedTables = [
  'users',
  'auth_tokens',
  'customers',
  'customer_follow_ups',
  'products',
  'stock_movements',
  'sales_challans',
  'sales_challan_items',
];

test('database schema, seed, and relationships are available', async (t) => {
  await prisma.$connect();
  await prisma.$queryRaw`SELECT 1`;

  t.after(async () => {
    await prisma.$disconnect();
  });

  const tables = await prisma.$queryRaw<Array<{ table_name: string }>>`
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_type = 'BASE TABLE'
  `;
  const tableNames = tables.map((row) => row.table_name);
  for (const table of expectedTables) {
    assert.ok(tableNames.includes(table), `Expected table ${table} to exist`);
  }

  const primaryKeys = await prisma.$queryRaw<Array<{ table_name: string }>>`
    SELECT table_name
    FROM information_schema.table_constraints
    WHERE table_schema = 'public'
      AND constraint_type = 'PRIMARY KEY'
  `;
  for (const table of expectedTables) {
    assert.ok(
      primaryKeys.some((row) => row.table_name === table),
      `Expected primary key on ${table}`,
    );
  }

  const uniqueIndexes = await prisma.$queryRaw<Array<{ indexname: string }>>`
    SELECT indexname
    FROM pg_indexes
    WHERE schemaname = 'public'
      AND indexdef ILIKE '%UNIQUE%'
  `;
  const uniqueNames = uniqueIndexes.map((row) => row.indexname);
  assert.ok(uniqueNames.includes('users_email_key'));
  assert.ok(uniqueNames.includes('users_google_id_key'));
  assert.ok(uniqueNames.includes('products_sku_key'));
  assert.ok(uniqueNames.includes('sales_challans_challan_number_key'));

  const foreignKeys = await prisma.$queryRaw<
    Array<{ table_name: string; constraint_name: string; delete_rule: string }>
  >`
    SELECT tc.table_name, tc.constraint_name, rc.delete_rule
    FROM information_schema.table_constraints tc
    JOIN information_schema.referential_constraints rc
      ON rc.constraint_name = tc.constraint_name
      AND rc.constraint_schema = tc.table_schema
    WHERE tc.table_schema = 'public'
      AND tc.constraint_type = 'FOREIGN KEY'
  `;

  assert.ok(foreignKeys.length >= 8, 'Expected core foreign keys to exist');

  const deleteRule = (name: string) =>
    foreignKeys.find((row) => row.constraint_name === name)?.delete_rule;

  assert.equal(deleteRule('auth_tokens_user_id_fkey'), 'CASCADE');
  assert.equal(deleteRule('customer_follow_ups_customer_id_fkey'), 'RESTRICT');
  assert.equal(deleteRule('customer_follow_ups_created_by_id_fkey'), 'RESTRICT');
  assert.equal(deleteRule('stock_movements_product_id_fkey'), 'RESTRICT');
  assert.equal(deleteRule('stock_movements_created_by_id_fkey'), 'RESTRICT');
  assert.equal(deleteRule('sales_challans_customer_id_fkey'), 'RESTRICT');
  assert.equal(deleteRule('sales_challans_created_by_id_fkey'), 'RESTRICT');
  assert.equal(deleteRule('sales_challan_items_product_id_fkey'), 'RESTRICT');
  assert.equal(deleteRule('sales_challan_items_challan_id_fkey'), 'CASCADE');

  const checks = await prisma.$queryRaw<Array<{ constraint_name: string }>>`
    SELECT constraint_name
    FROM information_schema.table_constraints
    WHERE table_schema = 'public'
      AND constraint_type = 'CHECK'
  `;
  const checkNames = checks.map((row) => row.constraint_name);
  assert.ok(checkNames.includes('products_current_stock_nonnegative'));
  assert.ok(checkNames.includes('products_min_stock_nonnegative'));
  assert.ok(checkNames.includes('products_unit_price_nonnegative'));
  assert.ok(checkNames.includes('stock_movements_quantity_positive'));
  assert.ok(checkNames.includes('sales_challan_items_quantity_positive'));

  const indexes = await prisma.$queryRaw<Array<{ indexname: string }>>`
    SELECT indexname
    FROM pg_indexes
    WHERE schemaname = 'public'
  `;
  const indexNames = indexes.map((row) => row.indexname);
  for (const indexName of [
    'customers_status_idx',
    'customers_customer_type_idx',
    'customers_follow_up_date_idx',
    'customers_business_name_idx',
    'customers_mobile_idx',
    'stock_movements_product_id_idx',
    'stock_movements_created_at_idx',
    'stock_movements_movement_type_idx',
    'sales_challans_status_idx',
    'auth_tokens_token_hash_idx',
    'auth_tokens_user_id_type_idx',
  ]) {
    assert.ok(indexNames.includes(indexName), `Expected index ${indexName}`);
  }

  const itemColumns = await prisma.$queryRaw<Array<{ column_name: string; data_type: string }>>`
    SELECT column_name, data_type
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'sales_challan_items'
  `;
  const itemColumnNames = itemColumns.map((row) => row.column_name);
  for (const column of [
    'product_id',
    'product_name_snapshot',
    'sku_snapshot',
    'unit_price_snapshot',
    'quantity',
  ]) {
    assert.ok(itemColumnNames.includes(column), `Expected ${column} on sales_challan_items`);
  }
  assert.equal(
    itemColumns.find((row) => row.column_name === 'unit_price_snapshot')?.data_type,
    'numeric',
  );

  // Seed presence checks use stable identifiers from prisma/seed.ts.
  // Absolute global counts are intentionally avoided: this suite shares the
  // development database with legitimate manual application usage.
  const seedUsers = [
    { email: 'admin.dev@example.com', role: 'ADMIN' },
    { email: 'sales.dev@example.com', role: 'SALES' },
    { email: 'warehouse.dev@example.com', role: 'WAREHOUSE' },
    { email: 'accounts.dev@example.com', role: 'ACCOUNTS' },
  ] as const;

  for (const seed of seedUsers) {
    const user = await prisma.user.findUnique({ where: { email: seed.email } });
    assert.ok(user, `Expected seed user ${seed.email}`);
    assert.equal(user.role, seed.role, `Expected seed user ${seed.email} to have role ${seed.role}`);
  }

  for (const customerId of [
    'seed-customer-retail-lead',
    'seed-customer-wholesale-active',
    'seed-customer-distributor-inactive',
  ]) {
    const customer = await prisma.customer.findUnique({ where: { id: customerId } });
    assert.ok(customer, `Expected seed customer ${customerId}`);
  }

  for (const sku of ['CBL-1.5-100', 'SWB-6W', 'LED-12W']) {
    const product = await prisma.product.findUnique({ where: { sku } });
    assert.ok(product, `Expected seed product SKU ${sku}`);
  }

  const followUp = await prisma.customerFollowUp.findUnique({
    where: { id: 'seed-followup-1' },
    include: { customer: true, createdBy: true },
  });
  assert.ok(followUp, 'Expected seed follow-up seed-followup-1');
  assert.ok(followUp.customer.id);
  assert.ok(followUp.createdBy.id);

  for (const movementId of ['seed-movement-in-1', 'seed-movement-out-1']) {
    const movement = await prisma.stockMovement.findUnique({
      where: { id: movementId },
      include: { product: true, createdBy: true },
    });
    assert.ok(movement, `Expected seed stock movement ${movementId}`);
    assert.ok(movement.product.id);
    assert.ok(movement.createdBy.id);
  }

  const challan = await prisma.salesChallan.findUnique({
    where: { challanNumber: 'CHL-DEV-0001' },
    include: {
      items: true,
      customer: true,
      createdBy: true,
    },
  });

  assert.ok(challan, 'Expected seeded draft challan CHL-DEV-0001');
  assert.equal(challan.status, 'DRAFT');
  assert.ok(challan.customer.id);
  assert.equal(challan.createdBy.role, 'SALES');
  assert.equal(challan.items.length, 2, 'Expected seed challan CHL-DEV-0001 to have 2 line items');

  for (const item of challan.items) {
    assert.ok(item.productId);
    assert.ok(item.productNameSnapshot.length > 0);
    assert.ok(item.skuSnapshot.length > 0);
    assert.ok(item.unitPriceSnapshot);
    assert.ok(item.quantity > 0);
  }
});
