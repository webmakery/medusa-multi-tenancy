import { StepResponse, WorkflowResponse, createStep, createWorkflow } from '@medusajs/framework/workflows-sdk';

import { CheckoutCart, ValidatedCheckoutCart } from './types';

const validateCartStep = createStep('checkout-validate-cart-step', async (cart: CheckoutCart) => {
  if (!cart?.id) {
    throw new Error('cart.id is required.');
  }

  if (!cart.currency_code) {
    throw new Error('cart.currency_code is required.');
  }

  if (!Array.isArray(cart.items) || cart.items.length === 0) {
    throw new Error('cart.items must contain at least one line item.');
  }

  const invalidItem = cart.items.find((item) => !item.id || item.quantity <= 0 || item.unit_price < 0);

  if (invalidItem) {
    throw new Error('Each cart item must include id, positive quantity, and non-negative unit_price.');
  }

  const subtotal = cart.items.reduce((sum, item) => sum + item.quantity * item.unit_price, 0);

  return new StepResponse({
    ...cart,
    subtotal,
  } as ValidatedCheckoutCart);
});

const validateCartWorkflow = createWorkflow('checkout-validate-cart', (cart: CheckoutCart) => {
  const validatedCart = validateCartStep(cart);

  return new WorkflowResponse(validatedCart);
});

export default validateCartWorkflow;
