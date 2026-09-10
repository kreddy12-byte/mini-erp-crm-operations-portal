import type { Request, Response } from 'express';
import {
  cancelChallan,
  confirmChallan,
  createChallan,
  generateChallanPdf,
  getChallan,
  listChallans,
  updateChallan,
} from '../services/challans.service';
import { AppError, ErrorCodes } from '../utils/app-error';
import { sendSuccess } from '../utils/http';
import {
  parseChallanId,
  parseChallanListQuery,
  parseCreateChallanBody,
  parseUpdateChallanBody,
} from '../validators/challan.validator';

function requireAuth(req: Request) {
  if (!req.auth) {
    throw new AppError(401, ErrorCodes.UNAUTHORIZED, 'Authentication is required.');
  }
  return req.auth;
}

export async function list(req: Request, res: Response): Promise<void> {
  const query = parseChallanListQuery(req.query);
  const data = await listChallans(query);
  sendSuccess(res, data, 'Challans loaded');
}

export async function getById(req: Request, res: Response): Promise<void> {
  const id = parseChallanId(req.params.id);
  const challan = await getChallan(id);
  sendSuccess(res, { challan }, 'Challan loaded');
}

export async function exportPdf(req: Request, res: Response): Promise<void> {
  const id = parseChallanId(req.params.id);
  const { buffer, filename } = await generateChallanPdf(id);

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Length', String(buffer.length));
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.status(200).send(buffer);
}

export async function create(req: Request, res: Response): Promise<void> {
  const auth = requireAuth(req);
  const input = parseCreateChallanBody(req.body);
  const challan = await createChallan(input, auth.id);
  sendSuccess(res, { challan }, 'Challan created', 201);
}

export async function update(req: Request, res: Response): Promise<void> {
  const id = parseChallanId(req.params.id);
  const input = parseUpdateChallanBody(req.body);
  const challan = await updateChallan(id, input);
  sendSuccess(res, { challan }, 'Challan updated');
}

export async function confirm(req: Request, res: Response): Promise<void> {
  const auth = requireAuth(req);
  const id = parseChallanId(req.params.id);
  const challan = await confirmChallan(id, auth.id);
  sendSuccess(res, { challan }, 'Challan confirmed');
}

export async function cancel(req: Request, res: Response): Promise<void> {
  const id = parseChallanId(req.params.id);
  const challan = await cancelChallan(id);
  sendSuccess(res, { challan }, 'Challan cancelled');
}
