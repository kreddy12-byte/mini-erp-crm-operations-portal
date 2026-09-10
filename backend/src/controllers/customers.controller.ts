import type { Request, Response } from 'express';
import {
  createCustomer,
  createCustomerFollowUp,
  getCustomer,
  getCustomerFollowUps,
  listCustomers,
  updateCustomer,
} from '../services/customers.service';
import { AppError, ErrorCodes } from '../utils/app-error';
import { sendSuccess } from '../utils/http';
import {
  parseCreateCustomerBody,
  parseCreateFollowUpBody,
  parseCustomerId,
  parseCustomerListQuery,
  parseUpdateCustomerBody,
} from '../validators/customer.validator';

export async function list(req: Request, res: Response): Promise<void> {
  const query = parseCustomerListQuery(req.query);
  const data = await listCustomers(query);
  sendSuccess(res, data, 'Customers loaded');
}

export async function getById(req: Request, res: Response): Promise<void> {
  const id = parseCustomerId(req.params.id);
  const data = await getCustomer(id);
  sendSuccess(res, { customer: data }, 'Customer loaded');
}

export async function create(req: Request, res: Response): Promise<void> {
  const input = parseCreateCustomerBody(req.body);
  const customer = await createCustomer(input);
  sendSuccess(res, { customer }, 'Customer created', 201);
}

export async function update(req: Request, res: Response): Promise<void> {
  const id = parseCustomerId(req.params.id);
  const input = parseUpdateCustomerBody(req.body);
  const customer = await updateCustomer(id, input);
  sendSuccess(res, { customer }, 'Customer updated');
}

export async function listFollowUps(req: Request, res: Response): Promise<void> {
  const id = parseCustomerId(req.params.id);
  const data = await getCustomerFollowUps(id);
  sendSuccess(res, data, 'Follow-ups loaded');
}

export async function createFollowUp(req: Request, res: Response): Promise<void> {
  if (!req.auth) {
    throw new AppError(401, ErrorCodes.UNAUTHORIZED, 'Authentication is required.');
  }

  const id = parseCustomerId(req.params.id);
  const input = parseCreateFollowUpBody(req.body);
  const followUp = await createCustomerFollowUp(id, input, req.auth.id);
  sendSuccess(res, { followUp }, 'Follow-up added', 201);
}
