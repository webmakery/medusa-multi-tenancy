import { Container, Heading, Text } from '@medusajs/ui';
import { ReactNode } from 'react';

type AuthPageShellProps = {
  title: string;
  description: string;
  children: ReactNode;
};

const AuthPageShell = ({ title, description, children }: AuthPageShellProps) => {
  return (
    <div className="min-h-full flex items-center justify-center p-6">
      <Container className="w-full max-w-md p-6">
        <Heading level="h1">{title}</Heading>
        <Text size="small" className="mt-2 text-ui-fg-subtle">
          {description}
        </Text>
        <div className="mt-6">{children}</div>
      </Container>
    </div>
  );
};

export default AuthPageShell;
