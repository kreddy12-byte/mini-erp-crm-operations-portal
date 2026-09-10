import type { CustomerStatus, CustomerType } from '@prisma/client';
import type {
  CreateFollowUpInput,
  CustomerListQuery,
  CustomerPatchInput,
  CustomerSortField,
  CustomerWriteInput,
  FollowUpFilter,
  SortOrder,
} from '../types/customer';
import { AppError, ErrorCodes } from '../utils/app-error';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const CUSTOMER_TYPES = new Set<CustomerType>(['RETAIL', 'WHOLESALE', 'DISTRIBUTOR']);
const CUSTOMER_STATUSES = new Set<CustomerStatus>(['LEAD', 'ACTIVE', 'INACTIVE']);
const SORT_FIELDS = new Set<CustomerSortField>([
  'createdAt',
  'updatedAt',
  'name',
  'businessName',
  'followUpDate',
]);
const FOLLOW_UP_FILTERS = new Set<FollowUpFilter>(['overdue', 'dueToday', 'upcoming', 'none']);

const MAX_NAME = 120;
const MAX_BUSINESS_NAME = 160;
const MAX_EMAIL = 254;
const MAX_GST = 20;
const MAX_ADDRESS = 2000;
const MAX_NOTES = 4000;
const MAX_FOLLOW_UP_NOTE = 4000;
const MAX_SEARCH = 120;
const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;

function asRecord(body: unknown, message: string): Record<string, unknown> {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw new AppError(400, ErrorCodes.VALIDATION_ERROR, message);
  }
  return body as Record<string, unknown>;
}

function readString(value: unknown): string | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (typeof value !== 'string') {
    throw new AppError(400, ErrorCodes.VALIDATION_ERROR, 'Expected a text value.');
  }
  return value.trim();
}

function requiredString(value: unknown, field: string, max: number): string {
  const parsed = readString(value);
  if (!parsed) {
    throw new AppError(400, ErrorCodes.VALIDATION_ERROR, `${field} is required.`);
  }
  if (parsed.length > max) {
    throw new AppError(400, ErrorCodes.VALIDATION_ERROR, `${field} is too long.`);
  }
  return parsed;
}

function optionalText(value: unknown, field: string, max: number): string | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }
  const parsed = readString(value);
  if (parsed === undefined) {
    return undefined;
  }
  if (parsed.length === 0) {
    return undefined;
  }
  if (parsed.length > max) {
    throw new AppError(400, ErrorCodes.VALIDATION_ERROR, `${field} is too long.`);
  }
  return parsed;
}

function parseEmail(value: unknown, required: boolean): string | undefined {
  const email = required ? requiredString(value, 'Email', MAX_EMAIL) : optionalText(value, 'Email', MAX_EMAIL);
  if (!email) {
    return undefined;
  }
  const normalized = email.toLowerCase();
  if (!EMAIL_PATTERN.test(normalized)) {
    throw new AppError(400, ErrorCodes.VALIDATION_ERROR, 'A valid email address is required.');
  }
  return normalized;
}

function parseMobile(value: unknown, required: boolean): string | undefined {
  const raw = required ? requiredString(value, 'Mobile', 20) : optionalText(value, 'Mobile', 20);
  if (!raw) {
    return undefined;
  }
  const mobile = raw.replace(/[\s-]/g, '');
  if (!/^\+?[0-9]{8,15}$/.test(mobile)) {
    throw new AppError(400, ErrorCodes.VALIDATION_ERROR, 'Enter a valid mobile number.');
  }
  return mobile;
}

function parseCustomerType(value: unknown, required: boolean): CustomerType | undefined {
  if (value === undefined || value === null || value === '') {
    if (required) {
      throw new AppError(400, ErrorCodes.VALIDATION_ERROR, 'Customer type is required.');
    }
    return undefined;
  }
  if (typeof value !== 'string' || !CUSTOMER_TYPES.has(value as CustomerType)) {
    throw new AppError(400, ErrorCodes.VALIDATION_ERROR, 'Customer type is invalid.');
  }
  return value as CustomerType;
}

function parseCustomerStatus(value: unknown, required: boolean): CustomerStatus | undefined {
  if (value === undefined || value === null || value === '') {
    if (required) {
      throw new AppError(400, ErrorCodes.VALIDATION_ERROR, 'Status is required.');
    }
    return undefined;
  }
  if (typeof value !== 'string' || !CUSTOMER_STATUSES.has(value as CustomerStatus)) {
    throw new AppError(400, ErrorCodes.VALIDATION_ERROR, 'Status is invalid.');
  }
  return value as CustomerStatus;
}

function parseDate(value: unknown, field: string): Date | undefined {
  if (value === undefined || value === null || value === '') {
    return undefined;
  }
  if (typeof value !== 'string') {
    throw new AppError(400, ErrorCodes.VALIDATION_ERROR, `${field} must be a date.`);
  }
  const iso = /^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T00:00:00.000Z` : value;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    throw new AppError(400, ErrorCodes.VALIDATION_ERROR, `${field} must be a valid date.`);
  }
  return date;
}

function parseClearableDate(value: unknown, field: string): Date | null | undefined {
  if (value === null) {
    return null;
  }
  return parseDate(value, field);
}

function parseClearableText(value: unknown, field: string, max: number): string | null | undefined {
  if (value === null) {
    return null;
  }
  const parsed = optionalText(value, field, max);
  if (value === undefined) {
    return undefined;
  }
  return parsed ?? null;
}

export function parseCustomerId(value: unknown): string {
  const raw = Array.isArray(value) ? value[0] : value;
  const id = typeof raw === 'string' ? raw.trim() : '';
  if (!id) {
    throw new AppError(400, ErrorCodes.VALIDATION_ERROR, 'Customer id is required.');
  }
  return id;
}

export function parseCustomerListQuery(query: RequestQuery): CustomerListQuery {
  const page = parsePositiveInt(query.page, 1, 'page');
  const pageSize = parsePositiveInt(query.pageSize, DEFAULT_PAGE_SIZE, 'pageSize');
  if (pageSize > MAX_PAGE_SIZE) {
    throw new AppError(400, ErrorCodes.VALIDATION_ERROR, `pageSize cannot exceed ${MAX_PAGE_SIZE}.`);
  }

  const search = optionalText(firstQueryValue(query.search), 'Search', MAX_SEARCH);
  const status = parseCustomerStatus(firstQueryValue(query.status), false);
  const customerType = parseCustomerType(firstQueryValue(query.customerType), false);
  const followUpValue = firstQueryValue(query.followUp);
  let followUp: FollowUpFilter | undefined;
  if (followUpValue) {
    if (!FOLLOW_UP_FILTERS.has(followUpValue as FollowUpFilter)) {
      throw new AppError(400, ErrorCodes.VALIDATION_ERROR, 'Follow-up filter is invalid.');
    }
    followUp = followUpValue as FollowUpFilter;
  }

  const sortByValue = firstQueryValue(query.sortBy) ?? 'updatedAt';
  if (!SORT_FIELDS.has(sortByValue as CustomerSortField)) {
    throw new AppError(400, ErrorCodes.VALIDATION_ERROR, 'sortBy is invalid.');
  }
  const sortOrderValue = (firstQueryValue(query.sortOrder) ?? 'desc').toLowerCase();
  if (sortOrderValue !== 'asc' && sortOrderValue !== 'desc') {
    throw new AppError(400, ErrorCodes.VALIDATION_ERROR, 'sortOrder must be asc or desc.');
  }

  return {
    page,
    pageSize,
    search,
    status,
    customerType,
    followUp,
    sortBy: sortByValue as CustomerSortField,
    sortOrder: sortOrderValue as SortOrder,
  };
}

export function parseCreateCustomerBody(body: unknown): CustomerWriteInput {
  const record = asRecord(body, 'Customer details are required.');
  const name = requiredString(record.name, 'Name', MAX_NAME);
  const mobile = parseMobile(record.mobile, true);
  const customerType = parseCustomerType(record.customerType, true);
  const status = parseCustomerStatus(record.status, true);
  if (!mobile || !customerType || !status) {
    throw new AppError(400, ErrorCodes.VALIDATION_ERROR, 'Name, mobile, customer type, and status are required.');
  }

  // businessName and address are NOT NULL in the existing schema. Empty string
  // keeps the API optional without a destructive migration.
  return {
    name,
    mobile,
    email: parseEmail(record.email, false),
    businessName: optionalText(record.businessName, 'Business name', MAX_BUSINESS_NAME) ?? '',
    gstNumber: optionalText(record.gstNumber, 'GST number', MAX_GST)?.toUpperCase(),
    customerType,
    address: optionalText(record.address, 'Address', MAX_ADDRESS) ?? '',
    status,
    followUpDate: parseDate(record.followUpDate, 'Follow-up date'),
    notes: optionalText(record.notes, 'Notes', MAX_NOTES),
  };
}

export function parseUpdateCustomerBody(body: unknown): CustomerPatchInput {
  const record = asRecord(body, 'Customer details are required.');
  const patch: CustomerPatchInput = {};

  if (record.name !== undefined) {
    patch.name = requiredString(record.name, 'Name', MAX_NAME);
  }
  if (record.mobile !== undefined) {
    patch.mobile = parseMobile(record.mobile, true);
  }
  if (record.email !== undefined) {
    patch.email = parseClearableText(record.email, 'Email', MAX_EMAIL);
    if (typeof patch.email === 'string') {
      patch.email = parseEmail(patch.email, true);
    }
  }
  if (record.businessName !== undefined) {
    patch.businessName = optionalText(record.businessName, 'Business name', MAX_BUSINESS_NAME) ?? '';
  }
  if (record.gstNumber !== undefined) {
    const gst = parseClearableText(record.gstNumber, 'GST number', MAX_GST);
    patch.gstNumber = typeof gst === 'string' ? gst.toUpperCase() : gst;
  }
  if (record.customerType !== undefined) {
    patch.customerType = parseCustomerType(record.customerType, true);
  }
  if (record.address !== undefined) {
    patch.address = optionalText(record.address, 'Address', MAX_ADDRESS) ?? '';
  }
  if (record.status !== undefined) {
    patch.status = parseCustomerStatus(record.status, true);
  }
  if (record.followUpDate !== undefined) {
    patch.followUpDate = parseClearableDate(record.followUpDate, 'Follow-up date');
  }
  if (record.notes !== undefined) {
    patch.notes = parseClearableText(record.notes, 'Notes', MAX_NOTES);
  }

  if (Object.keys(patch).length === 0) {
    throw new AppError(400, ErrorCodes.VALIDATION_ERROR, 'Provide at least one field to update.');
  }

  return patch;
}

export function parseCreateFollowUpBody(body: unknown): CreateFollowUpInput {
  const record = asRecord(body, 'Follow-up details are required.');
  return {
    note: requiredString(record.note, 'Note', MAX_FOLLOW_UP_NOTE),
    followUpDate: parseDate(record.followUpDate, 'Follow-up date'),
  };
}

type RequestQuery = Record<string, unknown>;

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
