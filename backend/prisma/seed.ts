import {
  ChallanStatus,
  CustomerStatus,
  CustomerType,
  MovementType,
  PrismaClient,
  UserRole,
} from '@prisma/client';

const prisma = new PrismaClient();

const DEV_PASSWORD_HASH =
  'phase2-dev-placeholder-hash-not-a-real-password-do-not-use-for-login';

async function seed(): Promise<void> {
  const admin = await prisma.user.upsert({
    where: { email: 'admin.dev@example.com' },
    update: {},
    create: {
      name: 'Dev Admin',
      email: 'admin.dev@example.com',
      passwordHash: DEV_PASSWORD_HASH,
      role: UserRole.ADMIN,
    },
  });

  const sales = await prisma.user.upsert({
    where: { email: 'sales.dev@example.com' },
    update: {},
    create: {
      name: 'Dev Sales',
      email: 'sales.dev@example.com',
      passwordHash: DEV_PASSWORD_HASH,
      role: UserRole.SALES,
    },
  });

  await prisma.user.upsert({
    where: { email: 'warehouse.dev@example.com' },
    update: {},
    create: {
      name: 'Dev Warehouse',
      email: 'warehouse.dev@example.com',
      passwordHash: DEV_PASSWORD_HASH,
      role: UserRole.WAREHOUSE,
    },
  });

  await prisma.user.upsert({
    where: { email: 'accounts.dev@example.com' },
    update: {},
    create: {
      name: 'Dev Accounts',
      email: 'accounts.dev@example.com',
      passwordHash: DEV_PASSWORD_HASH,
      role: UserRole.ACCOUNTS,
    },
  });

  const retailLead = await prisma.customer.upsert({
    where: { id: 'seed-customer-retail-lead' },
    update: {},
    create: {
      id: 'seed-customer-retail-lead',
      name: 'Anita Sharma',
      mobile: '9876500001',
      email: 'anita.retail@example.com',
      businessName: 'Sharma Home Stores',
      gstNumber: null,
      customerType: CustomerType.RETAIL,
      address: '12 MG Road, Pune',
      status: CustomerStatus.LEAD,
      followUpDate: new Date('2026-09-20T10:00:00.000Z'),
      notes: 'Interested in starter pack. Seed record only.',
    },
  });

  const wholesaleActive = await prisma.customer.upsert({
    where: { id: 'seed-customer-wholesale-active' },
    update: {},
    create: {
      id: 'seed-customer-wholesale-active',
      name: 'Rahul Mehta',
      mobile: '9876500002',
      email: 'rahul.wholesale@example.com',
      businessName: 'Mehta Distributors',
      gstNumber: '27ABCDE1234F1Z5',
      customerType: CustomerType.WHOLESALE,
      address: '44 Industrial Estate, Nashik',
      status: CustomerStatus.ACTIVE,
      followUpDate: new Date('2026-09-18T09:00:00.000Z'),
      notes: 'Monthly replenishment customer.',
    },
  });

  await prisma.customer.upsert({
    where: { id: 'seed-customer-distributor-inactive' },
    update: {},
    create: {
      id: 'seed-customer-distributor-inactive',
      name: 'Kavita Iyer',
      mobile: '9876500003',
      email: 'kavita.distributor@example.com',
      businessName: 'Iyer Regional Supply',
      gstNumber: '29FGHIJ5678K2Z6',
      customerType: CustomerType.DISTRIBUTOR,
      address: '8 Warehouse Lane, Bengaluru',
      status: CustomerStatus.INACTIVE,
      followUpDate: null,
      notes: 'Paused pending credit review.',
    },
  });

  const cable = await prisma.product.upsert({
    where: { sku: 'CBL-1.5-100' },
    update: {},
    create: {
      name: '1.5 sq mm copper cable',
      sku: 'CBL-1.5-100',
      category: 'Electrical',
      unitPrice: '1850.00',
      currentStock: 42,
      minStock: 20,
      location: 'Main store',
    },
  });

  const switchboard = await prisma.product.upsert({
    where: { sku: 'SWB-6W' },
    update: {},
    create: {
      name: '6-way switchboard',
      sku: 'SWB-6W',
      category: 'Electrical',
      unitPrice: '640.00',
      currentStock: 8,
      minStock: 10,
      location: 'Main store',
    },
  });

  await prisma.product.upsert({
    where: { sku: 'LED-12W' },
    update: {},
    create: {
      name: '12W LED bulb',
      sku: 'LED-12W',
      category: 'Lighting',
      unitPrice: '95.50',
      currentStock: 0,
      minStock: 25,
      location: 'Secondary rack',
    },
  });

  const existingFollowUp = await prisma.customerFollowUp.findFirst({
    where: { id: 'seed-followup-1' },
  });

  if (!existingFollowUp) {
    await prisma.customerFollowUp.create({
      data: {
        id: 'seed-followup-1',
        customerId: retailLead.id,
        note: 'Called about sample pack. Follow up after festival week.',
        followUpDate: new Date('2026-09-20T10:00:00.000Z'),
        createdById: sales.id,
      },
    });
  }

  const existingMovement = await prisma.stockMovement.findFirst({
    where: { id: 'seed-movement-in-1' },
  });

  if (!existingMovement) {
    await prisma.stockMovement.create({
      data: {
        id: 'seed-movement-in-1',
        productId: cable.id,
        quantity: 50,
        movementType: MovementType.IN,
        reason: 'Opening stock (development seed)',
        createdById: admin.id,
      },
    });

    await prisma.stockMovement.create({
      data: {
        id: 'seed-movement-out-1',
        productId: switchboard.id,
        quantity: 2,
        movementType: MovementType.OUT,
        reason: 'Sample issue (development seed)',
        createdById: admin.id,
      },
    });
  }

  const existingChallan = await prisma.salesChallan.findUnique({
    where: { challanNumber: 'CHL-DEV-0001' },
  });

  if (!existingChallan) {
    await prisma.salesChallan.create({
      data: {
        challanNumber: 'CHL-DEV-0001',
        customerId: wholesaleActive.id,
        totalQuantity: 3,
        status: ChallanStatus.DRAFT,
        createdById: sales.id,
        items: {
          create: [
            {
              productId: cable.id,
              productNameSnapshot: cable.name,
              skuSnapshot: cable.sku,
              unitPriceSnapshot: cable.unitPrice,
              quantity: 1,
            },
            {
              productId: switchboard.id,
              productNameSnapshot: switchboard.name,
              skuSnapshot: switchboard.sku,
              unitPriceSnapshot: switchboard.unitPrice,
              quantity: 2,
            },
          ],
        },
      },
    });
  }
}

seed()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error: unknown) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
