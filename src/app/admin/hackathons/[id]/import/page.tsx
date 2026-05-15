import Link from "next/link";
import { notFound } from "next/navigation";

import { ImportClient } from "@/app/admin/hackathons/[id]/import/ImportClient";
import { loadHackathonById } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type Params = { id: string };

export default async function ImportPage({
  params,
}: {
  params: Promise<Params>;
}) {
  const { id } = await params;
  const { hackathon, error } = await loadHackathonById(id);
  if (error) {
    return (
      <div className="mx-auto w-full max-w-3xl p-8 text-rose-300">
        {error}
      </div>
    );
  }
  if (!hackathon) notFound();

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 p-8 text-zinc-100">
      <header className="flex flex-col gap-1">
        <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">
          Admin · CSV import
        </p>
        <h1 className="text-2xl font-semibold tracking-tight">
          {hackathon.name}
        </h1>
        <Link
          href="/app/master"
          className="mt-1 text-xs text-zinc-500 hover:text-zinc-300"
        >
          ← Master app
        </Link>
      </header>
      <ImportClient hackathonId={hackathon.id} />
    </div>
  );
}
