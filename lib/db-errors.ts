import { pgErrorCode } from "@/lib/api";

/**
 * Turns a database failure into something a human can act on.
 *
 * The most common production failure by far is a deployment that was never
 * migrated: the app boots, the marketing page renders, and the first signup
 * fails with "relation users does not exist". A generic 500 there is useless,
 * so we translate the SQLSTATE into a concrete instruction.
 */

export interface DbFailure {
  status: number;
  message: string;
  code: string | null;
}

const BY_SQLSTATE: Record<string, string> = {
  // undefined_table
  "42P01":
    "The database schema hasn't been created yet. Run `npm run db:migrate`, then try again.",
  // undefined_column
  "42703":
    "The database schema is out of date. Run `npm run db:migrate`, then try again.",
  // invalid_catalog_name — database does not exist
  "3D000":
    "The database named in DATABASE_URL doesn't exist. Check the connection string.",
  // invalid_password / invalid_authorization_specification
  "28P01": "The database rejected those credentials. Check DATABASE_URL.",
  "28000":
    "The database rejected the connection. Check DATABASE_URL and that your Neon project is active.",
  // insufficient_privilege
  "42501": "The database user doesn't have permission for this operation.",
  // too_many_connections
  "53300":
    "The database is out of connections. Use the pooled (-pooler) connection string from Neon.",
  // query_canceled / statement timeout
  "57014": "The database query timed out. Try again in a moment.",
};

const NETWORK_PATTERN =
  /econnrefused|enotfound|etimedout|econnreset|getaddrinfo|fetch failed|connection terminated|timeout expired|socket hang up/;

export function describeDbFailure(error: unknown): DbFailure | null {
  const code = pgErrorCode(error);

  if (code && BY_SQLSTATE[code]) {
    return { status: 503, message: BY_SQLSTATE[code], code };
  }

  const messages = [
    (error as { message?: string })?.message ?? "",
    (error as { cause?: { message?: string } })?.cause?.message ?? "",
  ]
    .join(" ")
    .toLowerCase();

  if (messages.includes("database_url is not configured")) {
    return {
      status: 503,
      message:
        "This deployment has no DATABASE_URL configured. Add it in your hosting provider's environment variables.",
      code,
    };
  }

  if (NETWORK_PATTERN.test(messages)) {
    return {
      status: 503,
      message:
        "Couldn't reach the database. Check DATABASE_URL and that your database is running.",
      code,
    };
  }

  return null;
}
