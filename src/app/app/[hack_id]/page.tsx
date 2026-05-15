import Link from "next/link";
import { notFound } from "next/navigation";

import { PortalsSection } from "@/components/PortalsSection";
import { requireHackathon } from "@/lib/portals/access";
import { loadPortalConfig } from "@/lib/portals/admin-data";
import { loadPublicHackSummary } from "@/lib/portals/public-summary";

export const dynamic = "force-dynamic";

type Params = { hack_id: string };

function formatDate(iso: string | null): string {
  if (!iso) return "TBA";
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  } catch {
    return "TBA";
  }
}

export default async function HackPage({
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

  const [config, summary] = await Promise.all([
    loadPortalConfig(hackathon.id),
    loadPublicHackSummary(hackathon.id),
  ]);

  const status =
    hackathon.status === "live"
      ? "Happening now"
      : hackathon.status === "scheduled"
        ? "Coming up"
        : "Past event";

  return (
    <div className="flex flex-col gap-10">
      <header className="flex flex-col gap-3">
        <p className="text-[11px] uppercase tracking-[0.3em] text-zinc-500">
          {status}
        </p>
        <h1 className="text-4xl font-semibold tracking-tight text-zinc-100">
          {hackathon.name}
        </h1>
        <p className="text-sm text-zinc-400">
          {formatDate(hackathon.start_date)}
          {hackathon.end_date ? ` → ${formatDate(hackathon.end_date)}` : null}
          {hackathon.luma_location ? ` · ${hackathon.luma_location}` : null}
        </p>
        {hackathon.luma_description ? (
          <p className="max-w-3xl text-sm leading-relaxed text-zinc-400">
            {hackathon.luma_description}
          </p>
        ) : null}
        {hackathon.luma_url ? (
          <p className="text-xs text-zinc-500">
            <Link
              href={hackathon.luma_url}
              target="_blank"
              className="underline hover:text-zinc-300"
            >
              Luma event →
            </Link>
          </p>
        ) : null}
      </header>

      <PortalsSection
        hackathonId={hackathon.id}
        config={config}
        summary={summary}
      />
    </div>
  );
}
