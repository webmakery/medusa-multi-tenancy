import { MedusaRequest, MedusaResponse } from '@medusajs/framework/http';

import { getTenantIdFromRequest } from '../../../utils/tenant';
import batchAssignProductsToCollectionWorkflow from '../../../../workflows/batch-assign-products-to-collection';

interface AdminBatchAssignCollectionBody {
  collection_id?: string;
  add?: string[];
  remove?: string[];
}

export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const tenantId = getTenantIdFromRequest(req);

  if (!tenantId) {
    return res.status(400).json({ message: 'x-tenant-id header (or tenant_id query in development) is required' });
  }

  const body = (req.body || {}) as AdminBatchAssignCollectionBody;
  const collectionId = body.collection_id?.trim();

  if (!collectionId) {
    return res.status(400).json({
      message: 'collection_id is required.',
    });
  }

  const add = Array.isArray(body.add) ? body.add : [];
  const remove = Array.isArray(body.remove) ? body.remove : [];

  const { result } = await batchAssignProductsToCollectionWorkflow(req.scope).run({
    input: {
      id: collectionId,
      add,
      remove,
    },
  });

  return res.status(200).json(result);
}
