const TENANT_KEY_PREFIX = 'tenant';
const DELIMITER = '::';

type TenantInvalidator = (tenantId: string) => void;

const tenantInvalidators = new Set<TenantInvalidator>();

export function buildTenantScopedKey(tenantId: string, ...parts: Array<string | number>): string {
  const normalizedTenantId = tenantId?.trim() || 'system';
  const normalizedParts = parts.map((part) => String(part).trim()).filter(Boolean);

  return [TENANT_KEY_PREFIX, normalizedTenantId, ...normalizedParts].join(DELIMITER);
}

export function isTenantScopedKey(key: string, tenantId: string): boolean {
  return key.startsWith(`${buildTenantScopedKey(tenantId)}${DELIMITER}`) || key === buildTenantScopedKey(tenantId);
}

export function registerTenantRuntimeInvalidator(invalidator: TenantInvalidator): () => void {
  tenantInvalidators.add(invalidator);

  return () => {
    tenantInvalidators.delete(invalidator);
  };
}

export function invalidateTenantRuntimeState(tenantId: string): void {
  for (const invalidator of tenantInvalidators) {
    invalidator(tenantId);
  }
}

export function purgeTenantEntriesFromMap<T>(map: Map<string, T>, tenantId: string): void {
  for (const key of map.keys()) {
    if (isTenantScopedKey(key, tenantId)) {
      map.delete(key);
    }
  }
}

export function purgeTenantEntriesFromSet(set: Set<string>, tenantId: string): void {
  for (const key of set.values()) {
    if (isTenantScopedKey(key, tenantId)) {
      set.delete(key);
    }
  }
}

export class TenantScopedDocumentIndex<TDocument> {
  private readonly documents = new Map<string, Map<string, TDocument>>();

  upsert(tenantId: string, documentId: string, document: TDocument): void {
    const key = tenantId?.trim() || 'system';
    const existingTenantDocuments = this.documents.get(key) || new Map<string, TDocument>();

    existingTenantDocuments.set(documentId, document);
    this.documents.set(key, existingTenantDocuments);
  }

  query(tenantId: string, predicate?: (document: TDocument) => boolean): TDocument[] {
    const key = tenantId?.trim() || 'system';
    const tenantDocuments = this.documents.get(key);

    if (!tenantDocuments) {
      return [];
    }

    const rows = [...tenantDocuments.values()];
    if (!predicate) {
      return rows;
    }

    return rows.filter(predicate);
  }

  invalidateTenant(tenantId: string): void {
    const key = tenantId?.trim() || 'system';
    this.documents.delete(key);
  }
}
