import { MedusaRequest, MedusaResponse } from '@medusajs/framework/http';
import { CreateProductWorkflowInputDTO, UpdateProductWorkflowInputDTO } from '@medusajs/framework/types';

import batchUpsertProductsWorkflow from '../../../../workflows/batch-upsert-products';

interface AdminBatchUpsertProductsBody {
  create?: CreateProductWorkflowInputDTO[];
  update?: UpdateProductWorkflowInputDTO[];
}

export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const body = (req.body || {}) as AdminBatchUpsertProductsBody;

  const create = Array.isArray(body.create) ? body.create : [];
  const update = Array.isArray(body.update) ? body.update : [];

  if (!create.length && !update.length) {
    return res.status(400).json({
      message: 'At least one of create/update arrays must be provided.',
    });
  }

  const { result } = await batchUpsertProductsWorkflow(req.scope).run({
    input: {
      create,
      update,
    },
  });

  return res.status(200).json(result);
}
