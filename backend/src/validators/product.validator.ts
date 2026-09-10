import type { MovementType } from '@prisma/client';
import type {
  MovementListQuery,
  ProductListQuery,
  ProductPatchInput,
  ProductSortField,
  ProductWriteInput,
  SortOrder,
  StockMovementInput,
  StockStatus,
} from '../types/product';
import { AppError, ErrorCodes } from '../utils/app-error';

const SORT_FIELDS = new Set<ProductSortField>([
  'name',
  'sku',
  'category',
  'currentStock',
  'unitPrice',
  'updatedAt',
  'createdAt',
]);
const STOCK_STATUSES = new Set<StockStatus>(['HEALTHY', 'LOW', 'CRITICAL']);
const MOVEMENT_TYPES = new Set<MovementType>(['IN', 'OUT']);

const MAX_NAME = 160;
const MAX_SKU = 40;
const MAX_CATEGORY = 80;
const MAX_LOCATION = 120;
const MAX_REASON = 500;
const MAX_SEARCH = 120;
const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;
const MAX_STOCK = 1_000_000;
const MAX_PRICE = 99_999_999.99;

type RequestQuery = Record<string, unknown>;

function asRecord(body: unknown, message: string): Record<string, unknown> {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw new AppError(400, ErrorCodes.VALIDATION_ERROR, message);
  }
  return body as Record<string, unknown>;
}

function firstQueryValue(value: unknown): string | undefined {
  if (Array.isArray(value)) {
    return typeof value[0] === 'string' ? value[0] : undefined;
  }
  return typeof value === 'string' ? value : undefined;
}

function parsePositiveInt(value: unknown, fallback: number, field: string): number {
  const raw = firstQueryValue(value);
  if (raw === undefined || raw === '') {
    return fallback;
  }
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isInteger(parsed) || parsed < 1) {
    throw new AppError(400, ErrorCodes.VALIDATION_ERROR, `${field} must be a positive integer.`);
  }
  return parsed;
}

function requiredString(value: unknown, field: string, max: number): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new AppError(400, ErrorCodes.VALIDATION_ERROR, `${field} is required.`);
  }
  const parsed = value.trim();
  if (parsed.length > max) {
    throw new AppError(400, ErrorCodes.VALIDATION_ERROR, `${field} is too long.`);
  }
  return parsed;
}

function parseNonNegativeInt(value: unknown, field: string, required: boolean): number | undefined {
  if (value === undefined || value === null || value === '') {
    if (required) {
      throw new AppError(400, ErrorCodes.VALIDATION_ERROR, `${field} is required.`);
    }
    return undefined;
  }
  const parsed = typeof value === 'number' ? value : Number.parseInt(String(value), 10);
  if (!Number.isInteger(parsed) || parsed < 0 || parsed > MAX_STOCK) {
    throw new AppError(400, ErrorCodes.VALIDATION_ERROR, `${field} must be a whole number of 0 or more.`);
  }
  return parsed;
}

function parsePositiveQuantity(value: unknown): number {
  const parsed = typeof value === 'number' ? value : Number.parseInt(String(value), 10);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > MAX_STOCK) {
    throw new AppError(400, ErrorCodes.VALIDATION_ERROR, 'Quantity must be a positive whole number.');
  }
  return parsed;
}

function parseUnitPrice(value: unknown, required: boolean): string | undefined {
  if (value === undefined || value === null || value === '') {
    if (required) {
      throw new AppError(400, ErrorCodes.VALIDATION_ERROR, 'Unit price is required.');
    }
    return undefined;
  }
  const parsed = typeof value === 'number' ? value : Number.parseFloat(String(value));
  if (!Number.isFinite(parsed) || parsed < 0 || parsed > MAX_PRICE) {
    throw new AppError(400, ErrorCodes.VALIDATION_ERROR, 'Unit price must be 0 or more.');
  }
  return parsed.toFixed(2);
}

export function parseProductId(value: unknown): string {
  const raw = Array.isArray(value) ? value[0] : value;
  const id = typeof raw === 'string' ? raw.trim() : '';
  if (!id) {
    throw new AppError(400, ErrorCodes.VALIDATION_ERROR, 'Product id is required.');
  }
  return id;
}

export function parseProductListQuery(query: RequestQuery): ProductListQuery {
  const page = parsePositiveInt(query.page, 1, 'page');
  const pageSize = parsePositiveInt(query.pageSize, DEFAULT_PAGE_SIZE, 'pageSize');
  if (pageSize > MAX_PAGE_SIZE) {
    throw new AppError(400, ErrorCodes.VALIDATION_ERROR, `pageSize cannot exceed ${MAX_PAGE_SIZE}.`);
  }

  const search = firstQueryValue(query.search)?.trim();
  if (search && search.length > MAX_SEARCH) {
    throw new AppError(400, ErrorCodes.VALIDATION_ERROR, 'Search is too long.');
  }

  const stockStatusValue = firstQueryValue(query.stockStatus);
  let stockStatus: StockStatus | undefined;
  if (stockStatusValue) {
    if (!STOCK_STATUSES.has(stockStatusValue as StockStatus)) {
      throw new AppError(400, ErrorCodes.VALIDATION_ERROR, 'stockStatus is invalid.');
    }
    stockStatus = stockStatusValue as StockStatus;
  }

  const sortByValue = firstQueryValue(query.sortBy) ?? 'updatedAt';
  if (!SORT_FIELDS.has(sortByValue as ProductSortField)) {
    throw new AppError(400, ErrorCodes.VALIDATION_ERROR, 'sortBy is invalid.');
  }
  const sortOrderValue = (firstQueryValue(query.sortOrder) ?? 'desc').toLowerCase();
  if (sortOrderValue !== 'asc' && sortOrderValue !== 'desc') {
    throw new AppError(400, ErrorCodes.VALIDATION_ERROR, 'sortOrder must be asc or desc.');
  }

  return {
    page,
    pageSize,
    search: search || undefined,
    category: firstQueryValue(query.category)?.trim() || undefined,
    location: firstQueryValue(query.location)?.trim() || undefined,
    stockStatus,
    sortBy: sortByValue as ProductSortField,
    sortOrder: sortOrderValue as SortOrder,
  };
}

export function parseCreateProductBody(body: unknown): ProductWriteInput {
  const record = asRecord(body, 'Product details are required.');
  return {
    name: requiredString(record.name, 'Name', MAX_NAME),
    sku: requiredString(record.sku, 'SKU', MAX_SKU),
    category: requiredString(record.category, 'Category', MAX_CATEGORY),
    unitPrice: parseUnitPrice(record.unitPrice, true) as string,
    currentStock: parseNonNegativeInt(record.currentStock, 'Current stock', true) as number,
    minStock: parseNonNegativeInt(record.minStock, 'Minimum stock', true) as number,
    location: requiredString(record.location, 'Location', MAX_LOCATION),
  };
}

export function parseUpdateProductBody(body: unknown): ProductPatchInput {
  const record = asRecord(body, 'Product details are required.');
  if (record.currentStock !== undefined) {
    throw new AppError(
      400,
      ErrorCodes.VALIDATION_ERROR,
      'Current stock cannot be edited directly. Record an inventory movement instead.',
    );
  }

  const patch: ProductPatchInput = {};
  if (record.name !== undefined) patch.name = requiredString(record.name, 'Name', MAX_NAME);
  if (record.sku !== undefined) patch.sku = requiredString(record.sku, 'SKU', MAX_SKU);
  if (record.category !== undefined) patch.category = requiredString(record.category, 'Category', MAX_CATEGORY);
  if (record.unitPrice !== undefined) patch.unitPrice = parseUnitPrice(record.unitPrice, true);
  if (record.minStock !== undefined) patch.minStock = parseNonNegativeInt(record.minStock, 'Minimum stock', true);
  if (record.location !== undefined) patch.location = requiredString(record.location, 'Location', MAX_LOCATION);

  if (Object.keys(patch).length === 0) {
    throw new AppError(400, ErrorCodes.VALIDATION_ERROR, 'Provide at least one field to update.');
  }
  return patch;
}

export function parseStockMovementBody(body: unknown): StockMovementInput {
  const record = asRecord(body, 'Movement details are required.');
  const movementType = record.movementType;
  if (typeof movementType !== 'string' || !MOVEMENT_TYPES.has(movementType as MovementType)) {
    throw new AppError(400, ErrorCodes.VALIDATION_ERROR, 'Movement type must be IN or OUT.');
  }

  return {
    movementType: movementType as MovementType,
    quantity: parsePositiveQuantity(record.quantity),
    reason: requiredString(record.reason, 'Reason', MAX_REASON),
  };
}

export function parseMovementListQuery(query: RequestQuery): MovementListQuery {
  const page = parsePositiveInt(query.page, 1, 'page');
  const pageSize = parsePositiveInt(query.pageSize, DEFAULT_PAGE_SIZE, 'pageSize');
  if (pageSize > MAX_PAGE_SIZE) {
    throw new AppError(400, ErrorCodes.VALIDATION_ERROR, `pageSize cannot exceed ${MAX_PAGE_SIZE}.`);
  }

  const movementTypeValue = firstQueryValue(query.movementType);
  let movementType: MovementType | undefined;
  if (movementTypeValue) {
    if (!MOVEMENT_TYPES.has(movementTypeValue as MovementType)) {
      throw new AppError(400, ErrorCodes.VALIDATION_ERROR, 'movementType must be IN or OUT.');
    }
    movementType = movementTypeValue as MovementType;
  }

  const sortOrderValue = (firstQueryValue(query.sortOrder) ?? 'desc').toLowerCase();
  if (sortOrderValue !== 'asc' && sortOrderValue !== 'desc') {
    throw new AppError(400, ErrorCodes.VALIDATION_ERROR, 'sortOrder must be asc or desc.');
  }

  return {
    page,
    pageSize,
    movementType,
    sortOrder: sortOrderValue as SortOrder,
  };
}
