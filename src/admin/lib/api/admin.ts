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
  label?: string;
  is_completed: boolean;
}

export class AdminApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'AdminApiError';
    this.status = status;
  }
}

interface ApiErrorPayload {
  message?: string;
  error?: string;
  details?: unknown;
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

  const isJson = response.headers.get('content-type')?.includes('application/json');
  const payload = isJson ? ((await response.json().catch(() => ({}))) as ApiErrorPayload | T) : null;

  if (!response.ok) {
    const apiMessage = (payload as ApiErrorPayload | null)?.message || (payload as ApiErrorPayload | null)?.error;
    const fallback = `Request failed (${response.status} ${response.statusText})`;
    const normalizedMessage = !apiMessage || apiMessage === 'An unknown error occurred.'
      ? `${fallback} while requesting /admin${path}`
      : apiMessage;
    throw new AdminApiError(normalizedMessage, response.status);
  }

  if (payload) {
    return payload as T;
  }

  return {} as T;
}

interface StoreSettingsResponse {
  settings: StoreSettings;
  message?: string;
}

export async function getStoreSettings() {
  const response = await apiRequest<StoreSettingsResponse>('/settings/store');

  return {
    settings: {
      store_name: response.settings?.store_name || '',
      support_email: response.settings?.support_email || '',
      default_currency_code: response.settings?.default_currency_code || 'usd',
      timezone: response.settings?.timezone || 'UTC',
    },
  };
}

export async function updateStoreSettings(input: StoreSettings) {
  const response = await apiRequest<StoreSettingsResponse>('/settings/store', {
    method: 'PUT',
    body: JSON.stringify(input),
  });

  return {
    settings: {
      store_name: response.settings?.store_name || input.store_name,
      support_email: response.settings?.support_email || input.support_email,
      default_currency_code: response.settings?.default_currency_code || input.default_currency_code,
      timezone: response.settings?.timezone || input.timezone,
    },
    message: response.message,
  };
}

interface TeamMembersResponse {
  count: number;
  members?: TeamMember[];
  team_members?: TeamMember[];
}

export async function getTeamMembers() {
  const response = await apiRequest<TeamMembersResponse>('/team-members');

  return {
    count: response.count,
    members: response.members || response.team_members || [],
  };
}

interface SalesChannelsResponse {
  count: number;
  sales_channels?: SalesChannel[];
  channels?: SalesChannel[];
}

export async function getSalesChannels() {
  const response = await apiRequest<SalesChannelsResponse>('/sales-channels');

  return {
    count: response.count,
    sales_channels: response.sales_channels || response.channels || [],
  };
}

interface OnboardingChecklistResponse {
  count: number;
  completed?: number;
  checklist?: OnboardingChecklistItem[];
  items?: OnboardingChecklistItem[];
}

export async function getOnboardingChecklist() {
  const response = await apiRequest<OnboardingChecklistResponse>('/onboarding-checklist');

  const checklist = response.checklist || response.items || [];
  const completed = typeof response.completed === 'number'
    ? response.completed
    : checklist.filter((item) => item.is_completed).length;

  return {
    count: response.count,
    completed,
    checklist,
  };
}
