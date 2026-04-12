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

export interface OrderTimelineEvent {
  id: string;
  at: string;
  type: string;
  label: string;
  metadata?: Record<string, unknown>;
}

interface OrderTimelineResponse {
  order_id: string;
  events: OrderTimelineEvent[];
}

export async function getOrderTimeline(orderId: string) {
  return apiRequest<OrderTimelineResponse>(`/orders/${orderId}/timeline`);
}

interface CreateAdminFulfillmentInput {
  location_id: string;
  items: Array<{
    id: string;
    quantity: number;
  }>;
  no_notification?: boolean;
}

export async function createAdminFulfillment(orderId: string, input: CreateAdminFulfillmentInput) {
  return apiRequest<{ fulfillment: unknown }>(`/orders/${orderId}/fulfillments`, {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

interface UpdateAdminTrackingInput {
  items: Array<{
    id: string;
    quantity: number;
  }>;
  labels: Array<{
    tracking_number: string;
    tracking_url: string;
    label_url: string;
  }>;
  no_notification?: boolean;
}

export async function updateAdminTracking(orderId: string, fulfillmentId: string, input: UpdateAdminTrackingInput) {
  return apiRequest<{ shipment: unknown }>(`/orders/${orderId}/fulfillments/${fulfillmentId}/tracking`, {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

interface CreateAdminRefundInput {
  payment_id?: string;
  amount: number;
  note?: string;
}

export async function createAdminRefund(orderId: string, input: CreateAdminRefundInput) {
  return apiRequest<{ refund: unknown }>(`/orders/${orderId}/refunds`, {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

interface RunReturnLifecycleInput {
  action: 'begin' | 'request_items' | 'update';
  payload: Record<string, unknown>;
}

export async function runReturnLifecycle(orderId: string, input: RunReturnLifecycleInput) {
  return apiRequest<{ action: string; result: unknown }>(`/orders/${orderId}/returns`, {
    method: 'POST',
    body: JSON.stringify(input),
  });
}
