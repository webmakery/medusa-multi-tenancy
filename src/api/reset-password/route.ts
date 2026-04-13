import { MedusaRequest, MedusaResponse } from '@medusajs/framework/http';

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

  return res.status(200).json({ status: 'password_updated' });
}
