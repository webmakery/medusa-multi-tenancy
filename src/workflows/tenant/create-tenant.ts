import { randomUUID } from 'crypto';

import type { Knex } from 'knex';

import { ContainerRegistrationKeys, Modules } from '@medusajs/framework/utils';
import { StepResponse, WorkflowResponse, createStep, createWorkflow } from '@medusajs/framework/workflows-sdk';
import { createSalesChannelsWorkflow, updateStoresWorkflow } from '@medusajs/medusa/core-flows';

import { AUDIT_LOG_MODULE } from '../../modules/audit-log';
import AuditLogModuleService from '../../modules/audit-log/service';

export interface CreateTenantWorkflowInput {
  name: string;
  slug: string;
  owner_email: string;
}

interface CreatedTenant {
  id: string;
  tenant_id: string;
  name: string;
  slug: string;
  owner_email: string;
  status: string;
}

interface CreateTenantStepOutput {
  tenant: CreatedTenant;
  membership_id: string;
}

const createTenantStep = createStep(
  'tenant-create-tenant-step',
  async (input: CreateTenantWorkflowInput, { container }) => {
    const knex = container.resolve(ContainerRegistrationKeys.PG_CONNECTION) as Knex;

    const existingTenant = await knex('tenant').where({ slug: input.slug }).first();

    if (existingTenant) {
      throw new Error(`A tenant with slug "${input.slug}" already exists.`);
    }

    const tenantId = randomUUID();
    const membershipId = randomUUID();

    const tenant: CreatedTenant = {
      id: tenantId,
      tenant_id: tenantId,
      name: input.name,
      slug: input.slug,
      owner_email: input.owner_email,
      status: 'active',
    };

    await knex('tenant').insert(tenant);

    await knex('tenant_membership').insert({
      id: membershipId,
      tenant_id: tenantId,
      user_email: input.owner_email,
      role: 'owner',
      status: 'active',
    });

    const auditLogService: AuditLogModuleService = container.resolve(AUDIT_LOG_MODULE);

    await auditLogService.recordEvent({
      actor: input.owner_email,
      tenant_id: tenantId,
      action: 'tenant_created',
      resource_id: tenantId,
      payload: {
        name: input.name,
        slug: input.slug,
        owner_email: input.owner_email,
      },
    });

    return new StepResponse(
      {
        tenant,
        membership_id: membershipId,
      },
      {
        tenant_id: tenantId,
      }
    );
  },
  async (compensationInput, { container }) => {
    if (!compensationInput?.tenant_id) {
      return;
    }

    const knex = container.resolve(ContainerRegistrationKeys.PG_CONNECTION) as Knex;

    await knex('tenant_membership').where({ tenant_id: compensationInput.tenant_id }).delete();
    await knex('tenant').where({ id: compensationInput.tenant_id }).delete();
  }
);

const createDefaultSalesChannelStep = createStep('tenant-create-default-sales-channel-step', async (input: CreateTenantStepOutput, { container }) => {
  const { result } = await createSalesChannelsWorkflow(container).run({
    input: {
      salesChannelsData: [
        {
          name: `${input.tenant.name} Sales Channel`,
          description: `Default sales channel for ${input.tenant.name}`,
          is_disabled: false,
        },
      ],
    },
  });

  return new StepResponse({
    sales_channel: result[0],
  });
});

const configureDefaultStoreStep = createStep(
  'tenant-configure-default-store-step',
  async (input: { tenant: CreatedTenant; sales_channel_id: string }, { container }) => {
    const storeModuleService = container.resolve(Modules.STORE);
    const [store] = await storeModuleService.listStores();

    if (!store?.id) {
      throw new Error('No store found to configure for tenant onboarding.');
    }

    const { result } = await updateStoresWorkflow(container).run({
      input: {
        selector: { id: store.id },
        update: {
          name: input.tenant.name,
          default_sales_channel_id: input.sales_channel_id,
        },
      },
    });

    return new StepResponse({
      store: result?.[0] || store,
    });
  }
);

const createTenantOnboardingWorkflow = createWorkflow('tenant-create-onboarding', (input: CreateTenantWorkflowInput) => {
  const tenantResult = createTenantStep(input);

  const salesChannelResult = createDefaultSalesChannelStep(tenantResult);

  const storeResult = configureDefaultStoreStep({
    tenant: tenantResult.tenant,
    sales_channel_id: salesChannelResult.sales_channel.id,
  });

  return new WorkflowResponse({
    tenant: tenantResult.tenant,
    owner_membership_id: tenantResult.membership_id,
    default_sales_channel: salesChannelResult.sales_channel,
    store: storeResult.store,
  });
});

export default createTenantOnboardingWorkflow;
