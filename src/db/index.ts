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

const getNormalizedDbUrl = (rawUrl: string): string => {
  const parsed = new URL(rawUrl);
  const host = parsed.hostname.toLowerCase();
  const isRenderDb = host.includes("render.com") || host.includes("onrender.com");

  if (isRenderDb) {
    if (!parsed.searchParams.has("sslmode")) {
      parsed.searchParams.set("sslmode", "require");
    }
    if (!parsed.searchParams.has("uselibpqcompat")) {
      parsed.searchParams.set("uselibpqcompat", "true");
    }
  }

  return parsed.toString();
};

const pool = new Pool({
  connectionString: getNormalizedDbUrl(dbUrl),
  // Keep SSL behavior controlled by DATABASE_URL query params (sslmode=...).
  max: NODE_ENV === "production" ? 20 : 10,
  idleTimeoutMillis: NODE_ENV === "production" ? 30000 : 10000,
  connectionTimeoutMillis: 10000,
});

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const withDbRetry = async <T>(fn: () => Promise<T>): Promise<T> => {
  const maxAttempts = 5;
  let lastError: unknown;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      const message = error instanceof Error ? error.message : String(error);
      console.error(`DB attempt ${attempt}/${maxAttempts} failed:`, message);
      if (attempt < maxAttempts) {
        await sleep(1500 * attempt);
      }
    }
  }

  throw lastError;
};

const initDatabase = async (): Promise<void> => {
  await withDbRetry(async () => {
    // Ensure extensions and tables exist even when migrations were not applied on deployment.
    await pool.query(`CREATE EXTENSION IF NOT EXISTS "pgcrypto";`);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name TEXT NOT NULL,
        email TEXT NOT NULL UNIQUE,
        password TEXT NOT NULL,
        is_verified BOOLEAN NOT NULL DEFAULT FALSE,
        verification_otp TEXT,
        verification_otp_expires_at TIMESTAMP,
        reset_otp TEXT,
        reset_otp_expires_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );
    `);

    await pool.query(
      `ALTER TABLE users ADD COLUMN IF NOT EXISTS is_verified BOOLEAN NOT NULL DEFAULT FALSE;`,
    );
    await pool.query(
      `ALTER TABLE users ADD COLUMN IF NOT EXISTS verification_otp TEXT;`,
    );
    await pool.query(
      `ALTER TABLE users ADD COLUMN IF NOT EXISTS verification_otp_expires_at TIMESTAMP;`,
    );
    await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS reset_otp TEXT;`);
    await pool.query(
      `ALTER TABLE users ADD COLUMN IF NOT EXISTS reset_otp_expires_at TIMESTAMP;`,
    );

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
  });
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
