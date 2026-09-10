import { Prisma } from '@prisma/client';
import type { Product } from '@prisma/client';
import {
  createProductWithOptionalOpening,
  findProductById,
  findProductBySku,
  inventorySummary as queryInventorySummary,
  listCategories,
  listProducts as queryProducts,
  listRecentMovements,
  updateProduct as persistProductUpdate,
} from '../repositories/products.repository';
import type { ProductListQuery, ProductPatchInput, ProductWriteInput } from '../types/product';
import { AppError, ErrorCodes } from '../utils/app-error';
import { toPaginationMeta } from '../utils/pagination';
import { resolveStockStatus } from './stock-status';

function money(value: { toFixed?: (digits: number) => string } | string | number): string {
  if (typeof value === 'string') {
    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) ? parsed.toFixed(2) : value;
  }
  if (typeof value === 'number') {
    return value.toFixed(2);
  }
  return value.toFixed?.(2) ?? String(value);
}

function toProduct(row: {
  id: string;
  name: string;
  sku: string;
  category: string;
  unitPrice: Product['unitPrice'] | string | number;
  currentStock: number;
  minStock: number;
  location: string;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: row.id,
    name: row.name,
    sku: row.sku,
    category: row.category,
    unitPrice: money(row.unitPrice),
    currentStock: row.currentStock,
    minStock: row.minStock,
    location: row.location,
    stockStatus: resolveStockStatus(row.currentStock, row.minStock),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function duplicateSkuError(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
}

export async function listProducts(query: ProductListQuery) {
  const [{ total, rows }, categories] = await Promise.all([queryProducts(query), listCategories()]);
  return {
    products: rows.map(toProduct),
    pagination: toPaginationMeta(query.page, query.pageSize, total),
    categories,
  };
}

export async function listInventory(query: ProductListQuery) {
  const [{ total, rows }, categories, summary] = await Promise.all([
    queryProducts(query),
    listCategories(),
    queryInventorySummary(query),
  ]);
  return {
    products: rows.map(toProduct),
    pagination: toPaginationMeta(query.page, query.pageSize, total),
    categories,
    summary,
  };
}

export async function getProduct(id: string) {
  const product = await findProductById(id);
  if (!product) {
    throw new AppError(404, ErrorCodes.NOT_FOUND, 'Product was not found.');
  }
  const recentMovements = await listRecentMovements(id);
  return {
    ...toProduct(product),
    recentMovements: recentMovements.map((row) => ({
      id: row.id,
      productId: row.productId,
      quantity: row.quantity,
      movementType: row.movementType,
      reason: row.reason,
      createdAt: row.createdAt,
      createdBy: row.createdBy,
    })),
  };
}

export async function createProduct(input: ProductWriteInput, createdById: string) {
  const existing = await findProductBySku(input.sku);
  if (existing) {
    throw new AppError(409, ErrorCodes.DUPLICATE_SKU, 'A product with this SKU already exists.');
  }

  try {
    const product = await createProductWithOptionalOpening(input, createdById);
    return toProduct(product);
  } catch (error) {
    if (duplicateSkuError(error)) {
      throw new AppError(409, ErrorCodes.DUPLICATE_SKU, 'A product with this SKU already exists.');
    }
    throw error;
  }
}

export async function updateProduct(id: string, input: ProductPatchInput) {
  const existing = await findProductById(id);
  if (!existing) {
    throw new AppError(404, ErrorCodes.NOT_FOUND, 'Product was not found.');
  }
  if (input.sku && input.sku !== existing.sku) {
    const clash = await findProductBySku(input.sku, id);
    if (clash) {
      throw new AppError(409, ErrorCodes.DUPLICATE_SKU, 'A product with this SKU already exists.');
    }
  }

  try {
    const product = await persistProductUpdate(id, input);
    return toProduct(product);
  } catch (error) {
    if (duplicateSkuError(error)) {
      throw new AppError(409, ErrorCodes.DUPLICATE_SKU, 'A product with this SKU already exists.');
    }
    throw error;
  }
}

export { toProduct };
