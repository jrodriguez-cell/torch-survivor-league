import Link from "next/link";
import { signOut } from "@/app/auth/actions";

export default function AppHeader({ displayName }: { displayName?: string }) {
  return (
    <header className="border-b border-stone-200 bg-white">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
        <Link href="/dashboard" className="flex items-center gap-2 font-bold text-stone-900">
          <span className="text-xl">🔥</span> Torch
        </Link>
        <div className="flex items-center gap-3 text-sm">
          {displayName && (
            <span className="hidden text-stone-500 sm:inline">
              Hi, {displayName}
            </span>
          )}
          <form action={signOut}>
            <button type="submit" className="btn-ghost px-3 py-1.5">
              Sign out
            </button>
          </form>
        </div>
      </div>
    </header>
  );
}
