import { StepResponse, WorkflowResponse, createStep, createWorkflow } from '@medusajs/framework/workflows-sdk';

import {
  SHIPPING_PROVIDER_REGISTRY,
  ShippingAddressInput,
  ShippingProviderRegistry,
  ShippingRateOption,
} from '../../modules/shipping';
import { ValidatedCheckoutCart } from './types';

export interface SelectShippingRatesWorkflowInput {
  cart: ValidatedCheckoutCart;
  provider_id: string;
  address: ShippingAddressInput;
  shipping_option_id?: string;
}

export interface SelectShippingRatesWorkflowOutput {
  available_rates: ShippingRateOption[];
  selected_rate: ShippingRateOption;
}

const selectShippingRateStep = createStep(
  'checkout-select-shipping-rate-step',
  async (input: SelectShippingRatesWorkflowInput, { container }) => {
    const registry = container.resolve<ShippingProviderRegistry>(SHIPPING_PROVIDER_REGISTRY);
    const provider = registry.get(input.provider_id);

    if (!provider) {
      throw new Error(`Shipping provider \"${input.provider_id}\" is not registered.`);
    }

    const rates = await provider.listRates({
      cart_id: input.cart.id,
      items: input.cart.items,
      address: input.address,
      currency_code: input.cart.currency_code,
    });

    if (!rates.length) {
      throw new Error(`No shipping rates available from provider \"${input.provider_id}\".`);
    }

    const selectedRate = input.shipping_option_id
      ? rates.find((rate) => rate.id === input.shipping_option_id)
      : rates[0];

    if (!selectedRate) {
      throw new Error(`Shipping option \"${input.shipping_option_id}\" is not available.`);
    }

    return new StepResponse({
      available_rates: rates,
      selected_rate: selectedRate,
    });
  }
);

const selectShippingRatesWorkflow = createWorkflow('checkout-select-shipping-rates', (input: SelectShippingRatesWorkflowInput) => {
  const selectedRate = selectShippingRateStep(input);

  return new WorkflowResponse(selectedRate);
});

export default selectShippingRatesWorkflow;
