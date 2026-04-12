export const PAYMENT_PROVIDER_REGISTRY = 'paymentProviderRegistry';

export type PaymentAuthorizationStatus = 'authorized' | 'requires_action' | 'declined';
export type PaymentCaptureStatus = 'captured' | 'failed';

export interface PaymentAuthorizeInput {
  amount: number;
  currency_code: string;
  payment_method: Record<string, unknown>;
  metadata?: Record<string, unknown>;
}

export interface PaymentAuthorizeResult {
  status: PaymentAuthorizationStatus;
  transaction_id: string;
  raw_response?: Record<string, unknown>;
}

export interface PaymentCaptureInput {
  transaction_id: string;
  amount?: number;
  metadata?: Record<string, unknown>;
}

export interface PaymentCaptureResult {
  status: PaymentCaptureStatus;
  captured_at?: string;
  raw_response?: Record<string, unknown>;
}

/**
 * Adapter contract that payment providers (Stripe, Adyen, custom gateways)
 * must implement to participate in checkout workflows.
 */
export interface PaymentProviderAdapter {
  identifier: string;
  authorizePayment(input: PaymentAuthorizeInput): Promise<PaymentAuthorizeResult>;
  capturePayment(input: PaymentCaptureInput): Promise<PaymentCaptureResult>;
}

export interface PaymentProviderRegistry {
  get(providerId: string): PaymentProviderAdapter | undefined;
}

export class InMemoryPaymentProviderRegistry implements PaymentProviderRegistry {
  constructor(private readonly providers: PaymentProviderAdapter[]) {}

  get(providerId: string): PaymentProviderAdapter | undefined {
    return this.providers.find((provider) => provider.identifier === providerId);
  }
}
