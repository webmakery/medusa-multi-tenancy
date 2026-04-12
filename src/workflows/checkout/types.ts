import { PaymentCaptureResult } from '../../modules/payments';
import { ShippingAddressInput, ShippingRateOption } from '../../modules/shipping';

export interface CheckoutLineItem {
  id: string;
  title?: string;
  quantity: number;
  unit_price: number;
  metadata?: Record<string, unknown>;
}

export interface CheckoutCart {
  id: string;
  currency_code: string;
  items: CheckoutLineItem[];
  customer_id?: string;
  metadata?: Record<string, unknown>;
}

export interface ValidatedCheckoutCart extends CheckoutCart {
  subtotal: number;
}

export interface CheckoutTaxLine {
  name: string;
  rate: number;
  amount: number;
}

export interface CheckoutTaxedTotals {
  subtotal: number;
  shipping_total: number;
  tax_total: number;
  total: number;
  tax_lines: CheckoutTaxLine[];
}

export interface CheckoutPaymentDetails {
  provider_id: string;
  payment_method: Record<string, unknown>;
  capture?: boolean;
  metadata?: Record<string, unknown>;
}

export interface CheckoutOrder {
  id: string;
  cart_id: string;
  currency_code: string;
  shipping_method: ShippingRateOption;
  totals: CheckoutTaxedTotals;
  payment: {
    authorization_id: string;
    capture?: PaymentCaptureResult;
  };
  placed_at: string;
}

export interface CheckoutWorkflowInput {
  cart: CheckoutCart;
  shipping_provider_id: string;
  shipping_address: ShippingAddressInput;
  shipping_option_id?: string;
  payment: CheckoutPaymentDetails;
  tax_rate?: number;
}

export interface CheckoutWorkflowOutput {
  order: CheckoutOrder;
}
