export interface StoreSettings {
  store_name: string;
  support_email: string;
  default_currency_code: string;
  timezone: string;
}

export interface TeamMember {
  id: string;
  tenant_id: string;
  user_email: string;
  role: 'owner' | 'admin' | 'staff';
  status: string;
  created_at: string;
  updated_at: string;
}

export interface SalesChannel {
  id: string;
  name: string;
  description: string;
  is_enabled: boolean;
}

export interface OnboardingChecklistItem {
  key: string;
  label: string;
  is_completed: boolean;
}

async function apiRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`/admin${path}`, {
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers || {}),
    },
    ...init,
  });

  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new Error(payload.message || `Request failed (${response.status})`);
  }

  return response.json() as Promise<T>;
}

export async function getStoreSettings() {
  return apiRequest<{ settings: StoreSettings }>('/settings/store');
}

export async function updateStoreSettings(input: StoreSettings) {
  return apiRequest<{ settings: StoreSettings; message: string }>('/settings/store', {
    method: 'PUT',
    body: JSON.stringify(input),
  });
}

export async function getTeamMembers() {
  return apiRequest<{ count: number; members: TeamMember[] }>('/team-members');
}

export async function getSalesChannels() {
  return apiRequest<{ count: number; sales_channels: SalesChannel[] }>('/sales-channels');
}

export async function getOnboardingChecklist() {
  return apiRequest<{ count: number; completed: number; checklist: OnboardingChecklistItem[] }>('/onboarding-checklist');
}
