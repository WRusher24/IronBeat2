import { config } from "dotenv";
import { defineConfig } from "drizzle-kit";

// Same precedence Next.js uses: .env.local wins over .env.
config({ path: [".env.local", ".env"] });

export default defineConfig({
  schema: "./db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url:
      process.env.DATABASE_URL ??
      "postgresql://placeholder:placeholder@localhost:5432/ironbeat",
  },
  verbose: true,
  strict: false,
});
