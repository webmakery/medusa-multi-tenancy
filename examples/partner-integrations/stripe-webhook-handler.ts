import { createHmac, timingSafeEqual } from 'crypto';

type DeadLetterWriter = (entry: { tenantId: string; provider: 'stripe'; reason: string; payload: string }) => Promise<void>;
type EventProcessor = (event: any) => Promise<void>;

const MAX_ATTEMPTS = 3;

function verifyStripeSignature(rawBody: string, signatureHeader: string, secret: string): boolean {
  const [, provided = ''] = signatureHeader.split('v1=');
  const expected = createHmac('sha256', secret).update(rawBody).digest('hex');

  const expectedBuffer = Buffer.from(expected, 'hex');
  const providedBuffer = Buffer.from(provided.trim(), 'hex');

  return expectedBuffer.length === providedBuffer.length && timingSafeEqual(expectedBuffer, providedBuffer);
}

export async function handleStripeWebhook(params: {
  tenantId: string;
  rawBody: string;
  signatureHeader: string;
  webhookSecret: string;
  processEvent: EventProcessor;
  writeDeadLetter: DeadLetterWriter;
}) {
  const { tenantId, rawBody, signatureHeader, webhookSecret, processEvent, writeDeadLetter } = params;

  if (!verifyStripeSignature(rawBody, signatureHeader, webhookSecret)) {
    throw new Error('Invalid Stripe signature.');
  }

  const event = JSON.parse(rawBody);

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    try {
      await processEvent(event);
      return { accepted: true, attempt };
    } catch (error: any) {
      if (attempt === MAX_ATTEMPTS) {
        await writeDeadLetter({
          tenantId,
          provider: 'stripe',
          reason: error?.message || 'processing_failed',
          payload: rawBody,
        });
      }
    }
  }

  return { accepted: false, attempt: MAX_ATTEMPTS };
}
