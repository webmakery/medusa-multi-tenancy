import { Button, Container, Heading, Input, Label, Text } from '@medusajs/ui';
import { FormEvent, useState } from 'react';
import { Link } from 'react-router-dom';

interface LoginResponse {
  status: string;
  message?: string;
  redirect_to?: string;
}

const LoginPage = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');
    setIsSubmitting(true);

    try {
      const response = await fetch('/login', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
      });

      const payload = (await response.json()) as LoginResponse;

      if (!response.ok) {
        setError(payload.message || 'Login failed. Please check your credentials.');
        return;
      }

      const targetPath = payload.redirect_to || '/';
      window.location.assign(`/app${targetPath}`);
    } catch (err) {
      setError((err as Error).message || 'Login failed. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-ui-bg-subtle p-4">
      <Container className="w-full max-w-md p-6">
        <Heading level="h1">Tenant login</Heading>
        <Text className="mt-2 text-ui-fg-subtle" size="small">
          Sign in to manage your workspace.
        </Text>

        <form onSubmit={onSubmit} className="mt-6 flex flex-col gap-y-4">
          <div className="flex flex-col gap-y-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} required />
          </div>

          <div className="flex flex-col gap-y-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
            />
          </div>

          {error ? <Text className="text-ui-fg-error">{error}</Text> : null}

          <Button type="submit" isLoading={isSubmitting}>
            {isSubmitting ? 'Signing in...' : 'Sign in'}
          </Button>
        </form>

        <Text className="mt-4" size="small">
          Need an account? <Link to="/signup" className="text-ui-fg-interactive">Create one</Link>
        </Text>
      </Container>
    </div>
  );
};

export default LoginPage;
