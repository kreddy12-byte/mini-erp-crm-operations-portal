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

  const userCount = await prisma.user.count();
  const customerCount = await prisma.customer.count();
  const followUpCount = await prisma.customerFollowUp.count();
  const productCount = await prisma.product.count();
  const movementCount = await prisma.stockMovement.count();
  const challanCount = await prisma.salesChallan.count();
  const itemCount = await prisma.salesChallanItem.count();

  assert.equal(userCount, 4);
  assert.equal(customerCount, 3);
  assert.equal(followUpCount, 1);
  assert.equal(productCount, 3);
  assert.equal(movementCount, 2);
  assert.equal(challanCount, 1);
  assert.equal(itemCount, 2);

  const roles = (await prisma.user.findMany({ select: { role: true } }))
    .map((user) => user.role)
    .sort();
  assert.deepEqual(roles, ['ACCOUNTS', 'ADMIN', 'SALES', 'WAREHOUSE']);

  const challan = await prisma.salesChallan.findUnique({
    where: { challanNumber: 'CHL-DEV-0001' },
    include: {
      items: true,
      customer: true,
      createdBy: true,
    },
  });

  assert.ok(challan, 'Expected seeded draft challan');
  assert.equal(challan?.status, 'DRAFT');
  assert.ok(challan?.customer.id);
  assert.equal(challan?.createdBy.role, 'SALES');
  assert.equal(challan?.items.length, 2);

  for (const item of challan?.items ?? []) {
    assert.ok(item.productId);
    assert.ok(item.productNameSnapshot.length > 0);
    assert.ok(item.skuSnapshot.length > 0);
    assert.ok(item.unitPriceSnapshot);
    assert.ok(item.quantity > 0);
  }

  const followUp = await prisma.customerFollowUp.findFirst({
    include: { customer: true, createdBy: true },
  });
  assert.ok(followUp?.customer.id);
  assert.ok(followUp?.createdBy.id);

  const movement = await prisma.stockMovement.findFirst({
    include: { product: true, createdBy: true },
  });
  assert.ok(movement?.product.id);
  assert.ok(movement?.createdBy.id);
});
