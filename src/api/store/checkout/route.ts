import { MedusaRequest, MedusaResponse } from '@medusajs/framework/http';

import checkoutWorkflow, { CheckoutWorkflowInput } from '../../../workflows/checkout';
import { ANALYTICS_MODULE } from '../../../modules/analytics';
import AnalyticsModuleService from '../../../modules/analytics/service';
import { getTenantIdFromRequest } from '../../utils/tenant';

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

  const tenantId = getTenantIdFromRequest(req);
  const analyticsService: AnalyticsModuleService = req.scope.resolve(ANALYTICS_MODULE);

  if (tenantId) {
    await analyticsService.recordEvent({
      tenant_id: tenantId,
      event_type: 'checkout_started',
      session_id: body.cart.id,
      currency_code: body.cart.currency_code,
    });
  }

  const { result } = await checkoutWorkflow(req.scope).run({
    input: body as CheckoutWorkflowInput,
  });

  if (tenantId) {
    await analyticsService.recordEvent({
      tenant_id: tenantId,
      event_type: 'checkout_completed',
      session_id: body.cart.id,
      order_id: result.order.id,
      currency_code: result.order.currency_code,
      amount_cents: result.order.totals.total,
      items: body.cart.items.map((item) => ({
        product_id: item.id,
        title: item.title,
        quantity: item.quantity,
        unit_price: item.unit_price,
      })),
    });
  }

  return res.status(200).json(result);
}
