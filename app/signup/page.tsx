"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import AuthShell from "@/components/AuthShell";

export default function SignupPage() {
  return (
    <Suspense>
      <SignupInner />
    </Suspense>
  );
}

function SignupInner() {
  const params = useSearchParams();
  const next = params.get("next") || "/dashboard";
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<"confirm" | "in" | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }
    setLoading(true);
    setError(null);
    const supabase = createClient();
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? window.location.origin;

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { display_name: displayName.trim() || email.split("@")[0] },
        emailRedirectTo: `${siteUrl}/auth/callback?next=${encodeURIComponent(next)}`,
      },
    });

    setLoading(false);
    if (error) {
      setError(error.message);
      return;
    }
    // If email confirmation is on, there's no active session yet.
    if (data.session) {
      setDone("in");
      window.location.href = next;
    } else {
      setDone("confirm");
    }
  }

  return (
    <AuthShell title="Create your account">
      {done === "confirm" ? (
        <div className="rounded-lg bg-stone-100 p-4 text-center text-sm text-stone-700">
          <p className="font-semibold">Almost there 📬</p>
          <p className="mt-1">
            We sent a confirmation link to <strong>{email}</strong>. Click it to
            finish creating your account, then log in.
          </p>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="label" htmlFor="display_name">Display name</label>
            <input id="display_name" value={displayName} onChange={(e) => setDisplayName(e.target.value)}
              className="input" placeholder="How you'll show up in standings" />
          </div>
          <div>
            <label className="label" htmlFor="email">Email</label>
            <input id="email" type="email" required value={email}
              onChange={(e) => setEmail(e.target.value)} className="input" placeholder="you@example.com" />
          </div>
          <div>
            <label className="label" htmlFor="password">Password</label>
            <input id="password" type="password" required value={password}
              onChange={(e) => setPassword(e.target.value)} className="input" placeholder="At least 6 characters" />
          </div>

          {error && <p className="text-sm text-red-600" role="alert">{error}</p>}

          <button type="submit" disabled={loading} className="btn-primary w-full">
            {loading ? "Creating…" : "Sign up"}
          </button>
        </form>
      )}

      <p className="mt-6 text-center text-sm text-stone-500">
        Already have an account?{" "}
        <Link href="/login" className="font-semibold text-ember-600 hover:underline">
          Log in
        </Link>
      </p>
    </AuthShell>
  );
}
