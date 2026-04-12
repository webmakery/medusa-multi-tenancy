import { MedusaRequest, MedusaResponse } from '@medusajs/framework/http';

import { PAYMENT_PROVIDER_REGISTRY, PaymentProviderRegistry } from '../../../modules/payments';

interface AdminAuthorizePaymentBody {
  operation: 'authorize';
  provider_id: string;
  amount: number;
  currency_code: string;
  payment_method: Record<string, unknown>;
  metadata?: Record<string, unknown>;
}

interface AdminCapturePaymentBody {
  operation: 'capture';
  provider_id: string;
  transaction_id: string;
  amount?: number;
  metadata?: Record<string, unknown>;
}

type AdminPaymentOperationBody = AdminAuthorizePaymentBody | AdminCapturePaymentBody;

export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const body = (req.body || {}) as Partial<AdminPaymentOperationBody>;

  if (!body.operation || !body.provider_id) {
    return res.status(400).json({
      message: 'operation and provider_id are required.',
    });
  }

  const registry = req.scope.resolve<PaymentProviderRegistry>(PAYMENT_PROVIDER_REGISTRY);
  const provider = registry.get(body.provider_id);

  if (!provider) {
    return res.status(404).json({
      message: `Payment provider \"${body.provider_id}\" not found.`,
    });
  }

  if (body.operation === 'authorize') {
    const authorizeBody = body as Partial<AdminAuthorizePaymentBody>;

    if (
      typeof authorizeBody.amount !== 'number' ||
      !authorizeBody.currency_code ||
      !authorizeBody.payment_method
    ) {
      return res.status(400).json({
        message: 'amount, currency_code, and payment_method are required for authorize.',
      });
    }

    const authorization = await provider.authorizePayment({
      amount: authorizeBody.amount,
      currency_code: authorizeBody.currency_code,
      payment_method: authorizeBody.payment_method,
      metadata: authorizeBody.metadata,
    });

    return res.status(200).json({
      operation: 'authorize',
      result: authorization,
    });
  }

  if (body.operation === 'capture') {
    const captureBody = body as Partial<AdminCapturePaymentBody>;

    if (!captureBody.transaction_id) {
      return res.status(400).json({
        message: 'transaction_id is required for capture.',
      });
    }

    const capture = await provider.capturePayment({
      transaction_id: captureBody.transaction_id,
      amount: captureBody.amount,
      metadata: captureBody.metadata,
    });

    return res.status(200).json({
      operation: 'capture',
      result: capture,
    });
  }

  return res.status(400).json({
    message: `Unsupported operation \"${body.operation}\".`,
  });
}
