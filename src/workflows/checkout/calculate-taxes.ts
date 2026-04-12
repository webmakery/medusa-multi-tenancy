import { StepResponse, WorkflowResponse, createStep, createWorkflow } from '@medusajs/framework/workflows-sdk';

import { ShippingRateOption } from '../../modules/shipping';
import { CheckoutTaxedTotals, ValidatedCheckoutCart } from './types';

export interface CalculateTaxesWorkflowInput {
  cart: ValidatedCheckoutCart;
  shipping_rate: ShippingRateOption;
  tax_rate?: number;
}

const calculateTaxesStep = createStep('checkout-calculate-taxes-step', async (input: CalculateTaxesWorkflowInput) => {
  const normalizedTaxRate = Math.max(0, input.tax_rate ?? 0);
  const taxableAmount = input.cart.subtotal + input.shipping_rate.amount;
  const taxTotal = Math.round(taxableAmount * normalizedTaxRate);

  const totals: CheckoutTaxedTotals = {
    subtotal: input.cart.subtotal,
    shipping_total: input.shipping_rate.amount,
    tax_total: taxTotal,
    total: taxableAmount + taxTotal,
    tax_lines: [
      {
        name: 'standard',
        rate: normalizedTaxRate,
        amount: taxTotal,
      },
    ],
  };

  return new StepResponse(totals);
});

const calculateTaxesWorkflow = createWorkflow('checkout-calculate-taxes', (input: CalculateTaxesWorkflowInput) => {
  const totals = calculateTaxesStep(input);

  return new WorkflowResponse(totals);
});

export default calculateTaxesWorkflow;
