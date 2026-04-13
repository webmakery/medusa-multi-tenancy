import { MedusaRequest, MedusaResponse } from '@medusajs/framework/http';
import { Modules } from '@medusajs/framework/utils';
import type { IAuthModuleService } from '@medusajs/types';

interface LoginBody {
  email?: string;
  password?: string;
}

export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const body = (req.body || {}) as LoginBody;

  if (!body.email?.trim() || !body.password?.trim()) {
    return res.status(400).json({ message: 'email and password are required' });
  }

  const authService = req.scope.resolve(Modules.AUTH) as IAuthModuleService;
  const authResult = await authService.authenticate('emailpass', {
    url: req.url,
    headers: req.headers as Record<string, string>,
    query: req.query as Record<string, string>,
    body: {
      email: body.email.trim().toLowerCase(),
      password: body.password,
    },
    protocol: req.protocol,
  });

  if (!authResult.success) {
    return res.status(401).json({ message: authResult.error || 'Invalid email or password.' });
  }

  return res.status(200).json({
    status: 'authenticated',
    auth_identity_id: authResult.authIdentity?.id,
  });
}
