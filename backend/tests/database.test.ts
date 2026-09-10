import assert from 'node:assert/strict';
import { test } from 'node:test';
import { prisma } from '../src/config/database';

const expectedTables = [
  'users',
  'customers',
  'customer_follow_ups',
  'products',
  'stock_movements',
  'sales_challans',
  'sales_challan_items',
];

test('database connection and schema are available', async (t) => {
  try {
    await prisma.$connect();
    await prisma.$queryRaw`SELECT 1`;
  } catch {
    await prisma.$disconnect();
    t.skip(
      'PostgreSQL is not reachable with DATABASE_URL. Start Postgres, set credentials, and run prisma migrate deploy.',
    );
    return;
  }

  t.after(async () => {
    await prisma.$disconnect();
  });

  const tables = await prisma.$queryRaw<Array<{ table_name: string }>>`
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_type = 'BASE TABLE'
  `;

  const names = tables.map((row) => row.table_name);
  for (const table of expectedTables) {
    assert.ok(names.includes(table), `Expected table ${table} to exist`);
  }

  const userCount = await prisma.user.count();
  const productCount = await prisma.product.count();
  assert.ok(userCount >= 0);
  assert.ok(productCount >= 0);

  const relations = await prisma.$queryRaw<Array<{ constraint_name: string }>>`
    SELECT constraint_name
    FROM information_schema.table_constraints
    WHERE table_schema = 'public'
      AND constraint_type = 'FOREIGN KEY'
  `;

  assert.ok(relations.length >= 8, 'Expected core foreign keys to exist');
});
