import Link from "next/link";
import { notFound } from "next/navigation";

import { gateCredits, gateMessage } from "@/lib/portals/portal-checks";
import { requireHackathon } from "@/lib/portals/access";
import { CreditsClient } from "./CreditsClient";

export const dynamic = "force-dynamic";

type Params = { hack_id: string };

export default async function CreditsPortalPage({
  params,
}: {
  params: Promise<Params>;
}) {
  const { hack_id } = await params;
  const { hackathon, error } = await requireHackathon(hack_id);
  if (error) {
    return (
      <div className="rounded-lg border border-rose-500/40 bg-rose-500/5 p-4 text-sm text-rose-200">
        {error}
      </div>
    );
  }
  if (!hackathon) notFound();

  const gate = await gateCredits(hackathon.id);

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-1">
        <p className="text-xs uppercase tracking-[0.2em] text-amber-300/80">
          Credits portal
        </p>
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-100">
          {hackathon.name}
        </h1>
        <Link
          href={`/app/${hackathon.id}`}
          className="mt-1 text-xs text-zinc-500 hover:text-zinc-300"
        >
          ← Back to hack page
        </Link>
      </header>
      {!gate.ok ? (
        <div className="rounded-xl border border-amber-400/30 bg-amber-400/5 p-5 text-sm text-amber-200">
          {gateMessage(gate.reason)}
        </div>
      ) : (
        <CreditsClient
          hackathonId={hackathon.id}
          hackathonName={hackathon.name}
        />
      )}
    </div>
  );
}
