import { createHash } from 'crypto';

import { MedusaRequest, MedusaResponse } from '@medusajs/framework/http';

import { APPS_MODULE } from '../../../../../modules/apps';
import AppsModuleService from '../../../../../modules/apps/service';
import { AUDIT_LOG_MODULE } from '../../../../../modules/audit-log';
import AuditLogModuleService from '../../../../../modules/audit-log/service';

const WEBHOOK_MAX_SKEW_MS = 5 * 60 * 1000;
const WEBHOOK_NONCE_TTL_MS = 10 * 60 * 1000;

const seenWebhookNonces = new Map<string, number>();

function normalizeHeaderValue(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) {
    return value[0];
  }

  return typeof value === 'string' ? value : undefined;
}

function cleanupExpiredNonces(now: number) {
  for (const [key, expiresAt] of seenWebhookNonces.entries()) {
    if (expiresAt <= now) {
      seenWebhookNonces.delete(key);
    }
  }
}

function parseTimestamp(value: string): number | null {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return null;
  }

  if (parsed > 1_000_000_000_000) {
    return Math.trunc(parsed);
  }

  return Math.trunc(parsed * 1000);
}

async function auditWebhookFailure(req: MedusaRequest, appId: string, reason: string) {
  try {
    const auditLogService: AuditLogModuleService = req.scope.resolve(AUDIT_LOG_MODULE);
    const tenantId = normalizeHeaderValue(req.headers['x-tenant-id'])?.trim() || 'system';
    const nonce = normalizeHeaderValue(req.headers['x-app-nonce'])?.trim() || null;
    const timestamp = normalizeHeaderValue(req.headers['x-app-timestamp'])?.trim() || null;
    const signature = normalizeHeaderValue(req.headers['x-app-signature'])?.trim() || null;
    const forwardedFor = normalizeHeaderValue(req.headers['x-forwarded-for']);
    const ip = forwardedFor?.split(',')[0]?.trim() || req.ip || 'unknown';
    const payloadFingerprint = createHash('sha256')
      .update(typeof req.rawBody === 'string' ? req.rawBody : JSON.stringify(req.body || {}))
      .digest('hex');

    await auditLogService.recordEvent({
      actor: 'webhook',
      tenant_id: tenantId,
      action: 'app_webhook_verification_failed',
      resource_id: appId,
      payload: {
        reason,
        path: req.originalUrl,
        method: req.method,
        ip,
        nonce,
        timestamp,
        has_signature: Boolean(signature),
        payload_fingerprint: payloadFingerprint,
      },
    });
  } catch (error) {
    console.error('Failed to persist webhook verification audit event.', error);
  }
}

export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const appId = req.params?.app_id;
  const signature = normalizeHeaderValue(req.headers['x-app-signature'])?.trim();
  const nonce = normalizeHeaderValue(req.headers['x-app-nonce'])?.trim();
  const timestampHeader = normalizeHeaderValue(req.headers['x-app-timestamp'])?.trim();
  const rawBody = typeof req.rawBody === 'string' ? req.rawBody : JSON.stringify(req.body || {});

  if (!appId) {
    await auditWebhookFailure(req, 'unknown', 'missing_app_id');
    return res.status(400).json({ message: 'app_id route parameter is required.' });
  }

  if (!signature) {
    await auditWebhookFailure(req, appId, 'missing_signature');
    return res.status(401).json({ message: 'x-app-signature header is required.' });
  }

  if (!nonce) {
    await auditWebhookFailure(req, appId, 'missing_nonce');
    return res.status(401).json({ message: 'x-app-nonce header is required.' });
  }

  if (!timestampHeader) {
    await auditWebhookFailure(req, appId, 'missing_timestamp');
    return res.status(401).json({ message: 'x-app-timestamp header is required.' });
  }

  const timestampMs = parseTimestamp(timestampHeader);
  if (!timestampMs) {
    await auditWebhookFailure(req, appId, 'invalid_timestamp');
    return res.status(401).json({ message: 'x-app-timestamp must be a unix timestamp (seconds or milliseconds).' });
  }

  const now = Date.now();
  const isStale = Math.abs(now - timestampMs) > WEBHOOK_MAX_SKEW_MS;

  if (isStale) {
    await auditWebhookFailure(req, appId, 'stale_timestamp');
    return res.status(401).json({ message: 'Webhook timestamp is outside the accepted time window.' });
  }

  cleanupExpiredNonces(now);
  const nonceKey = `${appId}:${nonce}`;

  if (seenWebhookNonces.has(nonceKey)) {
    await auditWebhookFailure(req, appId, 'replayed_nonce');
    return res.status(409).json({ message: 'Replay detected for nonce.' });
  }

  const appsService: AppsModuleService = req.scope.resolve(APPS_MODULE);
  const isValid = await appsService.verifyInboundWebhook(appId, rawBody, signature, {
    nonce,
    timestamp: timestampHeader,
  });

  if (!isValid) {
    await auditWebhookFailure(req, appId, 'invalid_signature');
    return res.status(401).json({ message: 'Invalid webhook signature.' });
  }

  seenWebhookNonces.set(nonceKey, now + WEBHOOK_NONCE_TTL_MS);

  res.status(202).json({
    message: 'Webhook accepted.',
    app_id: appId,
    payload: req.body || {},
  });
}
