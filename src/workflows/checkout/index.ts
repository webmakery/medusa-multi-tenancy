import { WorkflowResponse, createWorkflow, transform } from '@medusajs/framework/workflows-sdk';

import calculateTaxesWorkflow from './calculate-taxes';
import placeOrderWorkflow from './place-order';
import processPaymentWorkflow from './process-payment';
import selectShippingRatesWorkflow from './select-shipping-rates';
import { CheckoutWorkflowInput, CheckoutWorkflowOutput } from './types';
import validateCartWorkflow from './validate-cart';

const checkoutWorkflow = createWorkflow('checkout-workflow', (input: CheckoutWorkflowInput) => {
  const validatedCart = validateCartWorkflow.runAsStep({
    input: input.cart,
  });

  const shippingSelection = selectShippingRatesWorkflow.runAsStep({
    input: {
      cart: validatedCart,
      provider_id: input.shipping_provider_id,
      address: input.shipping_address,
      shipping_option_id: input.shipping_option_id,
    },
  });

  const totals = calculateTaxesWorkflow.runAsStep({
    input: {
      cart: validatedCart,
      shipping_rate: shippingSelection.selected_rate,
      tax_rate: input.tax_rate,
    },
  });

  const payment = processPaymentWorkflow.runAsStep({
    input: {
      payment: input.payment,
      totals,
      currency_code: validatedCart.currency_code,
    },
  });

  const order = placeOrderWorkflow.runAsStep({
    input: {
      cart: validatedCart,
      shipping_method: shippingSelection.selected_rate,
      totals,
      payment,
    },
  });

  return new WorkflowResponse(
    transform({ order }, (data): CheckoutWorkflowOutput => ({
      order: data.order,
    }))
  );
});

export * from './types';
export { calculateTaxesWorkflow, placeOrderWorkflow, processPaymentWorkflow, selectShippingRatesWorkflow, validateCartWorkflow };

export default checkoutWorkflow;
