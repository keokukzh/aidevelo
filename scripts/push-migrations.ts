import { createClient } from "@supabase/supabase-js";

const DATABASE_URL =
  "postgresql://postgres:Kukukeku992!@db.ngyncmglvqnmdnpiaqjq.supabase.co:5432/postgres";

async function main() {
  console.log("Connecting to Supabase...");

  // We'll use the direct postgres connection via pg
  const { Client } = await import("pg");
  const client = new Client({
    connectionString: DATABASE_URL,
    connectionTimeoutMillis: 30000,
  });

  await client.connect();
  console.log("Connected!");

  // Read and execute all migration files in order
  const fs = await import("fs");
  const path = await import("path");
  const migrationsDir = path.join(
    process.cwd(),
    "packages/db/src/migrations"
  );

  const files = fs.readdirSync(migrationsDir).filter((f) => f.endsWith(".sql")).sort();

  console.log(`Found ${files.length} migration files`);

  for (const file of files) {
    const filePath = path.join(migrationsDir, file);
    const sql = fs.readFileSync(filePath, "utf-8");

    // Split by statement-breakpoint comments
    const statements = sql
      .split(/-->\s*statement-breakpoint\s*/)
      .map((s) => s.trim())
      .filter((s) => s.length > 0);

    console.log(`\nApplying ${file} (${statements.length} statements)...`);

    for (const stmt of statements) {
      try {
        await client.query(stmt);
      } catch (err: any) {
        // Ignore "already exists" errors for CREATE TABLE IF NOT EXISTS patterns
        if (
          err.code === "42P07" || // duplicate_table
          err.code === "42710" || // duplicate_object
          err.code === "23505" || // unique_violation
          err.message?.includes("already exists")
        ) {
          console.log(`  SKIP: ${err.message.split("\n")[0]}`);
          continue;
        }
        console.error(`  ERROR: ${err.message.split("\n")[0]}`);
        throw err;
      }
    }
    console.log(`  Done: ${file}`);
  }

  await client.end();
  console.log("\nAll migrations applied successfully!");
}

main().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
