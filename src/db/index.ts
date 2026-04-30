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
  max: NODE_ENV === "production" ? 20 : 10,
  idleTimeoutMillis: NODE_ENV === "production" ? 30000 : 10000,
  connectionTimeoutMillis: 2000,
});

if (NODE_ENV === "development") {
  pool.on("connect", () => {
    console.log("Database connection opened");
  });

  pool.on("error", (err) => {
    console.error("Unexpected error on idle client", err);
  });
}

export const db = drizzle(pool);
