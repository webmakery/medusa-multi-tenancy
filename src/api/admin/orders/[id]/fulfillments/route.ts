import { MedusaRequest, MedusaResponse } from '@medusajs/framework/http';

import createOrdersFulfillmentWorkflow, {
  CreateOrderFulfillmentWorkflowInput,
} from '../../../../../workflows/orders/create-fulfillment';

export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const body = (req.body || {}) as Partial<CreateOrderFulfillmentWorkflowInput>;

  if (!body.location_id) {
    return res.status(400).json({
      message: 'location_id is required.',
    });
  }

  if (!Array.isArray(body.items) || body.items.length === 0) {
    return res.status(400).json({
      message: 'items is required.',
    });
  }

  const { result } = await createOrdersFulfillmentWorkflow(req.scope).run({
    input: {
      order_id: req.params.id,
      location_id: body.location_id,
      items: body.items,
      no_notification: body.no_notification,
    },
  });

  return res.status(200).json({
    fulfillment: result,
  });
}
