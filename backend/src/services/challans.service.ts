import type { ChallanPatchInput, ChallanWriteInput, ChallanListQuery } from '../types/challan';
import {
  cancelDraftChallan,
  confirmChallan as persistConfirm,
  createDraftChallan,
  findChallanById,
  listChallans as queryChallans,
  updateDraftChallan,
} from '../repositories/challans.repository';
import { AppError, ErrorCodes } from '../utils/app-error';
import { toPaginationMeta } from '../utils/pagination';

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

function toChallan(row: NonNullable<Awaited<ReturnType<typeof findChallanById>>>) {
  return {
    id: row.id,
    challanNumber: row.challanNumber,
    status: row.status,
    totalQuantity: row.totalQuantity,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    customer: row.customer,
    createdBy: row.createdBy,
    items: row.items.map((item) => ({
      id: item.id,
      productId: item.productId,
      quantity: item.quantity,
      productNameSnapshot: item.productNameSnapshot,
      skuSnapshot: item.skuSnapshot,
      unitPriceSnapshot: money(item.unitPriceSnapshot),
      createdAt: item.createdAt,
    })),
  };
}

export async function listChallans(query: ChallanListQuery) {
  const { total, rows } = await queryChallans(query);
  return {
    challans: rows.map(toChallan),
    pagination: toPaginationMeta(query.page, query.pageSize, total),
  };
}

export async function getChallan(id: string) {
  const challan = await findChallanById(id);
  if (!challan) {
    throw new AppError(404, ErrorCodes.NOT_FOUND, 'Challan was not found.');
  }
  return toChallan(challan);
}

export async function createChallan(input: ChallanWriteInput, createdById: string) {
  const challan = await createDraftChallan({
    customerId: input.customerId,
    items: input.items,
    createdById,
  });
  return toChallan(challan);
}

export async function updateChallan(id: string, input: ChallanPatchInput) {
  const challan = await updateDraftChallan(id, input);
  return toChallan(challan);
}

export async function confirmChallan(id: string, createdById: string) {
  const challan = await persistConfirm(id, createdById);
  return toChallan(challan);
}

export async function cancelChallan(id: string) {
  const challan = await cancelDraftChallan(id);
  return toChallan(challan);
}
