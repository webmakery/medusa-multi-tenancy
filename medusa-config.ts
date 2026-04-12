import { loadEnv, defineConfig } from '@medusajs/framework/utils'
import { TENANT_CONTEXT_MODULE } from './src/modules/tenant-context'
import { TENANT_MANAGEMENT_MODULE } from './src/modules/tenant-management'

loadEnv(process.env.NODE_ENV || 'development', process.cwd())

module.exports = defineConfig({
  projectConfig: {
    databaseUrl: process.env.DATABASE_URL,
    redisUrl: process.env.REDIS_URL,
    http: {
      storeCors: process.env.STORE_CORS!,
      adminCors: process.env.ADMIN_CORS!,
      authCors: process.env.AUTH_CORS!,
      jwtSecret: process.env.JWT_SECRET || 'supersecret',
      cookieSecret: process.env.COOKIE_SECRET || 'supersecret',
    },
    cookieOptions: {
      sameSite: 'lax',
      secure: false,
    },
  },
  modules: {
    [TENANT_CONTEXT_MODULE]: {
      resolve: './modules/tenant-context',
    },
    [TENANT_MANAGEMENT_MODULE]: {
      resolve: './modules/tenant-management',
    },
  },
})
