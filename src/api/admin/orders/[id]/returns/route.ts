import { MedusaRequest, MedusaResponse } from '@medusajs/framework/http';
import { ContainerRegistrationKeys } from '@medusajs/framework/utils';

import manageOrderReturnWorkflow, { ReturnLifecycleAction } from '../../../../../workflows/orders/manage-return';
import { requireIdempotencyKey } from '../../../../utils/idempotency';

interface ReturnsLifecycleBody {
  action?: ReturnLifecycleAction;
  payload?: Record<string, unknown>;
}

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY);

  const { data: returns } = await query.graph({
    entity: 'return',
    fields: ['id', 'status', 'created_at', 'updated_at', 'order_id'],
    filters: {
      order_id: req.params.id,
    },
  });

  return res.status(200).json({
    count: returns.length,
    returns,
  });
}

export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const idempotencyKey = requireIdempotencyKey(req, res);
  if (!idempotencyKey) return;

  const body = (req.body || {}) as ReturnsLifecycleBody;

  if (!body.action || !body.payload) {
    return res.status(400).json({
      message: 'action and payload are required.',
    });
  }

  const payload = {
    ...body.payload,
    ...(body.action === 'begin'
      ? {
          order_id: req.params.id,
          created_by: (req as any).auth_context?.actor_id,
        }
      : {}),
  };

  const { result } = await manageOrderReturnWorkflow(req.scope).run({
    input: {
      action: body.action,
      payload,
    },
    context: {
      idempotencyKey: `admin-order-return:${req.params.id}:${body.action}:${idempotencyKey}`,
    },
  });

  return res.status(200).json(result);
}
