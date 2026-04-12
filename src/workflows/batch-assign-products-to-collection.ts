import type { LinkWorkflowInput } from '@medusajs/framework/types';
import { WorkflowResponse, createWorkflow } from '@medusajs/framework/workflows-sdk';
import { batchLinkProductsToCollectionWorkflow } from '@medusajs/medusa/core-flows';

export interface BatchAssignProductsToCollectionWorkflowOutput {
  collection_id: string;
  added_count: number;
  removed_count: number;
}

const batchAssignProductsToCollectionWorkflow = createWorkflow(
  'batch-assign-products-to-collection',
  (input: LinkWorkflowInput) => {
    batchLinkProductsToCollectionWorkflow.runAsStep({ input });

    return new WorkflowResponse<BatchAssignProductsToCollectionWorkflowOutput>({
      collection_id: input.id,
      added_count: input.add?.length ?? 0,
      removed_count: input.remove?.length ?? 0,
    });
  }
);

export default batchAssignProductsToCollectionWorkflow;
