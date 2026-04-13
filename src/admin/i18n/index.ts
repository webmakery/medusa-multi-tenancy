const en = {
  admin: {
    shared: {
      loading: 'Loading…',
      unknownError: 'Unable to load this page right now. Please try again.',
      noData: 'No data is available yet.',
    },
    storeSettings: {
      menuLabel: 'Store settings',
      title: 'Store settings',
      description: 'Manage basic store profile information shown to your staff.',
      actions: {
        save: 'Save settings',
      },
      fields: {
        storeName: 'Store name',
        supportEmail: 'Support email',
        defaultCurrency: 'Default currency',
        timezone: 'Timezone',
      },
      success: {
        saved: 'Store settings saved.',
      },
      errors: {
        load: 'Could not load store settings.',
        save: 'Could not save store settings.',
      },
    },
    teamMembers: {
      menuLabel: 'Team members',
      title: 'Team members and roles',
      description: 'See who has access to this store and what permissions they have.',
      empty: 'No team members found.',
      columns: {
        email: 'Email',
        role: 'Role',
        status: 'Status',
      },
      errors: {
        load: 'Could not load team members.',
      },
      tenantSwitcher: {
        title: 'Tenant context',
        description: 'If you belong to multiple tenants, explicitly switch to the tenant you want to manage.',
        current: 'Current active tenant: {{tenantId}}',
        none: 'No active tenant selected in this session.',
        selectLabel: 'Switch tenant',
        action: 'Switch tenant',
        success: 'Tenant context updated.',
        errors: {
          load: 'Could not load tenant memberships.',
          switch: 'Could not switch tenant context.',
        },
      },
    },
    salesChannels: {
      menuLabel: 'Sales channels',
      title: 'Sales channels',
      description: 'Track channels where customers can browse and purchase.',
      empty: 'No sales channels found.',
      status: {
        enabled: 'Enabled',
        disabled: 'Disabled',
      },
      errors: {
        load: 'Could not load sales channels.',
      },
    },
    apps: {
      menuLabel: 'Apps',
      title: 'Apps and integrations',
      description: 'Install apps, review permission consent, and inspect webhook delivery retries.',
      empty: 'No installed apps found.',
      none: 'No permissions',
      consent: 'I reviewed and approve these app permissions for this store.',
      logsFor: 'Recent delivery logs for {{appName}}',
      noLogs: 'No webhook delivery logs for this app yet.',
      sections: {
        install: 'Install app',
        permissions: 'Permission consent',
        installed: 'Installed apps',
        deliveryLogs: 'Webhook delivery retry logs',
      },
      fields: {
        name: 'App name',
        identifier: 'App identifier',
        url: 'App URL',
        logsApp: 'App',
      },
      columns: {
        event: 'Event',
        target: 'Webhook URL',
        status: 'Status',
        attempt: 'Attempt',
        response: 'Response code',
        error: 'Error',
        deliveredAt: 'Delivered at',
      },
      actions: {
        install: 'Install app',
        installing: 'Installing…',
        uninstall: 'Uninstall',
        confirmUninstall: 'Uninstall {{appName}}?',
      },
      messages: {
        installed: 'App installed successfully.',
        uninstalled: 'App uninstalled successfully.',
      },
      errors: {
        load: 'Could not load apps.',
        install: 'Could not install app.',
        uninstall: 'Could not uninstall app.',
        loadLogs: 'Could not load webhook delivery logs.',
        consentRequired: 'You must consent to the requested permissions.',
        scopeRequired: 'Select at least one permission scope.',
      },
    },

    orderOps: {
      menuLabel: 'Order operations',
      title: 'Order operations',
      description: 'Run auditable order operations and inspect a unified timeline.',
      emptyTimeline: 'No timeline events found for this order yet.',
      sections: {
        fulfillment: 'Fulfillment creation',
        tracking: 'Tracking updates',
        refund: 'Refund handling',
        returns: 'Returns lifecycle',
        timeline: 'Order timeline',
      },
      actions: {
        loadTimeline: 'Load timeline',
        createFulfillment: 'Create fulfillment',
        updateTracking: 'Update tracking',
        createRefund: 'Create refund',
        beginReturn: 'Run return action',
      },
      fields: {
        orderId: 'Order ID',
        locationId: 'Location ID',
        itemId: 'Order item ID',
        fulfillmentId: 'Fulfillment ID',
        trackingNumber: 'Tracking number',
        trackingUrl: 'Tracking URL',
        paymentId: 'Payment ID (optional)',
        refundNote: 'Refund note',
      },
      messages: {
        timelineLoaded: 'Timeline loaded.',
        fulfillmentCreated: 'Fulfillment created.',
        trackingUpdated: 'Tracking updated.',
        refundCreated: 'Refund created.',
        returnUpdated: 'Return lifecycle action completed.',
      },
      errors: {
        default: 'Order operation failed.',
      },
    },
    onboarding: {
      menuLabel: 'Onboarding',
      title: 'Onboarding checklist',
      description: 'Monitor completion of key setup milestones.',
      progress: '{{completed}} of {{total}} checklist items completed',
      errors: {
        load: 'Could not load onboarding checklist.',
      },
      items: {
        create_store_profile: 'Create store profile',
        invite_team: 'Invite team member',
        add_sales_channel: 'Add sales channel',
        review_launch_readiness: 'Review launch readiness',
      },
    },
    analytics: {
      menuLabel: 'Analytics',
      title: 'Analytics overview',
      description: 'Review daily KPIs and top-performing products for a selected date range.',
      filters: {
        title: 'Filters',
        from: 'From',
        to: 'To',
        limit: 'Top products limit',
      },
      sections: {
        timeseries: 'Daily timeseries',
        topProducts: 'Top products',
      },
      columns: {
        date: 'Date',
        gmv: 'GMV',
        aov: 'AOV',
        orders: 'Orders',
        sessions: 'Sessions',
        checkoutStarted: 'Checkouts started',
        checkoutCompleted: 'Checkouts completed',
        conversion: 'Conversion',
        rank: 'Rank',
        product: 'Product',
        quantity: 'Quantity sold',
      },
      empty: {
        timeseries: 'No timeseries analytics data is available for this date range.',
        topProducts: 'No top products were found for this date range.',
      },
      errors: {
        load: 'Could not load analytics data.',
      },
    },
    billing: {
      menuLabel: 'Billing',
      title: 'Tenant billing',
      description: 'Review billing lifecycle state, entitlement limits, and metered usage for this tenant.',
      unlimited: 'Unlimited',
      fields: {
        status: 'Billing status',
        plan: 'Plan: {{plan}}',
        trialEnds: 'Trial ends: {{date}}',
        graceEnds: 'Grace period ends: {{date}}',
      },
      actions: {
        renew: 'Run renewal',
        failPayment: 'Mark payment failed',
        recoverPayment: 'Recover payment',
        expireGrace: 'Refresh grace state',
      },
      columns: {
        feature: 'Feature',
        meter: 'Meter',
        limit: 'Limit',
        used: 'Used this period',
      },
      transitions: {
        title: 'State transitions',
      },
      errors: {
        load: 'Could not load billing overview.',
        update: 'Could not update billing state.',
      },
    },
  },
};

export default {
  en: {
    translation: en,
  },
};
