import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./types";

/**
 * Server-only Supabase client using the service_role key.
 *
 * The service_role key bypasses Row Level Security, so this must NEVER be
 * imported into a client component — the `server-only` import makes that a build
 * error. All DB access in this app flows through here.
 *
 * The client is created lazily on first use so that `next build` (which imports
 * these modules) doesn't require the secret to be present at build time — only
 * at request time.
 */
let _client: SupabaseClient<Database> | null = null;

function getClient(): SupabaseClient<Database> {
  if (_client) return _client;

  const url = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url) throw new Error("Missing SUPABASE_URL env var");
  if (!serviceRoleKey) throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY env var");

  _client = createClient<Database>(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return _client;
}

// Proxy that defers client creation until the first property access (e.g. .from()).
export const supabase = new Proxy({} as SupabaseClient<Database>, {
  get(_target, prop, receiver) {
    const client = getClient();
    const value = Reflect.get(client as object, prop, receiver);
    return typeof value === "function" ? value.bind(client) : value;
  },
});
