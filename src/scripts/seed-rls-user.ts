import { ExecArgs } from '@medusajs/framework/types'
import { ContainerRegistrationKeys } from '@medusajs/framework/utils'

/**
 * Seed script to create non-superuser for RLS (Row Level Security)
 *
 * IMPORTANT: RLS policies are bypassed for PostgreSQL superusers!
 * This script creates a dedicated application user (medusa_app_user)
 * that will have RLS enforced.
 *
 * Run with: yarn medusa exec ./src/scripts/seed-rls-user.ts
 *
 * After running this script:
 * 1. Update DATABASE_URL in .env to use medusa_app_user
 * 2. Restart the application
 */
export default async function seedRlsUser({ container }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const pgConnection = container.resolve(ContainerRegistrationKeys.PG_CONNECTION)

  const APP_USER = process.env.RLS_APP_USER || 'medusa_app_user'
  const APP_PASSWORD = process.env.RLS_APP_PASSWORD || 'medusa_app_password'

  logger.info('='.repeat(60))
  logger.info('🔐 RLS User Setup Script')
  logger.info('='.repeat(60))

  try {
    // Check if we're running as superuser
    const superuserCheck = await pgConnection.raw(`
      SELECT current_user, usesuper 
      FROM pg_user 
      WHERE usename = current_user
    `)

    const isSuperuser = superuserCheck.rows[0]?.usesuper
    logger.info(`Current user: ${superuserCheck.rows[0]?.current_user}`)
    logger.info(`Is superuser: ${isSuperuser}`)

    if (!isSuperuser) {
      logger.warn('⚠️  Current user is NOT a superuser.')
      logger.warn('   You need superuser privileges to create new users.')
      logger.warn('   Run this script with DATABASE_URL pointing to superuser.')
      return
    }

    // Step 1: Check if user already exists
    logger.info(`\n📋 Step 1: Checking if user '${APP_USER}' exists...`)
    const userExists = await pgConnection.raw(`
      SELECT 1 FROM pg_roles WHERE rolname = '${APP_USER}'
    `)

    if (userExists.rows.length > 0) {
      logger.info(`   ✓ User '${APP_USER}' already exists`)

      // Update password
      logger.info(`   Updating password...`)
      await pgConnection.raw(`
        ALTER USER ${APP_USER} WITH PASSWORD '${APP_PASSWORD}'
      `)
      logger.info(`   ✓ Password updated`)
    } else {
      // Create user
      logger.info(`   Creating user '${APP_USER}'...`)
      await pgConnection.raw(`
        CREATE USER ${APP_USER} WITH PASSWORD '${APP_PASSWORD}'
      `)
      logger.info(`   ✓ User '${APP_USER}' created`)
    }

    // Step 2: Get current database name
    const dbResult = await pgConnection.raw(`SELECT current_database()`)
    const dbName = dbResult.rows[0]?.current_database
    logger.info(`\n📋 Step 2: Granting privileges on database '${dbName}'...`)

    // Grant database privileges
    await pgConnection.raw(`
      GRANT ALL PRIVILEGES ON DATABASE "${dbName}" TO ${APP_USER}
    `)
    logger.info(`   ✓ Granted ALL PRIVILEGES on database`)

    // Step 3: Grant schema privileges
    logger.info(`\n📋 Step 3: Granting schema privileges...`)
    await pgConnection.raw(`
      GRANT ALL ON SCHEMA public TO ${APP_USER}
    `)
    logger.info(`   ✓ Granted ALL on schema public`)

    // Step 4: Grant table privileges
    logger.info(`\n📋 Step 4: Granting table privileges...`)
    await pgConnection.raw(`
      GRANT ALL ON ALL TABLES IN SCHEMA public TO ${APP_USER}
    `)
    logger.info(`   ✓ Granted ALL on all existing tables`)

    // Step 5: Grant sequence privileges
    logger.info(`\n📋 Step 5: Granting sequence privileges...`)
    await pgConnection.raw(`
      GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO ${APP_USER}
    `)
    logger.info(`   ✓ Granted ALL on all existing sequences`)

    // Step 6: Set default privileges for future objects
    logger.info(`\n📋 Step 6: Setting default privileges for future objects...`)
    await pgConnection.raw(`
      ALTER DEFAULT PRIVILEGES IN SCHEMA public 
      GRANT ALL ON TABLES TO ${APP_USER}
    `)
    await pgConnection.raw(`
      ALTER DEFAULT PRIVILEGES IN SCHEMA public 
      GRANT ALL ON SEQUENCES TO ${APP_USER}
    `)
    logger.info(`   ✓ Default privileges set for future tables and sequences`)

    // Verify user is NOT superuser
    logger.info(`\n📋 Step 7: Verifying user configuration...`)
    const verifyResult = await pgConnection.raw(`
      SELECT rolname, rolsuper, rolcreaterole, rolcreatedb 
      FROM pg_roles 
      WHERE rolname = '${APP_USER}'
    `)

    const userInfo = verifyResult.rows[0]
    logger.info(`   User: ${userInfo?.rolname}`)
    logger.info(`   Is superuser: ${userInfo?.rolsuper} (should be false)`)
    logger.info(`   Can create roles: ${userInfo?.rolcreaterole}`)
    logger.info(`   Can create databases: ${userInfo?.rolcreatedb}`)

    if (userInfo?.rolsuper) {
      logger.error('   ❌ ERROR: User is a superuser! RLS will be bypassed!')
    } else {
      logger.info('   ✓ User is NOT a superuser - RLS will be enforced')
    }

    // Summary
    logger.info('\n' + '='.repeat(60))
    logger.info('✅ RLS User Setup Complete!')
    logger.info('='.repeat(60))
    logger.info('')
    logger.info('Next steps:')
    logger.info(`1. Update DATABASE_URL in .env:`)
    logger.info(`   DATABASE_URL=postgresql://${APP_USER}:${APP_PASSWORD}@localhost:5432/${dbName}`)
    logger.info('')
    logger.info('2. Keep superuser URL for migrations (optional):')
    logger.info(`   DATABASE_SUPER_URL=postgresql://postgres:postgres@localhost:5432/${dbName}`)
    logger.info('')
    logger.info('3. Restart the application:')
    logger.info('   yarn dev')
    logger.info('')
    logger.info('4. Run RLS migration:')
    logger.info('   yarn medusa db:migrate')
    logger.info('='.repeat(60))
  } catch (error) {
    logger.error(`❌ Error during RLS user setup: ${error}`)
    throw error
  }
}
