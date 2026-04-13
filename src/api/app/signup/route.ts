import type { MedusaRequest, MedusaResponse } from '@medusajs/framework';

export { POST } from '../../signup/route';

export async function GET(_req: MedusaRequest, res: MedusaResponse) {
  res.setHeader('content-type', 'text/html; charset=utf-8');

  return res.status(200).send(`<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Tenant signup</title>
    <style>
      :root {
        color-scheme: light;
        font-family: Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      }

      body {
        margin: 0;
        background: #f5f5f5;
        color: #111827;
      }

      main {
        min-height: 100vh;
        display: flex;
        justify-content: center;
        align-items: flex-start;
        padding: 56px 16px;
      }

      .card {
        width: 100%;
        max-width: 560px;
        background: #fff;
        border: 1px solid #e5e7eb;
        border-radius: 12px;
        padding: 24px;
      }

      h1 {
        margin: 0;
        font-size: 24px;
        line-height: 32px;
      }

      p {
        margin: 8px 0 0;
        color: #6b7280;
      }

      form {
        margin-top: 24px;
        display: grid;
        gap: 14px;
      }

      .row {
        display: grid;
        gap: 8px;
      }

      .row-split {
        display: grid;
        gap: 12px;
        grid-template-columns: repeat(2, minmax(0, 1fr));
      }

      label {
        font-size: 14px;
      }

      input {
        font: inherit;
        padding: 10px 12px;
        border: 1px solid #d1d5db;
        border-radius: 8px;
      }

      button {
        font: inherit;
        margin-top: 4px;
        border: none;
        border-radius: 8px;
        background: #111827;
        color: white;
        padding: 10px 16px;
        cursor: pointer;
      }

      button[disabled] {
        opacity: 0.65;
        cursor: default;
      }

      .message {
        margin-top: 4px;
        font-size: 14px;
      }

      .error {
        color: #b91c1c;
      }

      .success {
        color: #166534;
      }

      @media (max-width: 680px) {
        .row-split {
          grid-template-columns: 1fr;
        }
      }
    </style>
  </head>
  <body>
    <main>
      <section class="card">
        <h1>Create tenant workspace</h1>
        <p>Register your tenant account with your workspace and owner details.</p>

        <form id="signup-form">
          <div class="row">
            <label for="name">Workspace name</label>
            <input id="name" name="name" required />
          </div>

          <div class="row">
            <label for="slug">Workspace slug (optional)</label>
            <input id="slug" name="slug" />
          </div>

          <div class="row-split">
            <div class="row">
              <label for="first_name">First name (optional)</label>
              <input id="first_name" name="first_name" />
            </div>

            <div class="row">
              <label for="last_name">Last name (optional)</label>
              <input id="last_name" name="last_name" />
            </div>
          </div>

          <div class="row">
            <label for="email">Email</label>
            <input id="email" name="email" type="email" autocomplete="email" required />
          </div>

          <div class="row">
            <label for="password">Password</label>
            <input id="password" name="password" type="password" autocomplete="new-password" required />
          </div>

          <div id="feedback" class="message" role="status" aria-live="polite"></div>
          <button id="submit" type="submit">Register workspace</button>
        </form>
      </section>
    </main>

    <script>
      const form = document.getElementById('signup-form');
      const submitButton = document.getElementById('submit');
      const feedback = document.getElementById('feedback');

      form.addEventListener('submit', async (event) => {
        event.preventDefault();
        feedback.textContent = '';
        feedback.className = 'message';

        const formData = new FormData(form);
        const payload = {
          name: String(formData.get('name') || '').trim(),
          slug: String(formData.get('slug') || '').trim() || undefined,
          first_name: String(formData.get('first_name') || '').trim() || undefined,
          last_name: String(formData.get('last_name') || '').trim() || undefined,
          email: String(formData.get('email') || '').trim().toLowerCase(),
          password: String(formData.get('password') || ''),
        };

        if (!payload.name || !payload.email || !payload.password) {
          feedback.textContent = 'Workspace name, email, and password are required.';
          feedback.className = 'message error';
          return;
        }

        submitButton.disabled = true;
        submitButton.textContent = 'Registering...';

        try {
          const response = await fetch('/app/signup', {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          });

          const result = await response.json().catch(() => ({}));

          if (!response.ok) {
            throw new Error(result.message || 'Could not complete signup.');
          }

          const expires = result.verification && result.verification.expires_at
            ? ' Verification expires at ' + new Date(result.verification.expires_at).toLocaleString() + '.'
            : '';

          feedback.textContent = 'Signup submitted. Check your email to verify the account.' + expires;
          feedback.className = 'message success';
          form.reset();
        } catch (error) {
          feedback.textContent = error instanceof Error ? error.message : 'Could not complete signup.';
          feedback.className = 'message error';
        } finally {
          submitButton.disabled = false;
          submitButton.textContent = 'Register workspace';
        }
      });
    </script>
  </body>
</html>`);
}
