export default {
  admin: {
    shared: {
      loading: 'Loading…',
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
    },
    salesChannels: {
      menuLabel: 'Sales channels',
      title: 'Sales channels',
      description: 'Track channels where customers can browse and purchase.',
    },
    onboarding: {
      menuLabel: 'Onboarding',
      title: 'Onboarding checklist',
      description: 'Monitor completion of key setup milestones.',
      progress: '{{completed}} of {{total}} checklist items completed',
    },
  },
};
