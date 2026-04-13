import { defineWidgetConfig } from '@medusajs/admin-sdk';
import { Button, FocusModal, Heading, Input, Label, Text } from '@medusajs/ui';
import { FormEvent, useMemo, useState } from 'react';

const DEFAULT_TOKEN_STORAGE_KEY = 'medusa_auth_token';

interface SignupResponse {
  verification?: {
    token?: string;
  };
  message?: string;
}

interface VerifyResponse {
  token?: string;
  token_storage_key?: string;
  auth?: {
    token?: string;
    storage_key?: string;
  };
  message?: string;
}

const TenantSelfRegistrationLoginWidget = () => {
  const [open, setOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState({
    name: '',
    slug: '',
    firstName: '',
    lastName: '',
    email: '',
    password: '',
    confirmPassword: '',
  });

  const publishableKey = useMemo(() => import.meta.env.VITE_MEDUSA_PUBLISHABLE_KEY || '', []);

  const updateField = (field: keyof typeof form, value: string) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  const resetForm = () => {
    setForm({
      name: '',
      slug: '',
      firstName: '',
      lastName: '',
      email: '',
      password: '',
      confirmPassword: '',
    });
    setError('');
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');

    if (!form.name.trim()) {
      setError('Workspace name is required.');
      return;
    }

    if (!form.email.trim()) {
      setError('Email is required.');
      return;
    }

    if (!form.password || form.password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }

    if (form.password !== form.confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setIsSubmitting(true);

    try {
      const storeHeaders: HeadersInit = {
        'Content-Type': 'application/json',
        'x-publishable-api-key': publishableKey,
      };

      const signupResponse = await fetch('/store/tenants/signup', {
        method: 'POST',
        credentials: 'include',
        headers: storeHeaders,
        body: JSON.stringify({
          name: form.name.trim(),
          slug: form.slug.trim() || undefined,
          first_name: form.firstName.trim() || undefined,
          last_name: form.lastName.trim() || undefined,
          email: form.email.trim(),
          password: form.password,
        }),
      });

      const signupBody = (await signupResponse.json().catch(() => ({}))) as SignupResponse;

      if (!signupResponse.ok) {
        throw new Error(signupBody.message || 'Unable to create workspace.');
      }

      const verificationToken = signupBody.verification?.token;

      if (!verificationToken) {
        throw new Error('Unable to verify email for this signup.');
      }

      const verifyResponse = await fetch('/store/tenants/verify-email', {
        method: 'POST',
        credentials: 'include',
        headers: storeHeaders,
        body: JSON.stringify({ token: verificationToken }),
      });

      const verifyBody = (await verifyResponse.json().catch(() => ({}))) as VerifyResponse;

      if (!verifyResponse.ok) {
        throw new Error(verifyBody.message || 'Unable to verify email.');
      }

      const token = verifyBody.auth?.token || verifyBody.token;
      const storageKey = verifyBody.auth?.storage_key || verifyBody.token_storage_key || DEFAULT_TOKEN_STORAGE_KEY;

      if (token) {
        localStorage.setItem(storageKey, token);
      }

      window.location.assign('/app/onboarding-status');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to create workspace.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <FocusModal open={open} onOpenChange={setOpen}>
      <FocusModal.Trigger asChild>
        <Button type="button" variant="secondary" className="mt-4 w-full" onClick={() => setError('')}>
          Create workspace
        </Button>
      </FocusModal.Trigger>
      <FocusModal.Content className="mx-auto my-8 h-fit w-full max-w-lg">
        <form onSubmit={submit}>
          <FocusModal.Header>
            <Heading level="h2">Create workspace</Heading>
          </FocusModal.Header>
          <FocusModal.Body className="p-6">
            <div className="grid grid-cols-1 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="tenant_name">Workspace name</Label>
                <Input id="tenant_name" value={form.name} onChange={(event) => updateField('name', event.target.value)} required />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="tenant_slug">Workspace slug (optional)</Label>
                <Input id="tenant_slug" value={form.slug} onChange={(event) => updateField('slug', event.target.value)} />
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="grid gap-2">
                  <Label htmlFor="first_name">First name</Label>
                  <Input id="first_name" value={form.firstName} onChange={(event) => updateField('firstName', event.target.value)} required />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="last_name">Last name</Label>
                  <Input id="last_name" value={form.lastName} onChange={(event) => updateField('lastName', event.target.value)} required />
                </div>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="owner_email">Email</Label>
                <Input id="owner_email" type="email" value={form.email} onChange={(event) => updateField('email', event.target.value)} required />
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="grid gap-2">
                  <Label htmlFor="owner_password">Password</Label>
                  <Input
                    id="owner_password"
                    type="password"
                    value={form.password}
                    onChange={(event) => updateField('password', event.target.value)}
                    required
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="owner_confirm_password">Confirm password</Label>
                  <Input
                    id="owner_confirm_password"
                    type="password"
                    value={form.confirmPassword}
                    onChange={(event) => updateField('confirmPassword', event.target.value)}
                    required
                  />
                </div>
              </div>

              {error ? <Text className="text-ui-fg-error">{error}</Text> : null}
            </div>
          </FocusModal.Body>
          <FocusModal.Footer>
            <FocusModal.Close asChild>
              <Button type="button" variant="secondary" onClick={resetForm}>
                Cancel
              </Button>
            </FocusModal.Close>
            <Button type="submit" isLoading={isSubmitting}>
              Create workspace
            </Button>
          </FocusModal.Footer>
        </form>
      </FocusModal.Content>
    </FocusModal>
  );
};

export const config = defineWidgetConfig({
  zone: 'login.after',
});

export default TenantSelfRegistrationLoginWidget;
