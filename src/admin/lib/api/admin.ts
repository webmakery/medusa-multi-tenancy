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
  role: 'owner' | 'admin' | 'member' | 'viewer';
  status: string;
  created_at: string;
  updated_at: string;
}

export interface ActiveTenantMembership {
  tenant_id: string;
  role: 'owner' | 'admin' | 'member' | 'viewer';
  status: string;
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

export interface AppWebhook {
  event_name: string;
  target_url: string;
}

export interface InstalledApp {
  id: string;
  app_name: string;
  app_identifier: string;
  app_url?: string | null;
  installed_at: string;
  scopes: string[];
  webhooks: AppWebhook[];
}

export interface AppWebhookDeliveryLog {
  id: string;
  event_name: string;
  target_url: string;
  delivery_status: 'delivered' | 'failed';
  attempt_number: number;
  response_status?: number | null;
  error_message?: string | null;
  delivered_at: string;
}

export interface AnalyticsTimeseriesPoint {
  date: string;
  gmv_cents: number;
  aov_cents: number;
  orders_count: number;
  sessions_count: number;
  checkout_started_count: number;
  checkout_completed_count: number;
  conversion_proxy: number;
  currency_code?: string | null;
}

export interface AnalyticsTopProduct {
  rank: number;
  product_id: string;
  product_title?: string | null;
  quantity: number;
  gmv_cents: number;
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

interface ActiveTenantResponse {
  active_tenant_id?: string | null;
  memberships: ActiveTenantMembership[];
}

export async function getActiveTenantContext() {
  return apiRequest<ActiveTenantResponse>('/tenants/active');
}

export async function switchActiveTenant(tenantId: string) {
  return apiRequest<ActiveTenantResponse>('/tenants/active', {
    method: 'POST',
    body: JSON.stringify({ tenant_id: tenantId }),
  });
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

interface UpsertSalesChannelInput {
  name: string;
  description?: string;
  is_enabled?: boolean;
}

export async function createSalesChannel(input: UpsertSalesChannelInput) {
  return apiRequest<{ message?: string; sales_channel: SalesChannel }>('/sales-channels', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export async function updateSalesChannel(channelId: string, input: Partial<UpsertSalesChannelInput>) {
  return apiRequest<{ message?: string; sales_channel: SalesChannel }>(`/sales-channels/${channelId}`, {
    method: 'PUT',
    body: JSON.stringify(input),
  });
}

export async function deleteSalesChannel(channelId: string) {
  return apiRequest<{ message?: string; id: string }>(`/sales-channels/${channelId}`, {
    method: 'DELETE',
  });
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

interface AppsResponse {
  count: number;
  apps: InstalledApp[];
}

export async function getInstalledApps() {
  return apiRequest<AppsResponse>('/apps');
}

interface InstallAppInput {
  app_name: string;
  app_identifier: string;
  app_url?: string;
  scopes: string[];
}

export async function installApp(input: InstallAppInput) {
  return apiRequest<{ message?: string; app: { app_id: string; scopes: string[] } }>('/apps', {
    method: 'POST',
    headers: {
      'Idempotency-Key': `apps-install-${crypto.randomUUID()}`,
    },
    body: JSON.stringify(input),
  });
}

export async function uninstallApp(appId: string) {
  return apiRequest<{ message?: string; app_id: string }>(`/apps/${appId}`, {
    method: 'DELETE',
  });
}

interface WebhookDeliveryLogsResponse {
  count: number;
  logs: AppWebhookDeliveryLog[];
}

export async function getWebhookDeliveryLogs(appId: string, limit = 50) {
  return apiRequest<WebhookDeliveryLogsResponse>(`/apps/${appId}/webhook-deliveries?limit=${limit}`);
}

interface AnalyticsTimeseriesResponse {
  tenant_id: string;
  from?: string;
  to?: string;
  granularity: 'day';
  data: AnalyticsTimeseriesPoint[];
}

interface AnalyticsTopProductsResponse {
  tenant_id: string;
  from?: string;
  to?: string;
  data: AnalyticsTopProduct[];
}

interface AnalyticsRangeInput {
  from?: string;
  to?: string;
}

function buildQuery(input: AnalyticsRangeInput & { limit?: number }) {
  const query = new URLSearchParams();

  if (input.from) {
    query.set('from', input.from);
  }

  if (input.to) {
    query.set('to', input.to);
  }

  if (typeof input.limit === 'number') {
    query.set('limit', String(input.limit));
  }

  return query.toString();
}

export async function getAnalyticsTimeseries(input: AnalyticsRangeInput = {}) {
  const query = buildQuery(input);
  const path = query ? `/analytics/timeseries?${query}` : '/analytics/timeseries';

  return apiRequest<AnalyticsTimeseriesResponse>(path);
}

export async function getAnalyticsTopProducts(input: AnalyticsRangeInput & { limit?: number } = {}) {
  const query = buildQuery(input);
  const path = query ? `/analytics/top-products?${query}` : '/analytics/top-products';

  return apiRequest<AnalyticsTopProductsResponse>(path);
}
