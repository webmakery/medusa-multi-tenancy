import axios from 'axios'
import { randomUUID } from 'crypto'

jest.setTimeout(60 * 1000)

describe('Security access controls (IDOR + tenant-switch tampering)', () => {
  const API_URL = process.env.API_URL || 'http://localhost:9000'
  const SECRET_KEY =
    process.env.SECRET_API_KEY ||
    'sk_46b30bd85aae59eb041d307688c02a9b5dd5aa6dc7d6fb5fabc4c6f67a85fcf1'

  const authHeaders = {
    Authorization: `Basic ${SECRET_KEY}`,
    'Content-Type': 'application/json',
  }

  type TenantFixture = {
    tenant_id: string
    ownerEmail: string
  }

  const createdTenants: TenantFixture[] = []

  async function createTenant(name: string, ownerEmail: string): Promise<TenantFixture> {
    const response = await axios.post(
      `${API_URL}/admin/tenants`,
      { name, owner_email: ownerEmail },
      {
        headers: {
          ...authHeaders,
          'idempotency-key': randomUUID(),
        },
      }
    )

    expect(response.status).toBe(201)

    const tenant = {
      tenant_id: response.data.tenant.tenant_id,
      ownerEmail,
    }

    createdTenants.push(tenant)
    return tenant
  }

  async function inviteUser(tenantId: string, actorEmail: string, email: string) {
    return axios.post(
      `${API_URL}/admin/tenants/${tenantId}/invite`,
      {
        email,
        role: 'member',
        invited_by: actorEmail,
      },
      {
        headers: {
          ...authHeaders,
          'x-user-email': actorEmail,
        },
      }
    )
  }

  beforeAll(async () => {
    const response = await axios.get(`${API_URL}/health`)
    expect(response.status).toBe(200)
  })

  afterAll(async () => {
    for (const tenant of createdTenants) {
      await axios
        .post(
          `${API_URL}/admin/tenants/${tenant.tenant_id}/deactivate`,
          {},
          {
            headers: {
              ...authHeaders,
              'x-user-email': tenant.ownerEmail,
            },
          }
        )
        .catch(() => undefined)
    }
  })

  it('blocks IDOR attempts that reuse member identifiers across tenants', async () => {
    const seed = Date.now()
    const tenantA = await createTenant(`IDOR Tenant A ${seed}`, `owner-idor-a-${seed}@example.com`)
    const tenantB = await createTenant(`IDOR Tenant B ${seed}`, `owner-idor-b-${seed}@example.com`)
    const memberEmail = `idor-member-${seed}@example.com`

    const invitation = await inviteUser(tenantB.tenant_id, tenantB.ownerEmail, memberEmail)
    await axios.post(
      `${API_URL}/admin/tenants/invitations/accept`,
      { invitation_token: invitation.data.invitation.invitation_token },
      { headers: authHeaders }
    )

    const tenantBMembers = await axios.get(`${API_URL}/admin/tenants/${tenantB.tenant_id}/members`, {
      headers: authHeaders,
    })

    const member = tenantBMembers.data.members.find((entry: any) => entry.user_email === memberEmail)
    expect(member).toBeDefined()

    await expect(
      axios.post(
        `${API_URL}/admin/tenants/${tenantA.tenant_id}/members/${member.id}/role`,
        { role: 'admin' },
        {
          headers: {
            ...authHeaders,
            'x-user-email': tenantA.ownerEmail,
          },
        }
      )
    ).rejects.toMatchObject({
      response: {
        status: 400,
        data: { message: 'Member not found.' },
      },
    })
  })

  it('rejects broken access control attempts to mutate billing from a non-member tenant', async () => {
    const seed = Date.now() + 1
    const tenantA = await createTenant(`Billing Tenant A ${seed}`, `owner-bac-a-${seed}@example.com`)
    const tenantB = await createTenant(`Billing Tenant B ${seed}`, `owner-bac-b-${seed}@example.com`)

    await expect(
      axios.post(
        `${API_URL}/admin/billing/status`,
        { action: 'payment_failed' },
        {
          headers: {
            ...authHeaders,
            'x-user-email': tenantA.ownerEmail,
            'x-tenant-id': tenantB.tenant_id,
          },
        }
      )
    ).rejects.toMatchObject({
      response: {
        status: 403,
        data: { message: 'You are not an active member of this tenant.' },
      },
    })
  })

  it('detects tenant-switch tampering between active tenant session and x-tenant-id', async () => {
    const seed = Date.now() + 2
    const tenantA = await createTenant(`Tamper Tenant A ${seed}`, `owner-tamper-a-${seed}@example.com`)
    const tenantB = await createTenant(`Tamper Tenant B ${seed}`, `owner-tamper-b-${seed}@example.com`)
    const sharedEmail = `shared-tamper-${seed}@example.com`

    const inviteA = await inviteUser(tenantA.tenant_id, tenantA.ownerEmail, sharedEmail)
    const inviteB = await inviteUser(tenantB.tenant_id, tenantB.ownerEmail, sharedEmail)

    await axios.post(
      `${API_URL}/admin/tenants/invitations/accept`,
      { invitation_token: inviteA.data.invitation.invitation_token },
      { headers: authHeaders }
    )
    await axios.post(
      `${API_URL}/admin/tenants/invitations/accept`,
      { invitation_token: inviteB.data.invitation.invitation_token },
      { headers: authHeaders }
    )

    const activateTenantA = await axios.post(
      `${API_URL}/admin/tenants/active`,
      { tenant_id: tenantA.tenant_id },
      {
        headers: {
          ...authHeaders,
          'x-user-email': sharedEmail,
        },
      }
    )

    const setCookie = activateTenantA.headers['set-cookie']?.[0]
    expect(setCookie).toContain('medusa_auth_token=')

    await expect(
      axios.get(`${API_URL}/admin/settings/store`, {
        headers: {
          ...authHeaders,
          'x-user-email': sharedEmail,
          'x-tenant-id': tenantB.tenant_id,
          Cookie: setCookie,
        },
      })
    ).rejects.toMatchObject({
      response: {
        status: 409,
      },
    })
  })
})
