import { defineRouteConfig } from '@medusajs/admin-sdk';
import { Button, Container, Heading, Input, Label, Text } from '@medusajs/ui';
import { FormEvent, useState } from 'react';

interface SignupResponse {
  status?: string;
  message?: string;
  next_step?: string;
  verification?: {
    expires_at?: string;
  };
}

const SignupPage = () => {
  const [formState, setFormState] = useState({
    name: '',
    slug: '',
    first_name: '',
    last_name: '',
    email: '',
    password: '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState<SignupResponse | null>(null);

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');
    setSuccess(null);

    if (!formState.name.trim() || !formState.email.trim() || !formState.password.trim()) {
      setError('Workspace name, email, and password are required.');
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch('/app/signup', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: formState.name.trim(),
          slug: formState.slug.trim() || undefined,
          first_name: formState.first_name.trim() || undefined,
          last_name: formState.last_name.trim() || undefined,
          email: formState.email.trim().toLowerCase(),
          password: formState.password,
        }),
      });

      const payload = (await response.json().catch(() => ({}))) as SignupResponse & { message?: string };

      if (!response.ok) {
        throw new Error(payload.message || 'Could not complete signup.');
      }

      setSuccess(payload);
      setFormState({
        name: '',
        slug: '',
        first_name: '',
        last_name: '',
        email: '',
        password: '',
      });
    } catch (submitError) {
      setError((submitError as Error).message || 'Could not complete signup.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex w-full justify-center px-4 py-16">
      <Container className="w-full max-w-xl p-8">
        <Heading level="h1">Create tenant workspace</Heading>
        <Text size="small" className="mt-2 text-ui-fg-subtle">
          Register your tenant account using the same auth entrypoint as admin users.
        </Text>

        <form className="mt-6 grid gap-4" onSubmit={onSubmit}>
          <div className="grid gap-2">
            <Label htmlFor="workspace-name">Workspace name</Label>
            <Input
              id="workspace-name"
              value={formState.name}
              onChange={(event) => setFormState((current) => ({ ...current, name: event.target.value }))}
              required
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="workspace-slug">Workspace slug (optional)</Label>
            <Input
              id="workspace-slug"
              value={formState.slug}
              onChange={(event) => setFormState((current) => ({ ...current, slug: event.target.value }))}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label htmlFor="first-name">First name (optional)</Label>
              <Input
                id="first-name"
                value={formState.first_name}
                onChange={(event) => setFormState((current) => ({ ...current, first_name: event.target.value }))}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="last-name">Last name (optional)</Label>
              <Input
                id="last-name"
                value={formState.last_name}
                onChange={(event) => setFormState((current) => ({ ...current, last_name: event.target.value }))}
              />
            </div>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              value={formState.email}
              onChange={(event) => setFormState((current) => ({ ...current, email: event.target.value }))}
              required
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              autoComplete="new-password"
              value={formState.password}
              onChange={(event) => setFormState((current) => ({ ...current, password: event.target.value }))}
              required
            />
          </div>

          {error ? (
            <Text size="small" className="text-ui-fg-error">
              {error}
            </Text>
          ) : null}

          {success?.status === 'verification_required' ? (
            <Text size="small" className="text-ui-fg-subtle">
              Signup submitted. Check your email verification step before continuing.{' '}
              {success.verification?.expires_at ? `Verification expires at ${new Date(success.verification.expires_at).toLocaleString()}.` : ''}
            </Text>
          ) : null}

          <Button type="submit" isLoading={isSubmitting}>
            Register workspace
          </Button>
        </form>
      </Container>
    </div>
  );
};

export const config = defineRouteConfig({
  label: 'Tenant signup',
  rank: 999,
});

export default SignupPage;
