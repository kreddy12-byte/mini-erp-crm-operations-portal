import { Prisma } from '@prisma/client';
import { prisma } from '../config/database';
import type { ChallanLineInput, ChallanListQuery, ChallanPatchInput } from '../types/challan';
import { AppError, ErrorCodes } from '../utils/app-error';

/** Application-specific Postgres advisory lock key for challan number allocation. */
const CHALLAN_NUMBER_LOCK = 610_061;

const challanSelect = {
  id: true,
  challanNumber: true,
  customerId: true,
  totalQuantity: true,
  status: true,
  createdById: true,
  createdAt: true,
  updatedAt: true,
  customer: {
    select: {
      id: true,
      name: true,
      mobile: true,
      email: true,
      businessName: true,
      customerType: true,
      status: true,
    },
  },
  createdBy: {
    select: {
      id: true,
      name: true,
      role: true,
    },
  },
  items: {
    orderBy: { createdAt: 'asc' as const },
    select: {
      id: true,
      productId: true,
      productNameSnapshot: true,
      skuSnapshot: true,
      unitPriceSnapshot: true,
      quantity: true,
      createdAt: true,
    },
  },
} satisfies Prisma.SalesChallanSelect;

type Tx = Prisma.TransactionClient;

function toWhere(query: ChallanListQuery): Prisma.SalesChallanWhereInput {
  const where: Prisma.SalesChallanWhereInput = {};
  if (query.status) {
    where.status = query.status;
  }
  if (query.customerId) {
    where.customerId = query.customerId;
  }
  if (query.search) {
    where.OR = [
      { challanNumber: { contains: query.search, mode: 'insensitive' } },
      { customer: { name: { contains: query.search, mode: 'insensitive' } } },
      { customer: { businessName: { contains: query.search, mode: 'insensitive' } } },
    ];
  }
  return where;
}

function challanDatePrefix(now = new Date()): string {
  const year = String(now.getUTCFullYear());
  const month = String(now.getUTCMonth() + 1).padStart(2, '0');
  const day = String(now.getUTCDate()).padStart(2, '0');
  return `CHL-${year}${month}${day}-`;
}

async function nextChallanNumber(tx: Tx): Promise<string> {
  // Serialize number allocation across concurrent creates. Unique(challanNumber)
  // is the last line of defense if two transactions still collide.
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(${CHALLAN_NUMBER_LOCK})`;

  const prefix = challanDatePrefix();
  const rows = await tx.salesChallan.findMany({
    where: { challanNumber: { startsWith: prefix } },
    select: { challanNumber: true },
  });

  let maxSeq = 0;
  for (const row of rows) {
    const seq = Number.parseInt(row.challanNumber.slice(prefix.length), 10);
    if (Number.isInteger(seq) && seq > maxSeq) {
      maxSeq = seq;
    }
  }

  return `${prefix}${String(maxSeq + 1).padStart(4, '0')}`;
}

async function requireCustomer(tx: Tx, customerId: string): Promise<void> {
  const customer = await tx.customer.findUnique({
    where: { id: customerId },
    select: { id: true },
  });
  if (!customer) {
    throw new AppError(404, ErrorCodes.NOT_FOUND, 'Customer was not found.');
  }
}

async function loadProductsForLines(tx: Tx, items: ChallanLineInput[]) {
  const ids = items.map((item) => item.productId);
  const products = await tx.product.findMany({
    where: { id: { in: ids } },
    select: {
      id: true,
      name: true,
      sku: true,
      unitPrice: true,
    },
  });
  if (products.length !== ids.length) {
    throw new AppError(404, ErrorCodes.NOT_FOUND, 'Product was not found.');
  }
  return new Map(products.map((product) => [product.id, product]));
}

function itemCreates(items: ChallanLineInput[], products: Awaited<ReturnType<typeof loadProductsForLines>>) {
  return items.map((item) => {
    const product = products.get(item.productId);
    if (!product) {
      throw new AppError(404, ErrorCodes.NOT_FOUND, 'Product was not found.');
    }
    return {
      productId: product.id,
      quantity: item.quantity,
      productNameSnapshot: product.name,
      skuSnapshot: product.sku,
      unitPriceSnapshot: product.unitPrice,
    };
  });
}

function totalQuantity(items: ChallanLineInput[]): number {
  return items.reduce((sum, item) => sum + item.quantity, 0);
}

export async function listChallans(query: ChallanListQuery) {
  const where = toWhere(query);
  const skip = (query.page - 1) * query.pageSize;
  const [total, rows] = await prisma.$transaction([
    prisma.salesChallan.count({ where }),
    prisma.salesChallan.findMany({
      where,
      orderBy: { [query.sortBy]: query.sortOrder },
      skip,
      take: query.pageSize,
      select: challanSelect,
    }),
  ]);
  return { total, rows };
}

export async function findChallanById(id: string) {
  return prisma.salesChallan.findUnique({
    where: { id },
    select: challanSelect,
  });
}

export async function createDraftChallan(input: {
  customerId: string;
  items: ChallanLineInput[];
  createdById: string;
}) {
  return prisma.$transaction(async (tx) => {
    await requireCustomer(tx, input.customerId);
    const products = await loadProductsForLines(tx, input.items);
    const challanNumber = await nextChallanNumber(tx);

    try {
      return await tx.salesChallan.create({
        data: {
          challanNumber,
          customerId: input.customerId,
          totalQuantity: totalQuantity(input.items),
          status: 'DRAFT',
          createdById: input.createdById,
          items: { create: itemCreates(input.items, products) },
        },
        select: challanSelect,
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new AppError(
          409,
          ErrorCodes.CONFLICT,
          'A challan number collision occurred. Please retry.',
        );
      }
      throw error;
    }
  });
}

export async function updateDraftChallan(id: string, input: ChallanPatchInput) {
  return prisma.$transaction(async (tx) => {
    // Lock the header so a concurrent confirm/cancel cannot interleave with this edit.
    const locked = await tx.$queryRaw<Array<{ id: string; status: string }>>`
      SELECT id, status FROM sales_challans WHERE id = ${id} FOR UPDATE
    `;
    const row = locked[0];
    if (!row) {
      throw new AppError(404, ErrorCodes.NOT_FOUND, 'Challan was not found.');
    }
    if (row.status !== 'DRAFT') {
      throw new AppError(
        409,
        ErrorCodes.INVALID_CHALLAN_STATE,
        'Only draft challans can be edited.',
      );
    }

    if (input.customerId) {
      await requireCustomer(tx, input.customerId);
    }

    const data: Prisma.SalesChallanUpdateInput = {};
    if (input.customerId) {
      data.customer = { connect: { id: input.customerId } };
    }

    if (input.items) {
      const products = await loadProductsForLines(tx, input.items);
      data.totalQuantity = totalQuantity(input.items);
      data.items = {
        deleteMany: {},
        create: itemCreates(input.items, products),
      };
    }

    return tx.salesChallan.update({
      where: { id },
      data,
      select: challanSelect,
    });
  });
}

export async function confirmChallan(id: string, createdById: string) {
  return prisma.$transaction(
    async (tx) => {
      // 1. VALIDATE CHALLAN STATE
      // Lock the challan first so two confirm requests cannot both observe DRAFT.
      const lockedChallan = await tx.$queryRaw<Array<{ id: string; status: string; challan_number: string }>>`
        SELECT id, status, challan_number FROM sales_challans WHERE id = ${id} FOR UPDATE
      `;
      const header = lockedChallan[0];
      if (!header) {
        throw new AppError(404, ErrorCodes.NOT_FOUND, 'Challan was not found.');
      }
      if (header.status === 'CONFIRMED') {
        throw new AppError(
          409,
          ErrorCodes.INVALID_CHALLAN_STATE,
          'This challan is already confirmed.',
        );
      }
      if (header.status !== 'DRAFT') {
        throw new AppError(
          409,
          ErrorCodes.INVALID_CHALLAN_STATE,
          'Only draft challans can be confirmed.',
        );
      }

      const items = await tx.salesChallanItem.findMany({
        where: { challanId: id },
        select: {
          id: true,
          productId: true,
          quantity: true,
        },
      });
      if (items.length === 0) {
        throw new AppError(400, ErrorCodes.VALIDATION_ERROR, 'A challan must contain at least one product line.');
      }

      // 2. LOCK PRODUCT ROWS
      // Inventory OUT already uses SELECT ... FOR UPDATE. The same lock is required
      // here so concurrent challan confirms and warehouse OUT movements cannot both
      // spend the same units. Sort by id to keep lock order stable and avoid deadlocks.
      const productIds = [...new Set(items.map((item) => item.productId))].sort();
      const lockedProducts = await tx.$queryRaw<
        Array<{
          id: string;
          name: string;
          sku: string;
          current_stock: number | bigint | string;
        }>
      >`
        SELECT id, name, sku, "current_stock"
        FROM products
        WHERE id IN (${Prisma.join(productIds)})
        ORDER BY id
        FOR UPDATE
      `;

      if (lockedProducts.length !== productIds.length) {
        throw new AppError(404, ErrorCodes.NOT_FOUND, 'Product was not found.');
      }

      const stockById = new Map<string, { id: string; name: string; sku: string; currentStock: number }>(
        lockedProducts.map((product) => {
          const currentStock = Number(product.current_stock);
          if (!Number.isFinite(currentStock)) {
            throw new AppError(500, ErrorCodes.INTERNAL_ERROR, 'Product stock could not be read.');
          }
          return [product.id, { id: product.id, name: product.name, sku: product.sku, currentStock }];
        }),
      );

      // 3. VERIFY CURRENT STOCK for every line before writing anything.
      // Partial deduction would leave inventory and the challan inconsistent.
      for (const item of items) {
        const product = stockById.get(item.productId);
        if (!product) {
          throw new AppError(404, ErrorCodes.NOT_FOUND, 'Product was not found.');
        }
        if (product.currentStock < item.quantity) {
          throw new AppError(
            409,
            ErrorCodes.INSUFFICIENT_STOCK,
            `Insufficient stock for ${product.name} (${product.sku}). Requested ${item.quantity}, available ${product.currentStock}.`,
          );
        }
      }

      const reason = `Sales challan ${header.challan_number}`;

      // 4. DEDUCT STOCK
      // 5. CREATE STOCK MOVEMENTS
      for (const item of items) {
        const product = stockById.get(item.productId);
        if (!product) {
          throw new AppError(404, ErrorCodes.NOT_FOUND, 'Product was not found.');
        }
        const nextStock = product.currentStock - item.quantity;
        await tx.product.update({
          where: { id: item.productId },
          data: { currentStock: nextStock },
        });
        await tx.stockMovement.create({
          data: {
            productId: item.productId,
            quantity: item.quantity,
            movementType: 'OUT',
            reason,
            createdById,
          },
        });
        product.currentStock = nextStock;
      }

      // 6. CONFIRM CHALLAN
      // Snapshots are left untouched so later catalog edits cannot rewrite history.
      const confirmed = await tx.salesChallan.update({
        where: { id },
        data: { status: 'CONFIRMED' },
        select: challanSelect,
      });

      // 7. COMMIT TRANSACTION (Prisma commits on successful callback return)
      return confirmed;
    },
    { timeout: 10_000, maxWait: 5_000 },
  );
}

export async function cancelDraftChallan(id: string) {
  return prisma.$transaction(async (tx) => {
    const locked = await tx.$queryRaw<Array<{ id: string; status: string }>>`
      SELECT id, status FROM sales_challans WHERE id = ${id} FOR UPDATE
    `;
    const row = locked[0];
    if (!row) {
      throw new AppError(404, ErrorCodes.NOT_FOUND, 'Challan was not found.');
    }
    if (row.status === 'CANCELLED') {
      throw new AppError(
        409,
        ErrorCodes.INVALID_CHALLAN_STATE,
        'This challan is already cancelled.',
      );
    }
    if (row.status === 'CONFIRMED') {
      throw new AppError(
        409,
        ErrorCodes.INVALID_CHALLAN_STATE,
        'Confirmed challans cannot be cancelled because stock has already been deducted.',
      );
    }
    if (row.status !== 'DRAFT') {
      throw new AppError(
        409,
        ErrorCodes.INVALID_CHALLAN_STATE,
        'Only draft challans can be cancelled.',
      );
    }

    return tx.salesChallan.update({
      where: { id },
      data: { status: 'CANCELLED' },
      select: challanSelect,
    });
  });
}

export { challanSelect };
