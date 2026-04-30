import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";

const NODE_ENV = process.env.NODE_ENV || "development";
const dbUrl =
  process.env.DATABASE_URL || "postgresql://postgres:test123@db:5432/mydb";

if (!process.env.DATABASE_URL) {
  console.warn(
    "DATABASE_URL not set, using default development database connection.",
  );
}

try {
  const parsed = new URL(dbUrl);
  const host = parsed.hostname;
  const isLocalHost = host === "localhost" || host === "127.0.0.1";

  if (!host) {
    throw new Error("host is missing.");
  }

  if (!isLocalHost && !host.includes(".")) {
    throw new Error(
      `host appears incomplete: '${host}'. Expected full domain (for example '*.render.com').`,
    );
  }
} catch (error) {
  throw new Error(`Invalid DATABASE_URL: ${(error as Error).message}`);
}

const pool = new Pool({
  connectionString: dbUrl,
  // Keep SSL behavior controlled by DATABASE_URL query params (sslmode=...).
  max: NODE_ENV === "production" ? 20 : 10,
  idleTimeoutMillis: NODE_ENV === "production" ? 30000 : 10000,
  connectionTimeoutMillis: 10000,
});

const initDatabase = async (): Promise<void> => {
  // Ensure extensions and tables exist even when migrations were not applied on deployment.
  await pool.query(`CREATE EXTENSION IF NOT EXISTS "pgcrypto";`);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      password TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS tasks (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      title TEXT NOT NULL,
      description TEXT NOT NULL,
      hex_color TEXT NOT NULL,
      uid UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      due_at TIMESTAMP,
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    );
  `);
};

if (NODE_ENV === "development") {
  pool.on("connect", () => {
    console.log("Database connection opened");
  });

  pool.on("error", (err) => {
    console.error("Unexpected error on idle client", err);
  });
}

export const db = drizzle(pool);
export { initDatabase };
