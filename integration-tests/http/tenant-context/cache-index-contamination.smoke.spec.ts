import {
  buildTenantScopedKey,
  invalidateTenantRuntimeState,
  registerTenantRuntimeInvalidator,
  TenantScopedDocumentIndex,
} from '../../../src/modules/tenant-context/runtime-state'

describe('tenant runtime cache/index isolation smoke tests', () => {
  it('prefixes tenant-scoped cache keys and invalidates only the targeted tenant entries', () => {
    const cache = new Map<string, string>()

    cache.set(buildTenantScopedKey('tenant-a', 'quota', 'reporting'), 'a')
    cache.set(buildTenantScopedKey('tenant-b', 'quota', 'reporting'), 'b')

    const unregister = registerTenantRuntimeInvalidator((tenantId) => {
      for (const key of [...cache.keys()]) {
        if (key.startsWith(buildTenantScopedKey(tenantId))) {
          cache.delete(key)
        }
      }
    })

    invalidateTenantRuntimeState('tenant-a')
    unregister()

    expect(cache.get(buildTenantScopedKey('tenant-a', 'quota', 'reporting'))).toBeUndefined()
    expect(cache.get(buildTenantScopedKey('tenant-b', 'quota', 'reporting'))).toBe('b')
  })

  it('separates indexed documents by tenant and enforces tenant-scoped reads', () => {
    const index = new TenantScopedDocumentIndex<{ id: string; label: string }>()

    index.upsert('tenant-a', 'doc-1', { id: 'doc-1', label: 'A' })
    index.upsert('tenant-b', 'doc-1', { id: 'doc-1', label: 'B' })

    const tenantADocuments = index.query('tenant-a')
    const tenantBDocuments = index.query('tenant-b')

    expect(tenantADocuments).toEqual([{ id: 'doc-1', label: 'A' }])
    expect(tenantBDocuments).toEqual([{ id: 'doc-1', label: 'B' }])
  })
})
