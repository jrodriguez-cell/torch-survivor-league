import { APP_NAME, APP_EMOJI } from "@/lib/branding";

// Shared centered card used by all the auth screens.
export default function AuthShell({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-gradient-to-b from-jungle-900 to-jungle-700 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-xl">
        <div className="mb-6 text-center">
          <div className="text-4xl">{APP_EMOJI}</div>
          <h1 className="mt-2 text-2xl font-bold text-stone-900">{APP_NAME}</h1>
          <p className="text-sm font-medium text-stone-700">{title}</p>
          {subtitle && <p className="mt-1 text-sm text-stone-500">{subtitle}</p>}
        </div>
        {children}
      </div>
    </main>
  );
}
