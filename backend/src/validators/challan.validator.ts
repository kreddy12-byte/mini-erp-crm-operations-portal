import type { ChallanStatus } from '@prisma/client';
import type {
  ChallanLineInput,
  ChallanListQuery,
  ChallanPatchInput,
  ChallanSortField,
  ChallanWriteInput,
  SortOrder,
} from '../types/challan';
import { AppError, ErrorCodes } from '../utils/app-error';

const STATUSES = new Set<ChallanStatus>(['DRAFT', 'CONFIRMED', 'CANCELLED']);
const SORT_FIELDS = new Set<ChallanSortField>([
  'createdAt',
  'updatedAt',
  'challanNumber',
  'totalQuantity',
  'status',
]);

const MAX_SEARCH = 120;
const MAX_ITEMS = 50;
const MAX_QUANTITY = 1_000_000;
const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;

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

function requiredId(value: unknown, field: string): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new AppError(400, ErrorCodes.VALIDATION_ERROR, `${field} is required.`);
  }
  return value.trim();
}

function parseQuantity(value: unknown, index: number): number {
  if (value === undefined || value === null || value === '') {
    throw new AppError(400, ErrorCodes.VALIDATION_ERROR, `items[${index}].quantity is required.`);
  }
  const parsed = typeof value === 'number' ? value : Number.parseInt(String(value), 10);
  if (!Number.isInteger(parsed)) {
    throw new AppError(400, ErrorCodes.VALIDATION_ERROR, `items[${index}].quantity must be a whole number.`);
  }
  if (parsed === 0) {
    throw new AppError(400, ErrorCodes.VALIDATION_ERROR, 'Quantity must be greater than zero.');
  }
  if (parsed < 0) {
    throw new AppError(400, ErrorCodes.VALIDATION_ERROR, 'Quantity must be greater than zero.');
  }
  if (parsed > MAX_QUANTITY) {
    throw new AppError(400, ErrorCodes.VALIDATION_ERROR, `items[${index}].quantity is too large.`);
  }
  return parsed;
}

function parseItems(value: unknown): ChallanLineInput[] {
  if (value === undefined || value === null) {
    throw new AppError(400, ErrorCodes.VALIDATION_ERROR, 'At least one product line is required.');
  }
  if (!Array.isArray(value)) {
    throw new AppError(400, ErrorCodes.VALIDATION_ERROR, 'items must be an array.');
  }
  if (value.length === 0) {
    throw new AppError(400, ErrorCodes.VALIDATION_ERROR, 'At least one product line is required.');
  }
  if (value.length > MAX_ITEMS) {
    throw new AppError(400, ErrorCodes.VALIDATION_ERROR, `A challan cannot contain more than ${MAX_ITEMS} product lines.`);
  }

  const seen = new Set<string>();
  return value.map((entry, index) => {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
      throw new AppError(400, ErrorCodes.VALIDATION_ERROR, `items[${index}] must be an object.`);
    }
    const record = entry as Record<string, unknown>;
    const productId = requiredId(record.productId, `items[${index}].productId`);
    if (seen.has(productId)) {
      throw new AppError(
        400,
        ErrorCodes.VALIDATION_ERROR,
        'Duplicate product lines are not allowed. Combine quantities onto one line per product.',
      );
    }
    seen.add(productId);
    return {
      productId,
      quantity: parseQuantity(record.quantity, index),
    };
  });
}

export function parseChallanId(value: unknown): string {
  const raw = Array.isArray(value) ? value[0] : value;
  const id = typeof raw === 'string' ? raw.trim() : '';
  if (!id) {
    throw new AppError(400, ErrorCodes.VALIDATION_ERROR, 'Challan id is required.');
  }
  return id;
}

export function parseChallanListQuery(query: RequestQuery): ChallanListQuery {
  const page = parsePositiveInt(query.page, 1, 'page');
  const pageSize = parsePositiveInt(query.pageSize, DEFAULT_PAGE_SIZE, 'pageSize');
  if (pageSize > MAX_PAGE_SIZE) {
    throw new AppError(400, ErrorCodes.VALIDATION_ERROR, `pageSize cannot exceed ${MAX_PAGE_SIZE}.`);
  }

  const search = firstQueryValue(query.search)?.trim();
  if (search && search.length > MAX_SEARCH) {
    throw new AppError(400, ErrorCodes.VALIDATION_ERROR, 'Search is too long.');
  }

  const statusValue = firstQueryValue(query.status);
  let status: ChallanStatus | undefined;
  if (statusValue) {
    if (!STATUSES.has(statusValue as ChallanStatus)) {
      throw new AppError(400, ErrorCodes.VALIDATION_ERROR, 'status is invalid.');
    }
    status = statusValue as ChallanStatus;
  }

  const sortByValue = firstQueryValue(query.sortBy) ?? 'createdAt';
  if (!SORT_FIELDS.has(sortByValue as ChallanSortField)) {
    throw new AppError(400, ErrorCodes.VALIDATION_ERROR, 'sortBy is invalid.');
  }
  const sortOrderValue = (firstQueryValue(query.sortOrder) ?? 'desc').toLowerCase();
  if (sortOrderValue !== 'asc' && sortOrderValue !== 'desc') {
    throw new AppError(400, ErrorCodes.VALIDATION_ERROR, 'sortOrder must be asc or desc.');
  }

  const customerId = firstQueryValue(query.customerId)?.trim();

  return {
    page,
    pageSize,
    search: search || undefined,
    status,
    customerId: customerId || undefined,
    sortBy: sortByValue as ChallanSortField,
    sortOrder: sortOrderValue as SortOrder,
  };
}

export function parseCreateChallanBody(body: unknown): ChallanWriteInput {
  const record = asRecord(body, 'Challan details are required.');
  return {
    customerId: requiredId(record.customerId, 'customerId'),
    items: parseItems(record.items),
  };
}

export function parseUpdateChallanBody(body: unknown): ChallanPatchInput {
  const record = asRecord(body, 'Challan details are required.');
  const patch: ChallanPatchInput = {};

  if (record.customerId !== undefined) {
    patch.customerId = requiredId(record.customerId, 'customerId');
  }
  if (record.items !== undefined) {
    patch.items = parseItems(record.items);
  }

  if (!patch.customerId && !patch.items) {
    throw new AppError(400, ErrorCodes.VALIDATION_ERROR, 'Provide a customer or product lines to update.');
  }

  return patch;
}
