import { MedusaRequest, MedusaResponse } from '@medusajs/framework/http';
import { createAndCompleteReturnOrderWorkflow } from '@medusajs/medusa/core-flows';

interface CustomerReturnRequestBody {
  order_id?: string;
  location_id?: string;
  no_notification?: boolean;
  items?: Array<{
    id: string;
    quantity: number;
    reason_id?: string;
    note?: string;
  }>;
}

export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const customerId = (req as any).auth_context?.actor_id || (req.query.customer_id as string | undefined);

  if (!customerId) {
    return res.status(401).json({
      message: 'A signed in customer is required.',
    });
  }

  const body = (req.body || {}) as CustomerReturnRequestBody;

  if (!body.order_id || !body.location_id || !Array.isArray(body.items) || body.items.length === 0) {
    return res.status(400).json({
      message: 'order_id, location_id, and at least one return item are required.',
    });
  }

  const { result } = await createAndCompleteReturnOrderWorkflow(req.scope).run({
    input: {
      order_id: body.order_id,
      location_id: body.location_id,
      items: body.items,
      created_by: customerId,
    },
  });

  return res.status(200).json({
    return: result,
  });
}
