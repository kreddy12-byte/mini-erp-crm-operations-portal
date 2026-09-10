import { api } from './api.ts';
import { ApiClientError, type ApiSuccess } from '../types/api.ts';
import type {
  Challan,
  ChallanListParams,
  ChallanListResponse,
  ChallanPatchPayload,
  ChallanWritePayload,
} from '../types/challan.ts';

function toSearchParams(params: ChallanListParams): string {
  const search = new URLSearchParams();
  if (params.page) search.set('page', String(params.page));
  if (params.pageSize) search.set('pageSize', String(params.pageSize));
  if (params.search) search.set('search', params.search);
  if (params.status) search.set('status', params.status);
  if (params.customerId) search.set('customerId', params.customerId);
  if (params.sortBy) search.set('sortBy', params.sortBy);
  if (params.sortOrder) search.set('sortOrder', params.sortOrder);
  const query = search.toString();
  return query ? `?${query}` : '';
}

export async function listChallans(params: ChallanListParams = {}): Promise<ChallanListResponse> {
  const response = await api.get<ApiSuccess<ChallanListResponse>>(`/challans${toSearchParams(params)}`);
  return response.data.data;
}

export async function getChallan(id: string): Promise<Challan> {
  const response = await api.get<ApiSuccess<{ challan: Challan }>>(`/challans/${id}`);
  return response.data.data.challan;
}

export async function createChallan(payload: ChallanWritePayload): Promise<Challan> {
  const response = await api.post<ApiSuccess<{ challan: Challan }>>('/challans', payload);
  return response.data.data.challan;
}

export async function updateChallan(id: string, payload: ChallanPatchPayload): Promise<Challan> {
  const response = await api.patch<ApiSuccess<{ challan: Challan }>>(`/challans/${id}`, payload);
  return response.data.data.challan;
}

export async function confirmChallan(id: string): Promise<Challan> {
  const response = await api.post<ApiSuccess<{ challan: Challan }>>(`/challans/${id}/confirm`);
  return response.data.data.challan;
}

export async function cancelChallan(id: string): Promise<Challan> {
  const response = await api.post<ApiSuccess<{ challan: Challan }>>(`/challans/${id}/cancel`);
  return response.data.data.challan;
}

function filenameFromDisposition(header: string | undefined, fallback: string): string {
  if (!header) return fallback;
  const utfMatch = /filename\*=UTF-8''([^;]+)/i.exec(header);
  if (utfMatch?.[1]) {
    try {
      return decodeURIComponent(utfMatch[1].trim());
    } catch {
      return utfMatch[1].trim();
    }
  }
  const plainMatch = /filename="?([^";]+)"?/i.exec(header);
  return plainMatch?.[1]?.trim() || fallback;
}

/**
 * Downloads the server-generated Sales Challan PDF (authenticated, read-only).
 */
export async function downloadChallanPdf(id: string): Promise<{ blob: Blob; filename: string }> {
  try {
    const response = await api.get<Blob>(`/challans/${id}/pdf`, {
      responseType: 'blob',
    });

    const contentType = String(response.headers['content-type'] ?? '');
    if (!contentType.includes('application/pdf')) {
      const text = await response.data.text();
      let message = 'Unable to export challan PDF.';
      try {
        const parsed = JSON.parse(text) as { error?: { message?: string } };
        if (parsed.error?.message) message = parsed.error.message;
      } catch {
        // keep default message
      }
      throw new ApiClientError(response.status || 500, 'PDF_EXPORT_FAILED', message);
    }

    const filename = filenameFromDisposition(
      response.headers['content-disposition'],
      `sales-challan-${id}.pdf`,
    );

    return { blob: response.data, filename };
  } catch (reason: unknown) {
    if (reason instanceof ApiClientError) {
      throw reason;
    }

    // Axios may surface JSON error bodies as Blobs when responseType is blob.
    if (
      typeof reason === 'object' &&
      reason !== null &&
      'response' in reason &&
      typeof (reason as { response?: { data?: unknown; status?: number } }).response === 'object'
    ) {
      const response = (reason as { response: { data?: unknown; status?: number } }).response;
      const data = response.data;
      if (data instanceof Blob) {
        const text = await data.text();
        try {
          const parsed = JSON.parse(text) as { error?: { code?: string; message?: string } };
          throw new ApiClientError(
            response.status ?? 500,
            parsed.error?.code ?? 'PDF_EXPORT_FAILED',
            parsed.error?.message ?? 'Unable to export challan PDF.',
          );
        } catch (inner: unknown) {
          if (inner instanceof ApiClientError) throw inner;
        }
      }
    }

    throw reason;
  }
}
