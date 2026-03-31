import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./packages/db/dist/schema/*.js",
  out: "./packages/db/src/migrations",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
});
