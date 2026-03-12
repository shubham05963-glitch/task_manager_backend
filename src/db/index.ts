import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";

const NODE_ENV = process.env.NODE_ENV || "development";

if (!process.env.DATABASE_URL) {
  console.warn("⚠️  DATABASE_URL not set, using default development database");
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || "postgresql://postgres:test123@db:5432/mydb",
  // Production pooling config
  max: NODE_ENV === "production" ? 20 : 10,
  idleTimeoutMillis: NODE_ENV === "production" ? 30000 : 10000,
  connectionTimeoutMillis: 2000,
});

// Log connection in development
if (NODE_ENV === "development") {
  pool.on("connect", () => {
    console.log("📦 Database connection opened");
  });
  
  pool.on("error", (err) => {
    console.error("❌ Unexpected error on idle client", err);
  });
}

export const db = drizzle(pool);
