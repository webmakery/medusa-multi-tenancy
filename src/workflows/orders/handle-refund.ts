import { ContainerRegistrationKeys } from '@medusajs/framework/utils';
import { StepResponse, WorkflowResponse, createStep, createWorkflow, transform } from '@medusajs/framework/workflows-sdk';
import { refundPaymentWorkflow } from '@medusajs/medusa/core-flows';

export interface HandleOrderRefundWorkflowInput {
  order_id: string;
  payment_id?: string;
  amount: number;
  note?: string;
  created_by?: string;
}

const resolveOrderPaymentStep = createStep('orders-resolve-payment-step', async (input: HandleOrderRefundWorkflowInput, { container }) => {
  if (input.payment_id) {
    return new StepResponse({ payment_id: input.payment_id });
  }

  const query = container.resolve(ContainerRegistrationKeys.QUERY);
  const { data: orders } = await query.graph({
    entity: 'order',
    fields: ['id', 'payment_collections.payments.id'],
    filters: {
      id: input.order_id,
    },
  });

  const paymentId = orders?.[0]?.payment_collections?.[0]?.payments?.[0]?.id;

  if (!paymentId) {
    throw new Error(`Could not resolve a payment for order "${input.order_id}".`);
  }

  return new StepResponse({ payment_id: paymentId });
});

const createRefundStep = createStep(
  'orders-create-refund-step',
  async (input: { payment_id: string; amount: number; note?: string; created_by?: string }, { container }) => {
    const { result } = await refundPaymentWorkflow(container).run({
      input,
    });

    return new StepResponse(result);
  }
);

const handleOrderRefundWorkflow = createWorkflow('orders-handle-refund', (input: HandleOrderRefundWorkflowInput) => {
  const payment = resolveOrderPaymentStep(input);

  const refund = createRefundStep(
    transform({ input, payment }, (data) => ({
      payment_id: data.payment.payment_id,
      amount: data.input.amount,
      note: data.input.note,
      created_by: data.input.created_by,
    }))
  );

  return new WorkflowResponse(refund);
});

export default handleOrderRefundWorkflow;
