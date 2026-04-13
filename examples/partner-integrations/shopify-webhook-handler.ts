import { createHmac, timingSafeEqual } from 'crypto';

const SEEN_EVENTS = new Map<string, number>();
const EVENT_TTL_MS = 10 * 60 * 1000;

function verifyShopifySignature(rawBody: string, providedHeader: string, sharedSecret: string): boolean {
  const expected = createHmac('sha256', sharedSecret).update(rawBody).digest('base64');
  const expectedBuffer = Buffer.from(expected);
  const providedBuffer = Buffer.from(providedHeader);

  return expectedBuffer.length === providedBuffer.length && timingSafeEqual(expectedBuffer, providedBuffer);
}

function replayKey(tenantId: string, topic: string, webhookId: string): string {
  return `${tenantId}:${topic}:${webhookId}`;
}

function cleanup(now: number) {
  for (const [key, expiresAt] of SEEN_EVENTS.entries()) {
    if (expiresAt <= now) SEEN_EVENTS.delete(key);
  }
}

export async function handleShopifyWebhook(params: {
  tenantId: string;
  topic: string;
  webhookId: string;
  hmacHeader: string;
  rawBody: string;
  sharedSecret: string;
  process: () => Promise<void>;
}) {
  const { tenantId, topic, webhookId, hmacHeader, rawBody, sharedSecret, process } = params;

  if (!verifyShopifySignature(rawBody, hmacHeader, sharedSecret)) {
    throw new Error('Invalid Shopify signature.');
  }

  const now = Date.now();
  cleanup(now);

  const key = replayKey(tenantId, topic, webhookId);
  if (SEEN_EVENTS.has(key)) {
    return { accepted: false, reason: 'duplicate_replay' };
  }

  SEEN_EVENTS.set(key, now + EVENT_TTL_MS);
  await process();

  return { accepted: true, idempotencyKey: `${topic}:${webhookId}` };
}
