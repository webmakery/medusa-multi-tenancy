import { Button, Container, Heading, Input, Label, Text } from '@medusajs/ui';
import { FormEvent, useState } from 'react';
import { Link } from 'react-router-dom';

interface SignupResponse {
  status: string;
  message?: string;
  verification?: {
    token: string;
    expires_at: string;
  };
}

const SignupPage = () => {
  const [formState, setFormState] = useState({
    name: '',
    email: '',
    password: '',
    first_name: '',
    last_name: '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState<SignupResponse | null>(null);

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSubmitting(true);
    setError('');
    setSuccess(null);

    try {
      const response = await fetch('/signup', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
        },
        body: JSON.stringify(formState),
      });

      const payload = (await response.json()) as SignupResponse;

      if (!response.ok) {
        setError(payload.message || 'Could not complete signup. Please try again.');
        return;
      }

      setSuccess(payload);
      setFormState({ name: '', email: '', password: '', first_name: '', last_name: '' });
    } catch (err) {
      setError((err as Error).message || 'Could not complete signup. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-ui-bg-subtle p-4">
      <Container className="w-full max-w-xl p-6">
        <Heading level="h1">Create your tenant account</Heading>
        <Text className="mt-2 text-ui-fg-subtle" size="small">
          Register your workspace to start onboarding.
        </Text>

        <form onSubmit={onSubmit} className="mt-6 flex flex-col gap-y-4">
          <div className="flex flex-col gap-y-2">
            <Label htmlFor="name">Workspace name</Label>
            <Input
              id="name"
              value={formState.name}
              onChange={(event) => setFormState((current) => ({ ...current, name: event.target.value }))}
              required
            />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-y-2">
              <Label htmlFor="first_name">First name</Label>
              <Input
                id="first_name"
                value={formState.first_name}
                onChange={(event) => setFormState((current) => ({ ...current, first_name: event.target.value }))}
              />
            </div>
            <div className="flex flex-col gap-y-2">
              <Label htmlFor="last_name">Last name</Label>
              <Input
                id="last_name"
                value={formState.last_name}
                onChange={(event) => setFormState((current) => ({ ...current, last_name: event.target.value }))}
              />
            </div>
          </div>

          <div className="flex flex-col gap-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              value={formState.email}
              onChange={(event) => setFormState((current) => ({ ...current, email: event.target.value }))}
              required
            />
          </div>

          <div className="flex flex-col gap-y-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              value={formState.password}
              onChange={(event) => setFormState((current) => ({ ...current, password: event.target.value }))}
              required
              minLength={8}
            />
          </div>

          {error ? <Text className="text-ui-fg-error">{error}</Text> : null}
          {success ? (
            <Text className="text-ui-fg-interactive">
              Signup started. Check your email to verify your account.
              {success.verification?.token ? ' (Verification token issued successfully.)' : ''}
            </Text>
          ) : null}

          <Button type="submit" isLoading={isSubmitting}>
            {isSubmitting ? 'Creating account...' : 'Create account'}
          </Button>
        </form>

        <Text className="mt-4" size="small">
          Already registered? <Link to="/login" className="text-ui-fg-interactive">Log in</Link>
        </Text>
      </Container>
    </div>
  );
};

export default SignupPage;
