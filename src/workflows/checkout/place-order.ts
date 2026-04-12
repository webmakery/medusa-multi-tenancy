import crypto from 'node:crypto';

import { StepResponse, WorkflowResponse, createStep, createWorkflow } from '@medusajs/framework/workflows-sdk';

import { ShippingRateOption } from '../../modules/shipping';
import { CheckoutOrder, CheckoutTaxedTotals, ValidatedCheckoutCart } from './types';

export interface PlaceOrderWorkflowInput {
  cart: ValidatedCheckoutCart;
  shipping_method: ShippingRateOption;
  totals: CheckoutTaxedTotals;
  payment: {
    authorization_id: string;
    capture?: {
      status: 'captured' | 'failed';
      captured_at?: string;
    };
  };
}

const placeOrderStep = createStep('checkout-place-order-step', async (input: PlaceOrderWorkflowInput) => {
  const order: CheckoutOrder = {
    id: `order_${crypto.randomUUID()}`,
    cart_id: input.cart.id,
    currency_code: input.cart.currency_code,
    shipping_method: input.shipping_method,
    totals: input.totals,
    payment: {
      authorization_id: input.payment.authorization_id,
      capture: input.payment.capture,
    },
    placed_at: new Date().toISOString(),
  };

  return new StepResponse(order);
});

const placeOrderWorkflow = createWorkflow('checkout-place-order', (input: PlaceOrderWorkflowInput) => {
  const order = placeOrderStep(input);

  return new WorkflowResponse(order);
});

export default placeOrderWorkflow;
