import { MedusaRequest, MedusaResponse } from '@medusajs/framework/http';

import checkoutWorkflow, { CheckoutWorkflowInput } from '../../../workflows/checkout';

export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const body = (req.body || {}) as Partial<CheckoutWorkflowInput>;

  if (!body.cart) {
    return res.status(400).json({
      message: 'cart is required.',
    });
  }

  if (!body.shipping_provider_id) {
    return res.status(400).json({
      message: 'shipping_provider_id is required.',
    });
  }

  if (!body.shipping_address?.country_code) {
    return res.status(400).json({
      message: 'shipping_address.country_code is required.',
    });
  }

  if (!body.payment?.provider_id || !body.payment?.payment_method) {
    return res.status(400).json({
      message: 'payment.provider_id and payment.payment_method are required.',
    });
  }

  const { result } = await checkoutWorkflow(req.scope).run({
    input: body as CheckoutWorkflowInput,
  });

  return res.status(200).json(result);
}
