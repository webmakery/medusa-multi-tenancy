import { StepResponse, WorkflowResponse, createStep, createWorkflow } from '@medusajs/framework/workflows-sdk';
import { beginReturnOrderWorkflow, requestItemReturnWorkflow, updateReturnWorkflow } from '@medusajs/medusa/core-flows';

export type ReturnLifecycleAction = 'begin' | 'request_items' | 'update';

export interface ManageOrderReturnWorkflowInput {
  action: ReturnLifecycleAction;
  payload: Record<string, unknown>;
}

const manageReturnStep = createStep('orders-manage-return-lifecycle-step', async (input: ManageOrderReturnWorkflowInput, { container }) => {
  let result: unknown;

  if (input.action === 'begin') {
    result = (await beginReturnOrderWorkflow(container).run({ input: input.payload as any })).result;
  } else if (input.action === 'request_items') {
    result = (await requestItemReturnWorkflow(container).run({ input: input.payload as any })).result;
  } else {
    result = (await updateReturnWorkflow(container).run({ input: input.payload as any })).result;
  }

  return new StepResponse({
    action: input.action,
    result,
  });
});

const manageOrderReturnWorkflow = createWorkflow('orders-manage-return-lifecycle', (input: ManageOrderReturnWorkflowInput) => {
  const result = manageReturnStep(input);

  return new WorkflowResponse(result);
});

export default manageOrderReturnWorkflow;
