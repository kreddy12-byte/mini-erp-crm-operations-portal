import { Prisma } from '@prisma/client';
import { prisma } from '../config/database';
import type {
  MovementListQuery,
  MovementType,
  ProductListQuery,
  ProductPatchInput,
  ProductWriteInput,
  StockStatus,
} from '../types/product';
import { AppError, ErrorCodes } from '../utils/app-error';

const productSelect = {
  id: true,
  name: true,
  sku: true,
  category: true,
  unitPrice: true,
  currentStock: true,
  minStock: true,
  location: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.ProductSelect;

const movementSelect = {
  id: true,
  productId: true,
  quantity: true,
  movementType: true,
  reason: true,
  createdAt: true,
  createdBy: {
    select: {
      id: true,
      name: true,
      role: true,
    },
  },
} satisfies Prisma.StockMovementSelect;

function toPrismaWhere(query: ProductListQuery): Prisma.ProductWhereInput {
  const where: Prisma.ProductWhereInput = {};
  if (query.category) {
    where.category = query.category;
  }
  if (query.location) {
    where.location = { contains: query.location, mode: 'insensitive' };
  }
  if (query.search) {
    where.OR = [
      { name: { contains: query.search, mode: 'insensitive' } },
      { sku: { contains: query.search, mode: 'insensitive' } },
      { category: { contains: query.search, mode: 'insensitive' } },
    ];
  }
  return where;
}

function stockStatusSql(status: StockStatus): Prisma.Sql {
  if (status === 'CRITICAL') {
    return Prisma.sql`"current_stock" = 0`;
  }
  if (status === 'LOW') {
    return Prisma.sql`"current_stock" > 0 AND "current_stock" <= "min_stock"`;
  }
  return Prisma.sql`"current_stock" > "min_stock"`;
}

function orderBy(query: ProductListQuery): Prisma.ProductOrderByWithRelationInput {
  return { [query.sortBy]: query.sortOrder };
}

export async function listProducts(query: ProductListQuery) {
  const where = toPrismaWhere(query);
  const skip = (query.page - 1) * query.pageSize;

  if (!query.stockStatus) {
    const [total, rows] = await prisma.$transaction([
      prisma.product.count({ where }),
      prisma.product.findMany({
        where,
        orderBy: orderBy(query),
        skip,
        take: query.pageSize,
        select: productSelect,
      }),
    ]);
    return { total, rows };
  }

  const filters: Prisma.Sql[] = [stockStatusSql(query.stockStatus)];
  if (query.category) {
    filters.push(Prisma.sql`"category" = ${query.category}`);
  }
  if (query.location) {
    filters.push(Prisma.sql`"location" ILIKE ${`%${query.location}%`}`);
  }
  if (query.search) {
    const term = `%${query.search}%`;
    filters.push(
      Prisma.sql`("name" ILIKE ${term} OR "sku" ILIKE ${term} OR "category" ILIKE ${term})`,
    );
  }
  const whereSql = Prisma.sql`WHERE ${Prisma.join(filters, ' AND ')}`;
  const sortMap: Record<ProductListQuery['sortBy'], Prisma.Sql> = {
    name: Prisma.sql`"name"`,
    sku: Prisma.sql`"sku"`,
    category: Prisma.sql`"category"`,
    currentStock: Prisma.sql`"current_stock"`,
    unitPrice: Prisma.sql`"unit_price"`,
    updatedAt: Prisma.sql`"updated_at"`,
    createdAt: Prisma.sql`"created_at"`,
  };
  const direction = query.sortOrder === 'asc' ? Prisma.sql`ASC` : Prisma.sql`DESC`;

  const countRows = await prisma.$queryRaw<Array<{ count: bigint }>>`
    SELECT COUNT(*)::bigint AS count FROM products ${whereSql}
  `;
  const idRows = await prisma.$queryRaw<Array<{ id: string }>>`
    SELECT id FROM products
    ${whereSql}
    ORDER BY ${sortMap[query.sortBy]} ${direction}
    LIMIT ${query.pageSize} OFFSET ${skip}
  `;
  const ids = idRows.map((row) => row.id);
  const rows =
    ids.length === 0
      ? []
      : await prisma.product.findMany({
          where: { id: { in: ids } },
          select: productSelect,
        });
  const byId = new Map(rows.map((row) => [row.id, row]));
  return {
    total: Number(countRows[0]?.count ?? 0),
    rows: ids.map((id) => byId.get(id)).filter((row): row is NonNullable<typeof row> => Boolean(row)),
  };
}

export async function inventorySummary(query: ProductListQuery) {
  const filters: Prisma.Sql[] = [Prisma.sql`TRUE`];
  if (query.category) {
    filters.push(Prisma.sql`"category" = ${query.category}`);
  }
  if (query.location) {
    filters.push(Prisma.sql`"location" ILIKE ${`%${query.location}%`}`);
  }
  if (query.search) {
    const term = `%${query.search}%`;
    filters.push(
      Prisma.sql`("name" ILIKE ${term} OR "sku" ILIKE ${term} OR "category" ILIKE ${term})`,
    );
  }
  const whereSql = Prisma.sql`WHERE ${Prisma.join(filters, ' AND ')}`;
  const [row] = await prisma.$queryRaw<
    Array<{ total: number; healthy: number; low: number; critical: number }>
  >`
    SELECT
      COUNT(*)::int AS total,
      COUNT(*) FILTER (WHERE "current_stock" > "min_stock")::int AS healthy,
      COUNT(*) FILTER (WHERE "current_stock" > 0 AND "current_stock" <= "min_stock")::int AS low,
      COUNT(*) FILTER (WHERE "current_stock" = 0)::int AS critical
    FROM products
    ${whereSql}
  `;

  return row ?? { total: 0, healthy: 0, low: 0, critical: 0 };
}

export async function listCategories(): Promise<string[]> {
  const rows = await prisma.product.groupBy({
    by: ['category'],
    orderBy: { category: 'asc' },
  });
  return rows.map((row) => row.category);
}

export async function findProductById(id: string) {
  return prisma.product.findUnique({
    where: { id },
    select: productSelect,
  });
}

export async function findProductBySku(sku: string, excludeId?: string) {
  return prisma.product.findFirst({
    where: excludeId ? { sku, NOT: { id: excludeId } } : { sku },
    select: { id: true, sku: true },
  });
}

export async function createProductWithOptionalOpening(data: ProductWriteInput, createdById: string) {
  return prisma.$transaction(async (tx) => {
    const product = await tx.product.create({
      data: {
        name: data.name,
        sku: data.sku,
        category: data.category,
        unitPrice: data.unitPrice,
        currentStock: data.currentStock,
        minStock: data.minStock,
        location: data.location,
      },
      select: productSelect,
    });

    if (data.currentStock > 0) {
      await tx.stockMovement.create({
        data: {
          productId: product.id,
          quantity: data.currentStock,
          movementType: 'IN',
          reason: 'Initial stock',
          createdById,
        },
      });
    }

    return product;
  });
}

export async function updateProduct(id: string, data: ProductPatchInput) {
  return prisma.product.update({
    where: { id },
    data,
    select: productSelect,
  });
}

export async function adjustStock(params: {
  productId: string;
  movementType: MovementType;
  quantity: number;
  reason: string;
  createdById: string;
}) {
  return prisma.$transaction(async (tx) => {
    // 1. LOCK PRODUCT ROW so concurrent OUT requests cannot both pass a stale read.
    const locked = await tx.$queryRaw<Array<{ id: string; current_stock: number | bigint | string }>>`
      SELECT id, "current_stock" FROM products WHERE id = ${params.productId} FOR UPDATE
    `;
    const row = locked[0];
    if (!row) {
      throw new AppError(404, ErrorCodes.NOT_FOUND, 'Product was not found.');
    }

    // Row lock serializes concurrent adjustments on this product. This is not a distributed lock.
    const previousStock = Number(row.current_stock);
    if (!Number.isFinite(previousStock)) {
      throw new AppError(500, ErrorCodes.INTERNAL_ERROR, 'Product stock could not be read.');
    }
    const nextStock =
      params.movementType === 'IN' ? previousStock + params.quantity : previousStock - params.quantity;

    // 2. VALIDATE STOCK RULES — OUT must never go negative.
    if (params.movementType === 'OUT' && nextStock < 0) {
      throw new AppError(
        409,
        ErrorCodes.INSUFFICIENT_STOCK,
        `Insufficient stock. Only ${previousStock} units are available.`,
      );
    }

    // 3. UPDATE STOCK + RECORD MOVEMENT in the same transaction.
    const product = await tx.product.update({
      where: { id: params.productId },
      data: { currentStock: nextStock },
      select: productSelect,
    });

    const movement = await tx.stockMovement.create({
      data: {
        productId: params.productId,
        quantity: params.quantity,
        movementType: params.movementType,
        reason: params.reason,
        createdById: params.createdById,
      },
      select: movementSelect,
    });

    return { product, movement, previousStock, nextStock };
  });
}

export async function listMovements(productId: string, query: MovementListQuery) {
  const where = {
    productId,
    ...(query.movementType ? { movementType: query.movementType } : {}),
  };
  const skip = (query.page - 1) * query.pageSize;
  const [total, rows] = await prisma.$transaction([
    prisma.stockMovement.count({ where }),
    prisma.stockMovement.findMany({
      where,
      orderBy: { createdAt: query.sortOrder },
      skip,
      take: query.pageSize,
      select: movementSelect,
    }),
  ]);
  return { total, rows };
}

export async function countMovements(productId: string): Promise<number> {
  return prisma.stockMovement.count({ where: { productId } });
}

export async function listRecentMovements(productId: string, take = 8) {
  return prisma.stockMovement.findMany({
    where: { productId },
    orderBy: { createdAt: 'desc' },
    take,
    select: movementSelect,
  });
}

export { productSelect };
