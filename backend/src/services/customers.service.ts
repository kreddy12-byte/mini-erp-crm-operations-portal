import { AppError, ErrorCodes } from '../utils/app-error';
import { toPaginationMeta } from '../utils/pagination';
import type {
  CreateFollowUpInput,
  CustomerListQuery,
  CustomerPatchInput,
  CustomerWriteInput,
} from '../types/customer';
import {
  createCustomer as persistCustomer,
  createFollowUp as persistFollowUp,
  customerExists,
  findCustomerById,
  listCustomers as queryCustomers,
  listFollowUps,
  updateCustomer as persistCustomerUpdate,
} from '../repositories/customers.repository';

function toListCustomer(row: Awaited<ReturnType<typeof queryCustomers>>['rows'][number]) {
  const latestFollowUp = row.followUps[0];
  return {
    id: row.id,
    name: row.name,
    mobile: row.mobile,
    email: row.email,
    businessName: row.businessName,
    gstNumber: row.gstNumber,
    customerType: row.customerType,
    address: row.address,
    status: row.status,
    followUpDate: row.followUpDate,
    notes: row.notes,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    latestFollowUpAt: latestFollowUp?.createdAt ?? null,
  };
}

function toFollowUp(row: Awaited<ReturnType<typeof listFollowUps>>[number]) {
  return {
    id: row.id,
    customerId: row.customerId,
    note: row.note,
    followUpDate: row.followUpDate,
    createdAt: row.createdAt,
    createdBy: {
      id: row.createdBy.id,
      name: row.createdBy.name,
      role: row.createdBy.role,
    },
  };
}

export async function listCustomers(query: CustomerListQuery) {
  const { total, rows } = await queryCustomers(query);
  return {
    customers: rows.map(toListCustomer),
    pagination: toPaginationMeta(query.page, query.pageSize, total),
  };
}

export async function getCustomer(id: string) {
  // 1. LOAD CUSTOMER
  const customer = await findCustomerById(id);
  if (!customer) {
    throw new AppError(404, ErrorCodes.NOT_FOUND, 'Customer was not found.');
  }

  // 2. RETURN CRM RECORD (follow-up history is part of the record, not a dump of relations)
  return {
    ...toListCustomer(customer),
    followUps: customer.followUps.map(toFollowUp),
  };
}

export async function createCustomer(input: CustomerWriteInput) {
  const customer = await persistCustomer(input);
  return toListCustomer(customer);
}

export async function updateCustomer(id: string, input: CustomerPatchInput) {
  // 1. LOAD CUSTOMER
  const existing = await customerExists(id);
  if (!existing) {
    throw new AppError(404, ErrorCodes.NOT_FOUND, 'Customer was not found.');
  }

  // 2. PERSIST PARTIAL UPDATE
  const customer = await persistCustomerUpdate(id, input);
  return toListCustomer(customer);
}

export async function getCustomerFollowUps(customerId: string) {
  if (!(await customerExists(customerId))) {
    throw new AppError(404, ErrorCodes.NOT_FOUND, 'Customer was not found.');
  }

  const rows = await listFollowUps(customerId);
  return { followUps: rows.map(toFollowUp) };
}

export async function createCustomerFollowUp(
  customerId: string,
  input: CreateFollowUpInput,
  createdById: string,
) {
  // 1. LOAD CUSTOMER
  const customer = await findCustomerById(customerId);
  if (!customer) {
    throw new AppError(404, ErrorCodes.NOT_FOUND, 'Customer was not found.');
  }

  // 2. APPLY CRM RULES
  // History rows require followUpDate in the existing schema. Use the supplied
  // next date, otherwise the customer's current date, otherwise now — without
  // inventing a schema change.
  const followUpDate = input.followUpDate ?? customer.followUpDate ?? new Date();

  // 3. PERSIST HISTORY (createdBy always comes from the authenticated user)
  const followUp = await persistFollowUp({
    customerId,
    note: input.note,
    followUpDate,
    createdById,
    nextCustomerFollowUpDate: input.followUpDate,
  });

  return toFollowUp(followUp);
}
