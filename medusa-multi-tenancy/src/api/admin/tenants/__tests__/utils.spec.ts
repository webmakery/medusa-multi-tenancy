import { isValidEmail, slugifyTenantSlug, validateCreateTenantBody } from '../utils';

describe('tenant onboarding utils', () => {
  describe('slugifyTenantSlug', () => {
    it('normalizes mixed input to kebab-case', () => {
      expect(slugifyTenantSlug('  My Awesome Store  ')).toBe('my-awesome-store');
    });

    it('enforces max length of 60 chars', () => {
      const input = 'a'.repeat(100);
      expect(slugifyTenantSlug(input)).toHaveLength(60);
    });
  });

  describe('isValidEmail', () => {
    it('accepts valid emails', () => {
      expect(isValidEmail('owner@example.com')).toBe(true);
    });

    it('rejects invalid emails', () => {
      expect(isValidEmail('owner@example')).toBe(false);
      expect(isValidEmail('bad-value')).toBe(false);
    });
  });

  describe('validateCreateTenantBody', () => {
    it('returns normalized payload when valid', () => {
      const result = validateCreateTenantBody({
        name: 'Acme Store',
        owner_email: 'Owner@Example.com',
      });

      expect(result.valid).toBe(true);
      expect(result.normalized).toEqual({
        name: 'Acme Store',
        slug: 'acme-store',
        ownerEmail: 'owner@example.com',
      });
    });

    it('requires name and owner_email', () => {
      expect(validateCreateTenantBody({ owner_email: 'owner@example.com' })).toEqual({
        valid: false,
        message: 'name is required',
      });

      expect(validateCreateTenantBody({ name: 'Acme' })).toEqual({
        valid: false,
        message: 'owner_email is required',
      });
    });

    it('rejects invalid owner_email', () => {
      expect(
        validateCreateTenantBody({
          name: 'Acme',
          owner_email: 'not-an-email',
        })
      ).toEqual({
        valid: false,
        message: 'owner_email must be a valid email',
      });
    });
  });
});
