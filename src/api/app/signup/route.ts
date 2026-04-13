import { MedusaRequest, MedusaResponse } from '@medusajs/framework/http';

export { POST } from '../../signup/route';

export async function GET(_req: MedusaRequest, res: MedusaResponse) {
  const page = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Tenant signup</title>
    <style>
      body { font-family: Inter, system-ui, -apple-system, Segoe UI, Roboto, sans-serif; background: #f5f5f5; margin: 0; }
      .wrap { min-height: 100vh; display: flex; align-items: center; justify-content: center; padding: 24px; }
      .card { width: 100%; max-width: 560px; background: #fff; border: 1px solid #e6e6e6; border-radius: 10px; padding: 24px; }
      h1 { font-size: 24px; margin: 0 0 8px; }
      p { color: #525252; margin: 0 0 20px; }
      form { display: grid; gap: 12px; }
      label { font-size: 14px; color: #262626; display: grid; gap: 6px; }
      input { border: 1px solid #d4d4d4; border-radius: 8px; padding: 10px 12px; font-size: 14px; }
      .row { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
      button { margin-top: 6px; border: 0; background: #171717; color: white; border-radius: 8px; padding: 11px 14px; font-size: 14px; cursor: pointer; }
      .msg { font-size: 13px; margin-top: 6px; }
      .error { color: #b91c1c; }
      .ok { color: #166534; }
    </style>
  </head>
  <body>
    <div class="wrap">
      <div class="card">
        <h1>Create tenant workspace</h1>
        <p>Register your tenant account.</p>
        <form id="signup-form">
          <label>Workspace name<input name="name" required /></label>
          <label>Workspace slug (optional)<input name="slug" /></label>
          <div class="row">
            <label>First name (optional)<input name="first_name" /></label>
            <label>Last name (optional)<input name="last_name" /></label>
          </div>
          <label>Email<input type="email" name="email" required /></label>
          <label>Password<input type="password" name="password" minlength="8" required /></label>
          <button type="submit">Register workspace</button>
          <div id="message" class="msg"></div>
        </form>
      </div>
    </div>
    <script>
      const form = document.getElementById('signup-form');
      const message = document.getElementById('message');
      form.addEventListener('submit', async (event) => {
        event.preventDefault();
        message.className = 'msg';
        message.textContent = '';
        const formData = new FormData(form);
        const payload = {
          name: String(formData.get('name') || '').trim(),
          slug: String(formData.get('slug') || '').trim() || undefined,
          first_name: String(formData.get('first_name') || '').trim() || undefined,
          last_name: String(formData.get('last_name') || '').trim() || undefined,
          email: String(formData.get('email') || '').trim().toLowerCase(),
          password: String(formData.get('password') || ''),
        };

        try {
          const response = await fetch('/app/signup', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          });
          const data = await response.json().catch(() => ({}));

          if (!response.ok) {
            throw new Error(data.message || 'Could not complete signup.');
          }

          message.className = 'msg ok';
          message.textContent = 'Signup submitted. Please continue with email verification.';
          form.reset();
        } catch (error) {
          message.className = 'msg error';
          message.textContent = error.message || 'Could not complete signup.';
        }
      });
    </script>
  </body>
</html>`;

  res.setHeader('content-type', 'text/html; charset=utf-8');
  return res.status(200).send(page);
}
