import { createOrderShipmentWorkflow } from '@medusajs/medusa/core-flows';
import { StepResponse, WorkflowResponse, createStep, createWorkflow } from '@medusajs/framework/workflows-sdk';

export interface UpdateOrderTrackingWorkflowInput {
  order_id: string;
  fulfillment_id: string;
  items: Array<{
    id: string;
    quantity: number;
  }>;
  labels: Array<{
    tracking_number: string;
    tracking_url: string;
    label_url: string;
  }>;
  no_notification?: boolean;
}

const updateOrderTrackingStep = createStep('orders-update-fulfillment-tracking-step', async (input: UpdateOrderTrackingWorkflowInput, { container }) => {
  const { result } = await createOrderShipmentWorkflow(container).run({
    input,
  });

  return new StepResponse(result);
});

const updateOrderTrackingWorkflow = createWorkflow('orders-update-fulfillment-tracking', (input: UpdateOrderTrackingWorkflowInput) => {
  const result = updateOrderTrackingStep(input);

  return new WorkflowResponse(result);
});

export default updateOrderTrackingWorkflow;
