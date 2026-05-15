import { redirect } from "next/navigation";
import Link from "next/link";

import { adminLogoutAction } from "@/app/app/master/login/actions";
import { isAdmin } from "@/lib/admin/session";

export const dynamic = "force-dynamic";

export default async function MasterAuthedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  if (!(await isAdmin())) {
    redirect("/app/master/login");
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between border-b border-white/5 pb-3">
        <p className="text-[10px] font-semibold uppercase tracking-[0.25em] text-zinc-500">
          Admin · master app
        </p>
        <div className="flex items-center gap-3 text-xs text-zinc-400">
          <Link
            href="/app/master"
            className="rounded-md border border-white/10 px-2 py-1 hover:border-white/20 hover:text-zinc-200"
          >
            All hacks
          </Link>
          <form action={adminLogoutAction}>
            <button
              type="submit"
              className="rounded-md border border-white/10 px-2 py-1 hover:border-white/20 hover:text-zinc-200"
            >
              Sign out
            </button>
          </form>
        </div>
      </div>
      {children}
    </div>
  );
}
