import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";

// Prisma 7 requires a driver adapter — see .agents/skills/prisma-upgrade-v7.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

function createPrismaClient() {
  // Prefer the pooled URL at runtime; falls back to DATABASE_URL for local dev.
  const connectionString =
    process.env.DATABASE_URL_POOLED ?? process.env.DATABASE_URL;

  // Own the pg Pool so we can handle idle-connection errors. The Supabase
  // pooler drops idle connections, and an unhandled pg Pool 'error' event
  // crashes the entire Node process — which looked like the server "dying"
  // randomly. Listening here keeps it alive and lets the pool recycle.
  const pool = new Pool({
    connectionString,
    max: 5,
    idleTimeoutMillis: 30_000, // recycle before the pooler kills idle conns
    connectionTimeoutMillis: 20_000, // the pooler is slow to cold-connect
  });
  pool.on("error", (err) => {
    console.error("Unexpected error on idle Postgres client:", err.message);
  });

  const adapter = new PrismaPg(pool);
  return new PrismaClient({ adapter });
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
