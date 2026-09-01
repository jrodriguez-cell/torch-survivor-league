import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { SUPABASE_URL } from "./env";

// Server-only Supabase client using the service-role key. It bypasses RLS, so
// NEVER import this into a client component or expose the key to the browser.
// Used by the cron scoring job and commissioner admin actions.
export function createAdminClient() {
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_SUPABASE_SERVICE_ROLE_KEY ||
    "";
  const url =
    SUPABASE_URL ||
    process.env.SUPABASE_SUPABASE_URL ||
    process.env.SUPABASE_URL ||
    "";

  if (!url || !key) {
    throw new Error(
      "Missing Supabase service-role credentials. Set SUPABASE_SERVICE_ROLE_KEY in the environment."
    );
  }

  return createSupabaseClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
