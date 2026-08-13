import { PrismaClient } from '@prisma/client'
import { PrismaLibSql } from '@prisma/adapter-libsql'
import { createClient } from '@libsql/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

function createPrismaClient(): PrismaClient {
  const tursoUrl =
    process.env.TURSO_DATABASE_URL ||
    (process.env.DATABASE_URL?.startsWith('libsql://') ? process.env.DATABASE_URL : undefined)
  const authToken = process.env.TURSO_AUTH_TOKEN

  if (tursoUrl) {
    console.log(`[db.ts] Initializing PrismaClient with @prisma/adapter-libsql (Turso Cloud DB: ${tursoUrl})...`)
    const libsql = createClient({
      url: tursoUrl,
      authToken: authToken,
    })
    const adapter = new PrismaLibSql(libsql)
    return new PrismaClient({ adapter })
  }

  // Fall back to standard local SQLite file for local development
  return new PrismaClient()
}

export const db = globalForPrisma.prisma ?? createPrismaClient()

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = db
