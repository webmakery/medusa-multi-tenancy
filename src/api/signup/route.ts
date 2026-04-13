import type { MedusaRequest, MedusaResponse } from '@medusajs/framework/http';

export { POST } from '../store/tenants/signup/route';

export async function GET(_req: MedusaRequest, res: MedusaResponse) {
  return res.redirect(302, '/app/signup');
}
