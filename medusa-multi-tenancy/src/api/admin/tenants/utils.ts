export interface CreateTenantBody {
  name?: string;
  slug?: string;
  owner_email?: string;
}

export function slugifyTenantSlug(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}

export function isValidEmail(input: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input);
}

export function validateCreateTenantBody(body: CreateTenantBody): {
  valid: boolean;
  message?: string;
  normalized?: { name: string; slug: string; ownerEmail: string };
} {
  if (!body.name?.trim()) {
    return { valid: false, message: 'name is required' };
  }

  if (!body.owner_email?.trim()) {
    return { valid: false, message: 'owner_email is required' };
  }

  const ownerEmail = body.owner_email.trim().toLowerCase();
  if (!isValidEmail(ownerEmail)) {
    return { valid: false, message: 'owner_email must be a valid email' };
  }

  const slug = slugifyTenantSlug(body.slug || body.name);
  if (!slug) {
    return { valid: false, message: 'Could not generate a valid slug from name/slug.' };
  }

  return {
    valid: true,
    normalized: {
      name: body.name.trim(),
      slug,
      ownerEmail,
    },
  };
}
