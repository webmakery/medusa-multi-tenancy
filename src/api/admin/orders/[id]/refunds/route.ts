import { MedusaRequest, MedusaResponse } from '@medusajs/framework/http';

import handleOrderRefundWorkflow, {
  HandleOrderRefundWorkflowInput,
} from '../../../../../workflows/orders/handle-refund';
import { requireIdempotencyKey } from '../../../../utils/idempotency';

export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const idempotencyKey = requireIdempotencyKey(req, res);
  if (!idempotencyKey) return;

  const body = (req.body || {}) as Partial<HandleOrderRefundWorkflowInput>;

  if (typeof body.amount !== 'number' || body.amount <= 0) {
    return res.status(400).json({
      message: 'amount must be a positive number.',
    });
  }

  const { result } = await handleOrderRefundWorkflow(req.scope).run({
    input: {
      order_id: req.params.id,
      payment_id: body.payment_id,
      amount: body.amount,
      note: body.note,
      created_by: (req as any).auth_context?.actor_id,
    },
    context: {
      idempotencyKey: `admin-order-refund:${req.params.id}:${idempotencyKey}`,
    },
  });

  return res.status(200).json({
    refund: result,
  });
}
