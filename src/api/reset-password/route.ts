import { MedusaRequest, MedusaResponse } from '@medusajs/framework/http';
import { Modules } from '@medusajs/framework/utils';
import type { IAuthModuleService } from '@medusajs/types';

interface ResetPasswordBody {
  token?: string;
  password?: string;
}

export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const body = (req.body || {}) as ResetPasswordBody;

  if (!body.token?.trim() || !body.password?.trim()) {
    return res.status(400).json({ message: 'token and password are required' });
  }

  if (body.password.trim().length < 8) {
    return res.status(400).json({ message: 'password must be at least 8 characters' });
  }

  const authService = req.scope.resolve(Modules.AUTH) as IAuthModuleService;
  const updateResult = await authService.updateProvider('emailpass', {
    entity_id: body.token.trim(),
    password: body.password.trim(),
  });

  if (!updateResult.success) {
    return res.status(400).json({ message: updateResult.error || 'Invalid or expired reset token.' });
  }

  return res.status(200).json({ status: 'password_updated' });
}
