import { randomUUID } from 'crypto';

import { MedusaRequest, MedusaResponse } from '@medusajs/framework/http';

interface ForgotPasswordBody {
  email?: string;
}

export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const body = (req.body || {}) as ForgotPasswordBody;

  if (!body.email?.trim()) {
    return res.status(400).json({ message: 'email is required' });
  }

  return res.status(200).json({
    status: 'password_reset_requested',
    reset_token: randomUUID(),
  });
}
