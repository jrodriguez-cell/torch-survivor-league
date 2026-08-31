// Resolve the Supabase URL and anon/publishable key across the several
// environment-variable names different setups produce:
//   - a plain local .env.local (NEXT_PUBLIC_SUPABASE_URL / _ANON_KEY)
//   - the Vercel Supabase Marketplace integration, which prefixes its vars
//     (and can double-prefix if a custom prefix is also set), e.g.
//     NEXT_PUBLIC_SUPABASE_SUPABASE_URL / _SUPABASE_ANON_KEY / _PUBLISHABLE_KEY
//
// Each candidate below is a *literal* `process.env.NEXT_PUBLIC_*` reference so
// Next.js can statically inline it into the browser bundle at build time.
// (Dynamic `process.env[name]` access is NOT inlined for the client.)

export const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL ||
  process.env.NEXT_PUBLIC_SUPABASE_SUPABASE_URL ||
  "";

export const SUPABASE_ANON_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_SUPABASE_ANON_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
  process.env.NEXT_PUBLIC_NEXT_PUBLIC_SUPABASE_SUPABASE_PUBLISHABLE_KEY ||
  "";

// True when both values resolved — used to gate auth so a missing config
// degrades gracefully instead of crashing.
export const SUPABASE_CONFIGURED = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);
