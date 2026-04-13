import type { MedusaRequest, MedusaResponse } from '@medusajs/framework/http';

export { POST } from '../store/tenants/signup/route';

const PUBLIC_AUTH_SIGNUP_PATH = '/app/signup';

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const queryString = req.url.includes('?') ? req.url.slice(req.url.indexOf('?')) : '';
  return res.redirect(302, `${PUBLIC_AUTH_SIGNUP_PATH}${queryString}`);
}
