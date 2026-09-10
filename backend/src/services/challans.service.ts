import type { ChallanPatchInput, ChallanWriteInput, ChallanListQuery } from '../types/challan';
import {
  cancelDraftChallan,
  confirmChallan as persistConfirm,
  createDraftChallan,
  findChallanById,
  findChallanForPdf,
  listChallans as queryChallans,
  updateDraftChallan,
} from '../repositories/challans.repository';
import { AppError, ErrorCodes } from '../utils/app-error';
import { toPaginationMeta } from '../utils/pagination';
import { buildChallanPdfBuffer } from './challan-pdf.service';

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

/**
 * Read-only PDF export. Does not mutate challan, stock, or related records.
 * Line items always use SalesChallanItem snapshot fields.
 */
export async function generateChallanPdf(id: string) {
  const challan = await findChallanForPdf(id);
  if (!challan) {
    throw new AppError(404, ErrorCodes.NOT_FOUND, 'Challan was not found.');
  }
  if (!challan.customer) {
    throw new AppError(500, ErrorCodes.INTERNAL_ERROR, 'Challan customer data is unavailable.');
  }

  try {
    return await buildChallanPdfBuffer({
      challanNumber: challan.challanNumber,
      status: challan.status,
      totalQuantity: challan.totalQuantity,
      createdAt: challan.createdAt,
      createdBy: { name: challan.createdBy.name },
      customer: {
        name: challan.customer.name,
        mobile: challan.customer.mobile,
        email: challan.customer.email,
        businessName: challan.customer.businessName,
        gstNumber: challan.customer.gstNumber,
        address: challan.customer.address,
      },
      items: challan.items.map((item) => ({
        productNameSnapshot: item.productNameSnapshot,
        skuSnapshot: item.skuSnapshot,
        unitPriceSnapshot: item.unitPriceSnapshot,
        quantity: item.quantity,
      })),
    });
  } catch (error: unknown) {
    if (error instanceof AppError) {
      throw error;
    }
    console.error('Challan PDF generation failed');
    throw new AppError(500, ErrorCodes.INTERNAL_ERROR, 'Unable to generate the challan PDF.');
  }
}
