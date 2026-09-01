"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import AuthShell from "@/components/AuthShell";

// Reached after clicking the reset email (which routes through /auth/callback
// and establishes a session), so the user can set a new password.
export default function ResetPasswordPage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) {
        setError("This reset link is invalid or has expired. Request a new one.");
      }
      setReady(true);
    });
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }
    setLoading(true);
    setError(null);
    const supabase = createClient();
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (error) {
      setError(error.message);
      return;
    }
    setDone(true);
    setTimeout(() => router.push("/dashboard"), 1200);
  }

  return (
    <AuthShell title="Choose a new password">
      {done ? (
        <div className="rounded-lg bg-stone-100 p-4 text-center text-sm text-stone-700">
          <p className="font-semibold">Password updated ✅</p>
          <p className="mt-1">Taking you to your dashboard…</p>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="label" htmlFor="password">New password</label>
            <input id="password" type="password" required value={password}
              onChange={(e) => setPassword(e.target.value)} className="input"
              placeholder="At least 6 characters" disabled={!ready} />
          </div>
          {error && <p className="text-sm text-red-600" role="alert">{error}</p>}
          <button type="submit" disabled={loading || !ready} className="btn-primary w-full">
            {loading ? "Saving…" : "Update password"}
          </button>
        </form>
      )}
    </AuthShell>
  );
}
