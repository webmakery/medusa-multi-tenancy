const MAX_ATTEMPTS = 4;

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function shouldRetry(status: number) {
  return status === 429 || status >= 500;
}

export async function forwardKlaviyoEvent(params: {
  tenantId: string;
  apiKey: string;
  event: Record<string, unknown>;
  endpoint: string;
  deadLetter: (entry: { tenantId: string; reason: string; payload: Record<string, unknown> }) => Promise<void>;
}) {
  const { tenantId, apiKey, event, endpoint, deadLetter } = params;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Klaviyo-API-Key ${apiKey}`,
      },
      body: JSON.stringify(event),
    });

    if (response.ok) {
      return { delivered: true, attempt };
    }

    if (attempt < MAX_ATTEMPTS && shouldRetry(response.status)) {
      await wait(250 * attempt);
      continue;
    }

    await deadLetter({
      tenantId,
      reason: `klaviyo_${response.status}`,
      payload: event,
    });

    return { delivered: false, attempt };
  }

  return { delivered: false, attempt: MAX_ATTEMPTS };
}
