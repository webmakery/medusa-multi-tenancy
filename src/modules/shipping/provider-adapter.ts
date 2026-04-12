export const SHIPPING_PROVIDER_REGISTRY = 'shippingProviderRegistry';

export interface ShippingAddressInput {
  country_code: string;
  province?: string;
  postal_code?: string;
  city?: string;
  address_1?: string;
}

export interface ShippingRateOption {
  id: string;
  name: string;
  amount: number;
  currency_code: string;
  estimated_days?: number;
  metadata?: Record<string, unknown>;
}

export interface ShippingRateSelectionInput {
  cart_id: string;
  items: Array<{
    id: string;
    quantity: number;
    unit_price: number;
    title?: string;
  }>;
  address: ShippingAddressInput;
  currency_code: string;
}

/**
 * Adapter contract that shipping providers (carrier APIs or custom shipping logic)
 * must implement to participate in checkout workflows.
 */
export interface ShippingProviderAdapter {
  identifier: string;
  listRates(input: ShippingRateSelectionInput): Promise<ShippingRateOption[]>;
}

export interface ShippingProviderRegistry {
  get(providerId: string): ShippingProviderAdapter | undefined;
}

export class InMemoryShippingProviderRegistry implements ShippingProviderRegistry {
  constructor(private readonly providers: ShippingProviderAdapter[]) {}

  get(providerId: string): ShippingProviderAdapter | undefined {
    return this.providers.find((provider) => provider.identifier === providerId);
  }
}
