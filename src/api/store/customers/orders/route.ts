import { MedusaRequest, MedusaResponse } from '@medusajs/framework/http';
import { getOrdersListWorkflow } from '@medusajs/medusa/core-flows';

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const customerId = (req as any).auth_context?.actor_id || (req.query.customer_id as string | undefined);

  if (!customerId) {
    return res.status(401).json({
      message: 'A signed in customer is required.',
    });
  }

  const { result } = await getOrdersListWorkflow(req.scope).run({
    input: {
      fields: [
        'id',
        'display_id',
        'status',
        'summary.total',
        'summary.refunded_total',
        'summary.currency_code',
        'created_at',
        'updated_at',
      ],
      variables: {
        filters: {
          is_draft_order: false,
          customer_id: customerId,
        },
      },
    },
  });

  const rows = (result as any).rows || result;
  const metadata = (result as any).metadata || { count: rows.length, skip: 0, take: rows.length };

  return res.status(200).json({
    orders: rows,
    count: metadata.count,
    offset: metadata.skip,
    limit: metadata.take,
  });
}
