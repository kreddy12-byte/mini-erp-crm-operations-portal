import { ApiClientError } from '../../types/api.ts';

export interface ChallanErrorCopy {
  title: string;
  description: string;
  code?: string;
}

export function challanLineQuantityError(quantity: number, available: number): string | undefined {
  if (!Number.isInteger(quantity) || quantity < 1) {
    return 'Enter a quantity of 1 or more.';
  }
  if (quantity > available) {
    return `Only ${available} available.`;
  }
  return undefined;
}

export function describeChallanError(error: unknown, fallbackTitle = 'Unable to complete that action'): ChallanErrorCopy {
  if (error instanceof ApiClientError) {
    if (error.status === 403) {
      return {
        title: "You don't have permission to perform this action.",
        description: 'Sales challan changes are limited to Admin and Sales roles.',
        code: error.code,
      };
    }
    if (error.status === 404) {
      return {
        title: 'Challan not found.',
        description: error.message || 'This challan is no longer available.',
        code: error.code,
      };
    }
    if (error.code === 'INSUFFICIENT_STOCK') {
      return {
        title: 'Stock changed before confirmation.',
        description:
          error.message ||
          'One or more products no longer have enough available stock. The draft was kept so you can correct quantities and try again.',
        code: error.code,
      };
    }
    if (error.code === 'INVALID_CHALLAN_STATE') {
      return {
        title: 'That challan can no longer be modified.',
        description: error.message || 'Confirmed and cancelled challans are read-only.',
        code: error.code,
      };
    }
    if (error.status === 0 || error.code === 'NETWORK_ERROR') {
      return {
        title: 'Unable to reach the API',
        description: 'Check that the backend is running, then retry.',
        code: error.code,
      };
    }
    return {
      title: fallbackTitle,
      description: error.message,
      code: error.code,
    };
  }

  return {
    title: fallbackTitle,
    description: 'Please try again. If the problem continues, reload the page.',
  };
}
