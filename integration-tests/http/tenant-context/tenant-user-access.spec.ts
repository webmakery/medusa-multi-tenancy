import axios from 'axios'
import { randomUUID } from 'crypto'

jest.setTimeout(60 * 1000)

describe('Tenant user access resolution', () => {
  const API_URL = process.env.API_URL || 'http://localhost:9000'
  const SECRET_KEY =
    process.env.SECRET_API_KEY ||
    'sk_46b30bd85aae59eb041d307688c02a9b5dd5aa6dc7d6fb5fabc4c6f67a85fcf1'

  const authHeaders = {
    Authorization: `Basic ${SECRET_KEY}`,
    'Content-Type': 'application/json',
  }

  async function createTenant(seed: string, ownerEmail: string) {
    const response = await axios.post(
      `${API_URL}/admin/tenants`,
      { name: `Access Tenant ${seed}`, owner_email: ownerEmail },
      {
        headers: {
          ...authHeaders,
          'idempotency-key': randomUUID(),
        },
      }
    )

    return response.data.tenant.tenant_id as string
  }

  it('auto-creates and reuses tenant assignment for non-platform users', async () => {
    const email = `tenant-access-${Date.now()}@example.com`

    const first = await axios.get(`${API_URL}/admin/tenant-access/me`, {
      headers: {
        ...authHeaders,
        'x-user-email': email,
      },
    })

    expect(first.status).toBe(200)
    expect(first.data.role).toBe('tenant_admin')
    expect(first.data.is_platform_admin).toBe(false)
    expect(first.data.assigned_tenant_id).toBeDefined()

    const second = await axios.get(`${API_URL}/admin/tenant-access/me`, {
      headers: {
        ...authHeaders,
        'x-user-email': email,
      },
    })

    expect(second.status).toBe(200)
    expect(second.data.assigned_tenant_id).toBe(first.data.assigned_tenant_id)
    expect(second.data.role).toBe('tenant_admin')
    expect(second.data.is_platform_admin).toBe(false)
  })

  it('ignores x-tenant-id override for tenant users', async () => {
    const seed = Date.now().toString()
    const tenantUserEmail = `tenant-user-${seed}@example.com`
    const otherTenantId = await createTenant(`${seed}-other`, `owner-${seed}@example.com`)

    const access = await axios.get(`${API_URL}/admin/tenant-access/me`, {
      headers: {
        ...authHeaders,
        'x-user-email': tenantUserEmail,
      },
    })

    const assignedTenantId = access.data.assigned_tenant_id

    const meWithHeader = await axios.get(`${API_URL}/admin/tenant-access/me`, {
      headers: {
        ...authHeaders,
        'x-user-email': tenantUserEmail,
        'x-tenant-id': otherTenantId,
      },
    })

    expect(meWithHeader.status).toBe(200)
    expect(meWithHeader.data.effective_tenant_id).toBe(assignedTenantId)
    expect(meWithHeader.data.effective_tenant_id).not.toBe(otherTenantId)
  })

  it('allows platform admin to activate and clear active tenant', async () => {
    const platformEmail = 'admin@example.com'
    const tenantId = await createTenant(`${Date.now()}-platform`, `owner-platform-${Date.now()}@example.com`)

    const activate = await axios.post(
      `${API_URL}/admin/tenant-access/activate`,
      { tenant_id: tenantId },
      {
        headers: {
          ...authHeaders,
          'x-user-email': platformEmail,
        },
      }
    )

    expect(activate.status).toBe(200)
    expect(activate.data.active_tenant_id).toBe(tenantId)

    const clear = await axios.post(
      `${API_URL}/admin/tenant-access/activate`,
      { tenant_id: null },
      {
        headers: {
          ...authHeaders,
          'x-user-email': platformEmail,
        },
      }
    )

    expect(clear.status).toBe(200)
    expect(clear.data.active_tenant_id).toBeNull()
  })

  it('never grants platform admin to non-listed emails', async () => {
    const email = `non-platform-${Date.now()}@example.com`

    const me = await axios.get(`${API_URL}/admin/tenant-access/me`, {
      headers: {
        ...authHeaders,
        'x-user-email': email,
      },
    })

    expect(me.status).toBe(200)
    expect(me.data.email).toBe(email)
    expect(me.data.is_platform_admin).toBe(false)
    expect(me.data.role).toBe('tenant_admin')
  })

  it('grants platform admin only for PLATFORM_ADMIN_EMAILS entries', async () => {
    const platformEmail = 'admin@example.com'

    const me = await axios.get(`${API_URL}/admin/tenant-access/me`, {
      headers: {
        ...authHeaders,
        'x-user-email': platformEmail,
      },
    })

    expect(me.status).toBe(200)
    expect(me.data.email).toBe(platformEmail)
    expect(me.data.is_platform_admin).toBe(true)
    expect(me.data.role).toBe('platform_admin')
  })

  it('treats tenant_id=system as reserved context, not platform-admin escalation', async () => {
    const email = `reserved-system-${Date.now()}@example.com`

    const me = await axios.get(`${API_URL}/admin/tenant-access/me`, {
      headers: {
        ...authHeaders,
        'x-user-email': email,
        'x-tenant-id': 'system',
      },
    })

    expect(me.status).toBe(200)
    expect(me.data.email).toBe(email)
    expect(me.data.is_platform_admin).toBe(false)
    expect(me.data.role).toBe('tenant_admin')
    expect(me.data.assigned_tenant_id).toBeDefined()
    expect(me.data.assigned_tenant_id).not.toBe('system')
  })

  it('returns 403 when non-platform user has no assignment and auto-create is disabled', async () => {
    if ((process.env.AUTO_CREATE_TENANT_ON_FIRST_LOGIN || 'true').toLowerCase() !== 'false') {
      return
    }

    const email = `no-assignment-${Date.now()}@example.com`

    await expect(
      axios.get(`${API_URL}/admin/settings/store`, {
        headers: {
          ...authHeaders,
          'x-user-email': email,
        },
      })
    ).rejects.toMatchObject({
      response: {
        status: 403,
      },
    })
  })
})
