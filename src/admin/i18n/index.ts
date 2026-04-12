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
  },
};

export default {
  en: {
    translation: en,
  },
};
