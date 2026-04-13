import { randomUUID } from 'crypto';

import type { Knex } from 'knex';

import { ContainerRegistrationKeys, MedusaService } from '@medusajs/framework/utils';

import AnalyticsEvent from './models/analytics-event';
import AnalyticsRollupDaily from './models/analytics-rollup-daily';
import AnalyticsTopProductDaily from './models/analytics-top-product-daily';

interface RecordEventInput {
  tenant_id: string;
  event_type: 'session_started' | 'checkout_started' | 'checkout_completed';
  event_timestamp?: string;
  session_id?: string;
  order_id?: string;
  currency_code?: string;
  amount_cents?: number;
  items?: Array<{ product_id: string; title?: string; quantity: number; unit_price: number }>;
  metadata?: Record<string, unknown>;
}

interface RangeInput {
  tenant_id: string;
  from?: string;
  to?: string;
}

class AnalyticsModuleService extends MedusaService({
  AnalyticsEvent,
  AnalyticsRollupDaily,
  AnalyticsTopProductDaily,
}) {
  private getKnex(): Knex {
    return (this as any).__container__.resolve(ContainerRegistrationKeys.PG_CONNECTION) as Knex;
  }

  async recordEvent(input: RecordEventInput) {
    const knex = this.getKnex();
    const eventTimestamp = input.event_timestamp ? new Date(input.event_timestamp) : new Date();

    await knex('analytics_event').insert({
      id: randomUUID(),
      tenant_id: input.tenant_id,
      event_type: input.event_type,
      event_timestamp: eventTimestamp.toISOString(),
      event_date: eventTimestamp.toISOString().slice(0, 10),
      session_id: input.session_id || null,
      order_id: input.order_id || null,
      currency_code: input.currency_code || null,
      amount_cents: input.amount_cents || null,
      items: input.items ? JSON.stringify(input.items) : null,
      metadata: input.metadata ? JSON.stringify(input.metadata) : null,
    });
  }

  async aggregatePendingEvents() {
    const knex = this.getKnex();

    // tenant-scope-ignore: background rollup worker intentionally processes pending rows across all tenants.
    const pending = await knex('analytics_event')
      .select('tenant_id', 'event_date')
      .whereNull('processed_at')
      .groupBy('tenant_id', 'event_date')
      .orderBy('event_date', 'asc')
      .limit(100);

    for (const row of pending) {
      await this.aggregateByDate(row.tenant_id, row.event_date);
    }

    return { processed_buckets: pending.length };
  }

  async aggregateByDate(tenantId: string, eventDate: string) {
    const knex = this.getKnex();

    await knex.transaction(async (trx) => {
      const rollup = await trx('analytics_event')
        .where({ tenant_id: tenantId, event_date: eventDate })
        .select(
          trx.raw(`SUM(CASE WHEN event_type = 'session_started' THEN 1 ELSE 0 END)::int as sessions_count`),
          trx.raw(`SUM(CASE WHEN event_type = 'checkout_started' THEN 1 ELSE 0 END)::int as checkout_started_count`),
          trx.raw(`SUM(CASE WHEN event_type = 'checkout_completed' THEN 1 ELSE 0 END)::int as checkout_completed_count`),
          trx.raw(`COUNT(DISTINCT CASE WHEN event_type = 'checkout_completed' THEN order_id END)::int as orders_count`),
          trx.raw(`COALESCE(SUM(CASE WHEN event_type = 'checkout_completed' THEN amount_cents ELSE 0 END), 0)::bigint as gmv_cents`),
          trx.raw(`MAX(currency_code) as currency_code`)
        )
        .first();

      const ordersCount = Number(rollup?.orders_count || 0);
      const gmvCents = Number(rollup?.gmv_cents || 0);
      const checkoutStarted = Number(rollup?.checkout_started_count || 0);
      const checkoutCompleted = Number(rollup?.checkout_completed_count || 0);
      const aovCents = ordersCount > 0 ? Math.round(gmvCents / ordersCount) : 0;
      const conversionProxy = checkoutStarted > 0 ? checkoutCompleted / checkoutStarted : 0;

      await trx('analytics_rollup_daily')
        .insert({
          id: randomUUID(),
          tenant_id: tenantId,
          rollup_date: eventDate,
          currency_code: rollup?.currency_code || null,
          sessions_count: Number(rollup?.sessions_count || 0),
          checkout_started_count: checkoutStarted,
          checkout_completed_count: checkoutCompleted,
          orders_count: ordersCount,
          gmv_cents: gmvCents,
          aov_cents: aovCents,
          conversion_proxy: conversionProxy,
          created_at: trx.fn.now(),
          updated_at: trx.fn.now(),
        })
        .onConflict(['tenant_id', 'rollup_date'])
        .merge({
          currency_code: rollup?.currency_code || null,
          sessions_count: Number(rollup?.sessions_count || 0),
          checkout_started_count: checkoutStarted,
          checkout_completed_count: checkoutCompleted,
          orders_count: ordersCount,
          gmv_cents: gmvCents,
          aov_cents: aovCents,
          conversion_proxy: conversionProxy,
          updated_at: trx.fn.now(),
        });

      const productRows = await trx('analytics_event as ae')
        .select(
          trx.raw(`(item->>'product_id') as product_id`),
          trx.raw(`MAX(item->>'title') as product_title`),
          trx.raw(`SUM((item->>'quantity')::int)::int as quantity`),
          trx.raw(`SUM(((item->>'quantity')::int * (item->>'unit_price')::int))::bigint as gmv_cents`)
        )
        .joinRaw('CROSS JOIN LATERAL jsonb_array_elements(ae.items::jsonb) as item')
        .where('ae.tenant_id', tenantId)
        .andWhere('ae.event_date', eventDate)
        .andWhere('ae.event_type', 'checkout_completed')
        .groupByRaw(`item->>'product_id'`)
        .orderBy('gmv_cents', 'desc')
        .limit(50);

      await trx('analytics_top_product_daily')
        .where({ tenant_id: tenantId, rollup_date: eventDate })
        .del();

      if (productRows.length) {
        await trx('analytics_top_product_daily').insert(
          productRows.map((row, index) => ({
            id: randomUUID(),
            tenant_id: tenantId,
            rollup_date: eventDate,
            product_id: row.product_id,
            product_title: row.product_title,
            quantity: Number(row.quantity || 0),
            gmv_cents: Number(row.gmv_cents || 0),
            rank: index + 1,
          }))
        );
      }

      await trx('analytics_event')
        .where({ tenant_id: tenantId, event_date: eventDate })
        .andWhereNull('processed_at')
        .update({ processed_at: trx.fn.now(), updated_at: trx.fn.now() });
    });
  }

  async getTimeseries(input: RangeInput) {
    const knex = this.getKnex();
    const query = knex('analytics_rollup_daily')
      .where({ tenant_id: input.tenant_id })
      .orderBy('rollup_date', 'asc');

    if (input.from) {
      query.andWhere('rollup_date', '>=', input.from);
    }

    if (input.to) {
      query.andWhere('rollup_date', '<=', input.to);
    }

    const rows = await query;

    return rows.map((row) => ({
      date: row.rollup_date,
      gmv_cents: Number(row.gmv_cents || 0),
      aov_cents: Number(row.aov_cents || 0),
      orders_count: Number(row.orders_count || 0),
      sessions_count: Number(row.sessions_count || 0),
      checkout_started_count: Number(row.checkout_started_count || 0),
      checkout_completed_count: Number(row.checkout_completed_count || 0),
      conversion_proxy: Number(row.conversion_proxy || 0),
      currency_code: row.currency_code,
    }));
  }

  async getTopProducts(input: RangeInput & { limit?: number }) {
    const knex = this.getKnex();
    const query = knex('analytics_top_product_daily')
      .where({ tenant_id: input.tenant_id })
      .select('product_id')
      .max('product_title as product_title')
      .sum('quantity as quantity')
      .sum('gmv_cents as gmv_cents')
      .groupBy('product_id')
      .orderBy('gmv_cents', 'desc')
      .limit(Math.min(Math.max(input.limit || 10, 1), 100));

    if (input.from) {
      query.andWhere('rollup_date', '>=', input.from);
    }

    if (input.to) {
      query.andWhere('rollup_date', '<=', input.to);
    }

    const rows = await query;

    return rows.map((row, index) => ({
      rank: index + 1,
      product_id: row.product_id,
      product_title: row.product_title,
      quantity: Number(row.quantity || 0),
      gmv_cents: Number(row.gmv_cents || 0),
    }));
  }
}

export default AnalyticsModuleService;
