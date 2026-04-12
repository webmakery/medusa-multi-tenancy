import { ContainerRegistrationKeys } from '@medusajs/framework/utils';
import { StepResponse, WorkflowResponse, createStep, createWorkflow, transform } from '@medusajs/framework/workflows-sdk';

export interface OrderTimelineWorkflowInput {
  order_id: string;
}

export interface OrderTimelineEvent {
  id: string;
  at: string;
  type: 'order.created' | 'order.updated' | 'fulfillment.created' | 'fulfillment.shipped' | 'refund.created' | 'return.created' | 'return.updated';
  label: string;
  metadata?: Record<string, unknown>;
}

interface TimelineLoadOutput {
  order: any;
  fulfillments: any[];
  returns: any[];
  refunds: any[];
}

const loadOrderRelationsStep = createStep('orders-load-timeline-relations-step', async (input: OrderTimelineWorkflowInput, { container }) => {
  const query = container.resolve(ContainerRegistrationKeys.QUERY);

  const [{ data: orders }, { data: fulfillments }, { data: returns }, { data: refunds }] = await Promise.all([
    query.graph({
      entity: 'order',
      fields: ['id', 'display_id', 'status', 'created_at', 'updated_at'],
      filters: {
        id: input.order_id,
      },
    }),
    query.graph({
      entity: 'fulfillment',
      fields: ['id', 'status', 'tracking_links', 'created_at', 'updated_at', 'data'],
      filters: {
        order_id: input.order_id,
      },
    }),
    query.graph({
      entity: 'return',
      fields: ['id', 'status', 'created_at', 'updated_at', 'order_id'],
      filters: {
        order_id: input.order_id,
      },
    }),
    query.graph({
      entity: 'refund',
      fields: ['id', 'note', 'amount', 'created_at', 'payment_id'],
      filters: {
        order_id: input.order_id,
      },
    }),
  ]);

  const order = (orders || [])[0];

  if (!order?.id) {
    throw new Error(`Order "${input.order_id}" was not found.`);
  }

  return new StepResponse({
    order,
    fulfillments: fulfillments || [],
    returns: returns || [],
    refunds: refunds || [],
  } as TimelineLoadOutput);
});

const orderTimelineWorkflow = createWorkflow('orders-build-timeline', (input: OrderTimelineWorkflowInput) => {
  const relations = loadOrderRelationsStep(input);

  return new WorkflowResponse(
    transform({ relations }, ({ relations }) => {
      const events: OrderTimelineEvent[] = [];

      events.push({
        id: `order-created-${relations.order.id}`,
        at: relations.order.created_at,
        type: 'order.created',
        label: `Order #${relations.order.display_id || relations.order.id} created`,
      });

      if (relations.order.updated_at && relations.order.updated_at !== relations.order.created_at) {
        events.push({
          id: `order-updated-${relations.order.id}`,
          at: relations.order.updated_at,
          type: 'order.updated',
          label: `Order status: ${relations.order.status || 'unknown'}`,
        });
      }

      for (const fulfillment of relations.fulfillments) {
        events.push({
          id: `fulfillment-created-${fulfillment.id}`,
          at: fulfillment.created_at,
          type: 'fulfillment.created',
          label: `Fulfillment ${fulfillment.id} created`,
          metadata: {
            status: fulfillment.status,
          },
        });

        const trackingLinks = (fulfillment.tracking_links || []) as { tracking_number?: string }[];
        if (trackingLinks.length > 0) {
          events.push({
            id: `fulfillment-shipped-${fulfillment.id}`,
            at: fulfillment.updated_at || fulfillment.created_at,
            type: 'fulfillment.shipped',
            label: `Tracking updated for fulfillment ${fulfillment.id}`,
            metadata: {
              tracking_numbers: trackingLinks.map((link) => link.tracking_number).filter(Boolean),
            },
          });
        }
      }

      for (const refund of relations.refunds) {
        events.push({
          id: `refund-${refund.id}`,
          at: refund.created_at,
          type: 'refund.created',
          label: `Refund issued (${refund.amount ?? 0})`,
          metadata: {
            note: refund.note,
            payment_id: refund.payment_id,
          },
        });
      }

      for (const orderReturn of relations.returns) {
        events.push({
          id: `return-created-${orderReturn.id}`,
          at: orderReturn.created_at,
          type: 'return.created',
          label: `Return ${orderReturn.id} opened`,
          metadata: {
            status: orderReturn.status,
          },
        });

        if (orderReturn.updated_at && orderReturn.updated_at !== orderReturn.created_at) {
          events.push({
            id: `return-updated-${orderReturn.id}`,
            at: orderReturn.updated_at,
            type: 'return.updated',
            label: `Return ${orderReturn.id} updated`,
            metadata: {
              status: orderReturn.status,
            },
          });
        }
      }

      events.sort((a, b) => (a.at > b.at ? -1 : 1));

      return {
        order_id: relations.order.id,
        events,
      };
    })
  );
});

export default orderTimelineWorkflow;
