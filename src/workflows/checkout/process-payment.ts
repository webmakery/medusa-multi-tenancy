import { StepResponse, WorkflowResponse, createStep, createWorkflow } from '@medusajs/framework/workflows-sdk';

import { PAYMENT_PROVIDER_REGISTRY, PaymentProviderRegistry } from '../../modules/payments';
import { CheckoutPaymentDetails, CheckoutTaxedTotals } from './types';

export interface ProcessPaymentWorkflowInput {
  payment: CheckoutPaymentDetails;
  totals: CheckoutTaxedTotals;
  currency_code: string;
}

export interface ProcessPaymentWorkflowOutput {
  authorization_id: string;
  capture?: {
    status: 'captured' | 'failed';
    captured_at?: string;
  };
}

const processPaymentStep = createStep('checkout-process-payment-step', async (input: ProcessPaymentWorkflowInput, { container }) => {
  const registry = container.resolve<PaymentProviderRegistry>(PAYMENT_PROVIDER_REGISTRY);
  const provider = registry.get(input.payment.provider_id);

  if (!provider) {
    throw new Error(`Payment provider \"${input.payment.provider_id}\" is not registered.`);
  }

  const authorization = await provider.authorizePayment({
    amount: input.totals.total,
    currency_code: input.currency_code,
    payment_method: input.payment.payment_method,
    metadata: input.payment.metadata,
  });

  if (authorization.status !== 'authorized') {
    throw new Error(`Payment authorization failed with status \"${authorization.status}\".`);
  }

  if (!input.payment.capture) {
    return new StepResponse({
      authorization_id: authorization.transaction_id,
    });
  }

  const capture = await provider.capturePayment({
    transaction_id: authorization.transaction_id,
    amount: input.totals.total,
  });

  return new StepResponse({
    authorization_id: authorization.transaction_id,
    capture: {
      status: capture.status,
      captured_at: capture.captured_at,
    },
  });
});

const processPaymentWorkflow = createWorkflow('checkout-process-payment', (input: ProcessPaymentWorkflowInput) => {
  const payment = processPaymentStep(input);

  return new WorkflowResponse(payment);
});

export default processPaymentWorkflow;
