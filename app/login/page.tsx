"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const supabase = createClient();
    const siteUrl =
      process.env.NEXT_PUBLIC_SITE_URL ?? window.location.origin;

    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${siteUrl}/auth/callback` },
    });

    setLoading(false);
    if (error) setError(error.message);
    else setSent(true);
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-gradient-to-b from-jungle-900 to-jungle-700 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-xl">
        <div className="mb-6 text-center">
          <div className="text-4xl">🔥</div>
          <h1 className="mt-2 text-2xl font-bold text-stone-900">Torch</h1>
          <p className="text-sm text-stone-500">
            Fantasy Survivor league &amp; weekly pick&apos;em
          </p>
        </div>

        {sent ? (
          <div className="rounded-lg bg-jungle-50 p-4 text-center text-sm text-jungle-800">
            <p className="font-semibold">Check your email 📬</p>
            <p className="mt-1">
              We sent a magic sign-in link to <strong>{email}</strong>. Click it
              to jump into your leagues.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="label" htmlFor="email">
                Email address
              </label>
              <input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="input"
              />
            </div>
            {error && (
              <p className="text-sm text-red-600" role="alert">
                {error}
              </p>
            )}
            <button type="submit" disabled={loading} className="btn-primary w-full">
              {loading ? "Sending…" : "Send me a magic link"}
            </button>
            <p className="text-center text-xs text-stone-400">
              No password needed — we&apos;ll email you a one-click link.
            </p>
          </form>
        )}
      </div>
    </main>
  );
}
