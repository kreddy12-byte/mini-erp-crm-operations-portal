import type { Prisma } from '@prisma/client';
import { prisma } from '../config/database';
import type {
  CustomerListQuery,
  CustomerPatchInput,
  CustomerWriteInput,
} from '../types/customer';

const customerListSelect = {
  id: true,
  name: true,
  mobile: true,
  email: true,
  businessName: true,
  gstNumber: true,
  customerType: true,
  address: true,
  status: true,
  followUpDate: true,
  notes: true,
  createdAt: true,
  updatedAt: true,
  followUps: {
    orderBy: { createdAt: 'desc' as const },
    take: 1,
    select: {
      id: true,
      createdAt: true,
    },
  },
} satisfies Prisma.CustomerSelect;

const followUpSelect = {
  id: true,
  customerId: true,
  note: true,
  followUpDate: true,
  createdAt: true,
  createdBy: {
    select: {
      id: true,
      name: true,
      role: true,
    },
  },
} satisfies Prisma.CustomerFollowUpSelect;

function utcDayBounds(now = new Date()): { start: Date; end: Date } {
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 1);
  return { start, end };
}

function toWhere(query: CustomerListQuery): Prisma.CustomerWhereInput {
  const where: Prisma.CustomerWhereInput = {};

  if (query.status) {
    where.status = query.status;
  }
  if (query.customerType) {
    where.customerType = query.customerType;
  }
  if (query.search) {
    where.OR = [
      { name: { contains: query.search, mode: 'insensitive' } },
      { mobile: { contains: query.search, mode: 'insensitive' } },
      { email: { contains: query.search, mode: 'insensitive' } },
      { businessName: { contains: query.search, mode: 'insensitive' } },
    ];
  }
  if (query.followUp) {
    const { start, end } = utcDayBounds();
    if (query.followUp === 'none') {
      where.followUpDate = null;
    } else if (query.followUp === 'overdue') {
      where.followUpDate = { lt: start };
    } else if (query.followUp === 'dueToday') {
      where.followUpDate = { gte: start, lt: end };
    } else {
      where.followUpDate = { gte: end };
    }
  }

  return where;
}

function toOrderBy(query: CustomerListQuery): Prisma.CustomerOrderByWithRelationInput {
  if (query.sortBy === 'followUpDate') {
    return { followUpDate: { sort: query.sortOrder, nulls: 'last' } };
  }
  return { [query.sortBy]: query.sortOrder };
}

export async function listCustomers(query: CustomerListQuery) {
  const where = toWhere(query);
  const skip = (query.page - 1) * query.pageSize;

  const [total, rows] = await prisma.$transaction([
    prisma.customer.count({ where }),
    prisma.customer.findMany({
      where,
      orderBy: toOrderBy(query),
      skip,
      take: query.pageSize,
      select: customerListSelect,
    }),
  ]);

  return { total, rows };
}

export async function findCustomerById(id: string) {
  return prisma.customer.findUnique({
    where: { id },
    select: {
      ...customerListSelect,
      followUps: {
        orderBy: { createdAt: 'desc' },
        take: 50,
        select: followUpSelect,
      },
    },
  });
}

export async function createCustomer(data: CustomerWriteInput) {
  return prisma.customer.create({
    data,
    select: customerListSelect,
  });
}

export async function updateCustomer(id: string, data: CustomerPatchInput) {
  return prisma.customer.update({
    where: { id },
    data,
    select: customerListSelect,
  });
}

export async function listFollowUps(customerId: string) {
  return prisma.customerFollowUp.findMany({
    where: { customerId },
    orderBy: { createdAt: 'desc' },
    take: 100,
    select: followUpSelect,
  });
}

export async function createFollowUp(data: {
  customerId: string;
  note: string;
  followUpDate: Date;
  createdById: string;
  nextCustomerFollowUpDate?: Date;
}) {
  const { nextCustomerFollowUpDate, ...followUpData } = data;

  return prisma.$transaction(async (tx) => {
    const followUp = await tx.customerFollowUp.create({
      data: followUpData,
      select: followUpSelect,
    });

    // Keep the customer "next follow-up" in sync when the caller supplies a date.
    if (nextCustomerFollowUpDate) {
      await tx.customer.update({
        where: { id: data.customerId },
        data: { followUpDate: nextCustomerFollowUpDate },
      });
    }

    return followUp;
  });
}

export async function customerExists(id: string): Promise<boolean> {
  const row = await prisma.customer.findUnique({
    where: { id },
    select: { id: true },
  });
  return Boolean(row);
}
