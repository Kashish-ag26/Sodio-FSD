import { PrismaClient } from '@prisma/client'
import { PrismaLibSql } from '@prisma/adapter-libsql'
import { createClient } from '@libsql/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

function createPrismaClient(): PrismaClient {
  const tursoUrl = process.env.TURSO_DATABASE_URL
  const authToken = process.env.TURSO_AUTH_TOKEN

  // If either Turso variable is present, attempt Turso connection with strict validation
  if (tursoUrl || authToken) {
    if (!tursoUrl || !tursoUrl.trim()) {
      throw new Error(
        '[db.ts] Missing TURSO_DATABASE_URL in process.env. Both TURSO_DATABASE_URL and TURSO_AUTH_TOKEN are required for Turso integration.'
      )
    }
    if (!authToken || !authToken.trim()) {
      throw new Error(
        '[db.ts] Missing TURSO_AUTH_TOKEN in process.env. Both TURSO_DATABASE_URL and TURSO_AUTH_TOKEN are required for Turso integration.'
      )
    }

    console.log(`[db.ts] Initializing PrismaClient with @prisma/adapter-libsql (Turso Cloud DB)...`)
    const libsql = createClient({
      url: tursoUrl,
      authToken: authToken,
    })
    const adapter = new PrismaLibSql(libsql)
    return new PrismaClient({ adapter })
  }

  // Fall back to standard local SQLite file for local development
  console.log(`[db.ts] Initializing standard PrismaClient (Local SQLite DB)...`)
  return new PrismaClient()
}

export const db = globalForPrisma.prisma ?? createPrismaClient()

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = db
