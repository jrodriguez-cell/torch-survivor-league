"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import AuthShell from "@/components/AuthShell";

type Mode = "password" | "magic";

export default function LoginPage() {
  return (
    <Suspense>
      <LoginInner />
    </Suspense>
  );
}

function LoginInner() {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get("next") || "/dashboard";

  const [mode, setMode] = useState<Mode>("password");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [magicSent, setMagicSent] = useState(false);

  function siteUrl() {
    return process.env.NEXT_PUBLIC_SITE_URL ?? window.location.origin;
  }

  async function handlePassword(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) setError(error.message);
    else router.push(next);
  }

  async function handleMagic(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${siteUrl()}/auth/callback?next=${encodeURIComponent(next)}` },
    });
    setLoading(false);
    if (error) setError(error.message);
    else setMagicSent(true);
  }

  return (
    <AuthShell title="Log in to your pool">
      {magicSent ? (
        <div className="rounded-lg bg-jungle-50 p-4 text-center text-sm text-jungle-800">
          <p className="font-semibold">Check your email 📬</p>
          <p className="mt-1">
            We sent a one-click login link to <strong>{email}</strong>.
          </p>
        </div>
      ) : (
        <>
          <div className="mb-4 grid grid-cols-2 gap-1 rounded-lg bg-stone-100 p-1 text-sm">
            <button
              onClick={() => { setMode("password"); setError(null); }}
              className={`rounded-md py-1.5 font-medium ${mode === "password" ? "bg-white shadow-sm" : "text-stone-500"}`}
            >
              Password
            </button>
            <button
              onClick={() => { setMode("magic"); setError(null); }}
              className={`rounded-md py-1.5 font-medium ${mode === "magic" ? "bg-white shadow-sm" : "text-stone-500"}`}
            >
              Magic link
            </button>
          </div>

          <form onSubmit={mode === "password" ? handlePassword : handleMagic} className="space-y-4">
            <div>
              <label className="label" htmlFor="email">Email</label>
              <input id="email" type="email" required value={email}
                onChange={(e) => setEmail(e.target.value)} className="input" placeholder="you@example.com" />
            </div>

            {mode === "password" && (
              <div>
                <div className="flex items-center justify-between">
                  <label className="label" htmlFor="password">Password</label>
                  <Link href="/forgot-password" className="text-xs text-ember-600 hover:underline">
                    Forgot?
                  </Link>
                </div>
                <input id="password" type="password" required value={password}
                  onChange={(e) => setPassword(e.target.value)} className="input" placeholder="••••••••" />
              </div>
            )}

            {error && <p className="text-sm text-red-600" role="alert">{error}</p>}

            <button type="submit" disabled={loading} className="btn-primary w-full">
              {loading ? "Working…" : mode === "password" ? "Log in" : "Send me a magic link"}
            </button>
          </form>
        </>
      )}

      <p className="mt-6 text-center text-sm text-stone-500">
        New here?{" "}
        <Link href="/signup" className="font-semibold text-ember-600 hover:underline">
          Create an account
        </Link>
      </p>
    </AuthShell>
  );
}
