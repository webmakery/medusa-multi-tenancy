import type { MedusaNextFunction, MedusaRequest, MedusaResponse } from '@medusajs/framework';

import { APPS_MODULE } from '.';
import AppsModuleService from './service';

export async function appWebhookSignatureVerificationMiddleware(
  req: MedusaRequest,
  res: MedusaResponse,
  next: MedusaNextFunction
) {
  const appId = req.params?.app_id;
  const signature = req.headers['x-app-signature'];

  if (!appId) {
    return res.status(400).json({ message: 'app_id route parameter is required.' });
  }

  if (typeof signature !== 'string' || !signature.trim()) {
    return res.status(401).json({ message: 'x-app-signature header is required.' });
  }

  const rawBody =
    req.rawBody instanceof Buffer
      ? req.rawBody
      : typeof req.rawBody === 'string'
        ? Buffer.from(req.rawBody)
        : Buffer.from(JSON.stringify(req.body || {}));

  const appsModuleService: AppsModuleService = req.scope.resolve(APPS_MODULE);
  const isValid = await appsModuleService.verifyInboundWebhook(appId, rawBody, signature);

  if (!isValid) {
    return res.status(401).json({ message: 'Invalid webhook signature.' });
  }

  next();
}
