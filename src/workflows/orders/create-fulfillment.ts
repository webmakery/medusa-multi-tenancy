import { createOrderFulfillmentWorkflow } from '@medusajs/medusa/core-flows';
import { StepResponse, WorkflowResponse, createStep, createWorkflow } from '@medusajs/framework/workflows-sdk';

export interface CreateOrderFulfillmentWorkflowInput {
  order_id: string;
  location_id: string;
  items: Array<{
    id: string;
    quantity: number;
  }>;
  no_notification?: boolean;
}

const createOrderFulfillmentStep = createStep(
  'orders-create-fulfillment-step',
  async (input: CreateOrderFulfillmentWorkflowInput, { container }) => {
    const { result } = await createOrderFulfillmentWorkflow(container).run({
      input,
    });

    return new StepResponse(result);
  }
);

const createOrdersFulfillmentWorkflow = createWorkflow('orders-create-fulfillment', (input: CreateOrderFulfillmentWorkflowInput) => {
  const result = createOrderFulfillmentStep(input);

  return new WorkflowResponse(result);
});

export default createOrdersFulfillmentWorkflow;
