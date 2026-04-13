import { MedusaRequest, MedusaResponse } from '@medusajs/framework/http';

import updateOrderTrackingWorkflow, {
  UpdateOrderTrackingWorkflowInput,
} from '../../../../../../../workflows/orders/update-fulfillment-tracking';
import { buildTenantScopedIdempotencyKey, requireIdempotencyKey } from '../../../../../../utils/idempotency';

export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const idempotencyKey = requireIdempotencyKey(req, res);
  if (!idempotencyKey) return;

  const body = (req.body || {}) as Partial<UpdateOrderTrackingWorkflowInput>;

  if (!Array.isArray(body.labels) || body.labels.length === 0) {
    return res.status(400).json({
      message: 'labels is required.',
    });
  }
  if (!Array.isArray(body.items) || body.items.length === 0) {
    return res.status(400).json({
      message: 'items is required.',
    });
  }

  const { result } = await updateOrderTrackingWorkflow(req.scope).run({
    input: {
      order_id: req.params.id,
      fulfillment_id: req.params.fulfillment_id,
      items: body.items,
      labels: body.labels,
      no_notification: body.no_notification,
    },
    context: {
      idempotencyKey: buildTenantScopedIdempotencyKey(req, `admin-order-tracking:${req.params.id}:${req.params.fulfillment_id}`, idempotencyKey),
    },
  });

  return res.status(200).json({
    shipment: result,
  });
}
