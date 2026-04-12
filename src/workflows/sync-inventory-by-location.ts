import { InventoryTypes } from '@medusajs/framework/types';
import { ContainerRegistrationKeys } from '@medusajs/framework/utils';
import { StepResponse, WorkflowResponse, createStep, createWorkflow, transform, when } from '@medusajs/framework/workflows-sdk';
import { createInventoryLevelsWorkflow, updateInventoryLevelsWorkflow } from '@medusajs/medusa/core-flows';

interface InventorySyncInputLevel {
  inventory_item_id: string;
  stocked_quantity: number;
}

export interface SyncInventoryByLocationWorkflowInput {
  location_id: string;
  levels: InventorySyncInputLevel[];
}

export interface SyncInventoryByLocationWorkflowOutput {
  location_id: string;
  created_count: number;
  updated_count: number;
}

const splitInventoryLevelsStep = createStep(
  'split-inventory-levels-by-existing-location-records',
  async (input: SyncInventoryByLocationWorkflowInput, { container }) => {
    const query = container.resolve(ContainerRegistrationKeys.QUERY);

    const { data: existingLevels } = await query.graph({
      entity: 'inventory_level',
      fields: ['id', 'inventory_item_id', 'location_id'],
      filters: {
        location_id: input.location_id,
      },
    });

    const existingByInventoryItemId = new Map<string, { id: string }>();

    for (const level of existingLevels as { id: string; inventory_item_id: string }[]) {
      existingByInventoryItemId.set(level.inventory_item_id, { id: level.id });
    }

    const creates: InventoryTypes.CreateInventoryLevelInput[] = [];
    const updates: InventoryTypes.UpdateInventoryLevelInput[] = [];

    for (const level of input.levels) {
      const existing = existingByInventoryItemId.get(level.inventory_item_id);

      if (existing) {
        updates.push({
          id: existing.id,
          inventory_item_id: level.inventory_item_id,
          location_id: input.location_id,
          stocked_quantity: level.stocked_quantity,
        });
      } else {
        creates.push({
          inventory_item_id: level.inventory_item_id,
          location_id: input.location_id,
          stocked_quantity: level.stocked_quantity,
        });
      }
    }

    return new StepResponse({
      creates,
      updates,
    });
  }
);

const syncInventoryByLocationWorkflow = createWorkflow('sync-inventory-by-location', (input: SyncInventoryByLocationWorkflowInput) => {
  const splitLevels = splitInventoryLevelsStep(input);

  const created = when({ splitLevels }, ({ splitLevels }) => splitLevels.creates.length > 0).then(() =>
    createInventoryLevelsWorkflow.runAsStep({
      input: transform({ splitLevels }, (data) => ({
        inventory_levels: data.splitLevels.creates,
      })),
    })
  );

  const updated = when({ splitLevels }, ({ splitLevels }) => splitLevels.updates.length > 0).then(() =>
    updateInventoryLevelsWorkflow.runAsStep({
      input: transform({ splitLevels }, (data) => ({
        updates: data.splitLevels.updates,
      })),
    })
  );

  return new WorkflowResponse(
    transform({ input, created, updated }, (data): SyncInventoryByLocationWorkflowOutput => ({
      location_id: data.input.location_id,
      created_count: data.created?.length ?? 0,
      updated_count: data.updated?.length ?? 0,
    }))
  );
});

export default syncInventoryByLocationWorkflow;
