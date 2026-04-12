import axios from 'axios'
import { randomUUID } from 'crypto'

jest.setTimeout(60 * 1000)

describe('Tenant Management API integration', () => {
  const API_URL = process.env.API_URL || 'http://localhost:9000'
  const SECRET_KEY =
    process.env.SECRET_API_KEY ||
    'sk_46b30bd85aae59eb041d307688c02a9b5dd5aa6dc7d6fb5fabc4c6f67a85fcf1'

  const authHeaders = {
    Authorization: `Basic ${SECRET_KEY}`,
    'Content-Type': 'application/json',
  }

  type TenantFixture = {
    id: string
    tenant_id: string
    ownerEmail: string
  }

  const createdTenants: TenantFixture[] = []

  async function createTenant(name: string, ownerEmail: string): Promise<TenantFixture> {
    const idempotencyKey = randomUUID()

    const response = await axios.post(
      `${API_URL}/admin/tenants`,
      {
        name,
        owner_email: ownerEmail,
      },
      {
        headers: {
          ...authHeaders,
          'idempotency-key': idempotencyKey,
        },
      }
    )

    expect(response.status).toBe(201)
    expect(response.data?.tenant?.tenant_id).toBeDefined()

    const tenant = {
      id: response.data.tenant.id,
      tenant_id: response.data.tenant.tenant_id,
      ownerEmail,
    }

    createdTenants.push(tenant)
    return tenant
  }

  async function inviteUser(tenantId: string, actorEmail: string, email: string, expiresInDays?: number) {
    return axios.post(
      `${API_URL}/admin/tenants/${tenantId}/invite`,
      {
        email,
        role: 'staff',
        invited_by: actorEmail,
        ...(expiresInDays !== undefined ? { expires_in_days: expiresInDays } : {}),
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

  describe('invite success/failure', () => {
    it('invites a member for same tenant and denies cross-tenant invite', async () => {
      const seed = Date.now()
      const tenantA = await createTenant(`Invite Tenant A ${seed}`, `owner-a-${seed}@example.com`)
      const tenantB = await createTenant(`Invite Tenant B ${seed}`, `owner-b-${seed}@example.com`)

      const success = await inviteUser(
        tenantA.tenant_id,
        tenantA.ownerEmail,
        `invitee-${seed}@example.com`
      )

      expect(success.status).toBe(201)
      expect(success.data?.invitation?.tenant_id).toBe(tenantA.tenant_id)
      expect(success.data?.invitation?.status).toBe('pending')

      await expect(
        inviteUser(
          tenantA.tenant_id,
          tenantB.ownerEmail,
          `cross-tenant-${seed}@example.com`
        )
      ).rejects.toMatchObject({
        response: {
          status: 403,
        },
      })
    })

    it('fails invite when email is missing', async () => {
      const seed = Date.now() + 1
      const tenant = await createTenant(`Invite Validation ${seed}`, `owner-v-${seed}@example.com`)

      await expect(
        axios.post(
          `${API_URL}/admin/tenants/${tenant.tenant_id}/invite`,
          { role: 'staff' },
          {
            headers: {
              ...authHeaders,
              'x-user-email': tenant.ownerEmail,
            },
          }
        )
      ).rejects.toMatchObject({
        response: {
          status: 400,
          data: { message: 'email is required' },
        },
      })
    })
  })

  describe('accept invitation expiration handling', () => {
    it('rejects accepting an expired invitation token', async () => {
      const seed = Date.now() + 2
      const tenant = await createTenant(`Expire Invite ${seed}`, `owner-exp-${seed}@example.com`)

      const invite = await inviteUser(
        tenant.tenant_id,
        tenant.ownerEmail,
        `expired-${seed}@example.com`,
        0.00001
      )
      expect(invite.status).toBe(201)

      await new Promise((resolve) => setTimeout(resolve, 1500))

      await expect(
        axios.post(
          `${API_URL}/admin/tenants/invitations/accept`,
          {
            invitation_token: invite.data.invitation.invitation_token,
          },
          {
            headers: authHeaders,
          }
        )
      ).rejects.toMatchObject({
        response: {
          status: 400,
          data: { message: 'Invitation has expired.' },
        },
      })
    })
  })

  describe('role update authorization', () => {
    it('allows same-tenant role updates and blocks cross-tenant actor', async () => {
      const seed = Date.now() + 3
      const tenantA = await createTenant(`Role Tenant A ${seed}`, `owner-ra-${seed}@example.com`)
      const tenantB = await createTenant(`Role Tenant B ${seed}`, `owner-rb-${seed}@example.com`)
      const memberEmail = `member-role-${seed}@example.com`

      const invite = await inviteUser(tenantA.tenant_id, tenantA.ownerEmail, memberEmail)
      const token = invite.data.invitation.invitation_token

      const accepted = await axios.post(
        `${API_URL}/admin/tenants/invitations/accept`,
        { invitation_token: token },
        { headers: authHeaders }
      )

      expect(accepted.status).toBe(200)

      const members = await axios.get(`${API_URL}/admin/tenants/${tenantA.tenant_id}/members`, {
        headers: authHeaders,
      })

      const targetMember = members.data.members.find((member: any) => member.user_email === memberEmail)
      expect(targetMember).toBeDefined()

      await expect(
        axios.post(
          `${API_URL}/admin/tenants/${tenantA.tenant_id}/members/${targetMember.id}/role`,
          { role: 'admin' },
          {
            headers: {
              ...authHeaders,
              'x-user-email': tenantB.ownerEmail,
            },
          }
        )
      ).rejects.toMatchObject({
        response: {
          status: 403,
        },
      })

      const allowed = await axios.post(
        `${API_URL}/admin/tenants/${tenantA.tenant_id}/members/${targetMember.id}/role`,
        { role: 'admin' },
        {
          headers: {
            ...authHeaders,
            'x-user-email': tenantA.ownerEmail,
          },
        }
      )

      expect(allowed.status).toBe(200)
      expect(allowed.data.member.role).toBe('admin')
    })
  })

  describe('deactivate tenant side effects', () => {
    it('deactivates tenant memberships and blocks cross-tenant deactivation', async () => {
      const seed = Date.now() + 4
      const tenantTarget = await createTenant(`Deactivate Target ${seed}`, `owner-dt-${seed}@example.com`)
      const tenantOther = await createTenant(`Deactivate Other ${seed}`, `owner-do-${seed}@example.com`)
      const memberEmail = `member-deactivate-${seed}@example.com`

      const invite = await inviteUser(tenantTarget.tenant_id, tenantTarget.ownerEmail, memberEmail)
      await axios.post(
        `${API_URL}/admin/tenants/invitations/accept`,
        { invitation_token: invite.data.invitation.invitation_token },
        { headers: authHeaders }
      )

      await expect(
        axios.post(
          `${API_URL}/admin/tenants/${tenantTarget.tenant_id}/deactivate`,
          {},
          {
            headers: {
              ...authHeaders,
              'x-user-email': tenantOther.ownerEmail,
            },
          }
        )
      ).rejects.toMatchObject({
        response: {
          status: 403,
        },
      })

      const deactivated = await axios.post(
        `${API_URL}/admin/tenants/${tenantTarget.tenant_id}/deactivate`,
        {},
        {
          headers: {
            ...authHeaders,
            'x-user-email': tenantTarget.ownerEmail,
          },
        }
      )

      expect(deactivated.status).toBe(200)
      expect(deactivated.data.tenant.status).toBe('inactive')

      const members = await axios.get(`${API_URL}/admin/tenants/${tenantTarget.tenant_id}/members`, {
        headers: authHeaders,
      })

      const statuses = members.data.members.map((member: any) => member.status)
      expect(statuses.length).toBeGreaterThan(0)
      expect(statuses.every((status: string) => status === 'inactive')).toBe(true)
    })
  })
})
