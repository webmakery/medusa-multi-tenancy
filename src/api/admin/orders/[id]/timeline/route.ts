import { MedusaRequest, MedusaResponse } from '@medusajs/framework/http';

import orderTimelineWorkflow from '../../../../../workflows/orders/order-timeline';

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const { result } = await orderTimelineWorkflow(req.scope).run({
    input: {
      order_id: req.params.id,
    },
  });

  return res.status(200).json(result);
}
