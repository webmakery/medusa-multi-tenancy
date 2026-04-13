import { getTenantIdFromRequest } from '../../../utils/tenant';
import { MedusaRequest, MedusaResponse } from '@medusajs/framework/http';

import syncInventoryByLocationWorkflow from '../../../../workflows/sync-inventory-by-location';

interface AdminInventorySyncLevel {
  inventory_item_id?: string;
  stocked_quantity?: number;
}

interface AdminSyncInventoryBody {
  location_id?: string;
  levels?: AdminInventorySyncLevel[];
}

export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const tenantId = getTenantIdFromRequest(req);

  if (!tenantId) {
    return res.status(400).json({ message: 'x-tenant-id header (or tenant_id query in development) is required' });
  }

  const body = (req.body || {}) as AdminSyncInventoryBody;

  if (!body.location_id?.trim()) {
    return res.status(400).json({
      message: 'location_id is required.',
    });
  }

  const levels = Array.isArray(body.levels) ? body.levels : [];

  if (!levels.length) {
    return res.status(400).json({
      message: 'levels array is required.',
    });
  }

  const invalidLevel = levels.find((level) => !level.inventory_item_id || typeof level.stocked_quantity !== 'number');

  if (invalidLevel) {
    return res.status(400).json({
      message: 'Each level must include inventory_item_id and numeric stocked_quantity.',
    });
  }

  const { result } = await syncInventoryByLocationWorkflow(req.scope).run({
    input: {
      location_id: body.location_id,
      levels: levels as { inventory_item_id: string; stocked_quantity: number }[],
    },
  });

  return res.status(200).json(result);
}
