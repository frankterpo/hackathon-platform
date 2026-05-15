import { redirect } from "next/navigation";

import { isAdmin, adminSecretConfigured } from "@/lib/admin/session";
import { LoginForm } from "./LoginForm";

export const dynamic = "force-dynamic";

type SearchParams = { next?: string };

export default async function AdminLoginPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const sp = await searchParams;
  const nextRaw = sp.next;
  const next =
    typeof nextRaw === "string" && nextRaw.startsWith("/app/master")
      ? nextRaw
      : "/app/master";

  if (await isAdmin()) {
    redirect(next);
  }

  const configured = adminSecretConfigured();

  return (
    <div className="mx-auto flex min-h-[60vh] w-full max-w-md flex-col justify-center gap-6 px-4">
      <header className="flex flex-col gap-1">
        <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">
          Admin
        </p>
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-100">
          Master app login
        </h1>
        <p className="text-sm text-zinc-400">
          Restricted area. Enter the admin password to continue.
        </p>
      </header>
      {!configured ? (
        <div className="rounded-lg border border-amber-500/40 bg-amber-500/5 p-4 text-sm text-amber-200">
          <code>ADMIN_SECRET</code> is not set on the server. Add it to{" "}
          <code>.env.local</code> (and the matching Vercel env) and restart the
          server before you can log in.
        </div>
      ) : null}
      <LoginForm next={next} disabled={!configured} />
    </div>
  );
}
