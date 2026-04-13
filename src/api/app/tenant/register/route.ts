import type { MedusaRequest, MedusaResponse } from '@medusajs/framework/http';

export async function GET(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  const params = new URLSearchParams();

  for (const [key, value] of Object.entries(req.query || {})) {
    if (Array.isArray(value)) {
      value.forEach((entry) => {
        if (typeof entry === 'string') {
          params.append(key, entry);
        }
      });
      continue;
    }

    if (typeof value === 'string') {
      params.set(key, value);
      continue;
    }

    if (typeof value === 'number' || typeof value === 'boolean') {
      params.set(key, String(value));
    }
  }

  params.set('intent', 'register');

  const redirectPath = `/app/login${params.toString() ? `?${params.toString()}` : ''}`;
  res.redirect(302, redirectPath);
}
