import type { Request, Response } from 'express';
import { createProduct, getProduct, listProducts, updateProduct } from '../services/products.service';
import { AppError, ErrorCodes } from '../utils/app-error';
import { sendSuccess } from '../utils/http';
import {
  parseCreateProductBody,
  parseProductId,
  parseProductListQuery,
  parseUpdateProductBody,
} from '../validators/product.validator';

export async function list(req: Request, res: Response): Promise<void> {
  const query = parseProductListQuery(req.query);
  const data = await listProducts(query);
  sendSuccess(res, data, 'Products loaded');
}

export async function getById(req: Request, res: Response): Promise<void> {
  const id = parseProductId(req.params.id);
  const product = await getProduct(id);
  sendSuccess(res, { product }, 'Product loaded');
}

export async function create(req: Request, res: Response): Promise<void> {
  if (!req.auth) {
    throw new AppError(401, ErrorCodes.UNAUTHORIZED, 'Authentication is required.');
  }
  const input = parseCreateProductBody(req.body);
  const product = await createProduct(input, req.auth.id);
  sendSuccess(res, { product }, 'Product created', 201);
}

export async function update(req: Request, res: Response): Promise<void> {
  const id = parseProductId(req.params.id);
  const input = parseUpdateProductBody(req.body);
  const product = await updateProduct(id, input);
  sendSuccess(res, { product }, 'Product updated');
}
