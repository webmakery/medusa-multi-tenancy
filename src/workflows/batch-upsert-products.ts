import { CreateProductWorkflowInputDTO, ProductTypes, UpdateProductWorkflowInputDTO } from '@medusajs/framework/types';
import { WorkflowResponse, createWorkflow, parallelize, transform, when } from '@medusajs/framework/workflows-sdk';
import { createProductsWorkflow, updateProductsWorkflow } from '@medusajs/medusa/core-flows';

export interface BatchUpsertProductsWorkflowInput {
  create?: CreateProductWorkflowInputDTO[];
  update?: UpdateProductWorkflowInputDTO[];
}

export interface BatchUpsertProductsWorkflowOutput {
  created: ProductTypes.ProductDTO[];
  updated: ProductTypes.ProductDTO[];
}

const conditionallyCreateProducts = (input: BatchUpsertProductsWorkflowInput) =>
  when({ input }, ({ input }) => !!input.create?.length).then(() =>
    createProductsWorkflow.runAsStep({
      input: {
        products: input.create || [],
      },
    })
  );

const conditionallyUpdateProducts = (input: BatchUpsertProductsWorkflowInput) =>
  when({ input }, ({ input }) => !!input.update?.length).then(() =>
    updateProductsWorkflow.runAsStep({
      input: {
        products: input.update || [],
      },
    })
  );

const batchUpsertProductsWorkflow = createWorkflow('batch-upsert-products', (input: BatchUpsertProductsWorkflowInput) => {
  const results = parallelize(conditionallyCreateProducts(input), conditionallyUpdateProducts(input));

  return new WorkflowResponse(
    transform({ input, results }, (data): BatchUpsertProductsWorkflowOutput => {
      return {
        created: data.results[0] ?? [],
        updated: data.results[1] ?? [],
      };
    })
  );
});

export default batchUpsertProductsWorkflow;
