import Link from "next/link";

import { CreateHackathonForm } from "@/components/CreateHackathonForm";
import {
  loadAllPortalConfigs,
  loadAttendeeCountsForHackathons,
  type PortalConfigRow,
} from "@/lib/portals/admin-data";
import {
  hackathonLaneStatus,
  hideHackathonFromMasterOverview,
} from "@/lib/hackathons/master-overview";
import { loadHackathonsForBoard } from "@/lib/supabase/server";
import {
  type HackathonRow,
  type HackathonStatus,
  hackathonFirebaseProjectId,
  hackathonLumaEventId,
} from "@/types/database";

export const dynamic = "force-dynamic";

const STATUS_ORDER: HackathonStatus[] = ["live", "scheduled", "completed"];

const STATUS_COPY: Record<HackathonStatus, { label: string; tone: string }> = {
  live: { label: "Live", tone: "bg-emerald-500/15 text-emerald-300" },
  scheduled: { label: "Scheduled", tone: "bg-sky-500/15 text-sky-300" },
  completed: { label: "Completed", tone: "bg-zinc-500/15 text-zinc-300" },
};

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  } catch {
    return "—";
  }
}

function PortalChip({
  label,
  enabled,
  title,
}: {
  label: string;
  enabled: boolean;
  title?: string;
}) {
  return (
    <span
      title={title}
      className={`rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider ${
        enabled
          ? "bg-emerald-500/15 text-emerald-300"
          : "bg-zinc-700/30 text-zinc-500 line-through"
      }`}
    >
      {label}
    </span>
  );
}

function HackathonCardAdmin({
  hackathon,
  config,
  attendeeCount,
}: {
  hackathon: HackathonRow;
  config: PortalConfigRow | null;
  attendeeCount: number;
}) {
  const lane = hackathonLaneStatus(hackathon);
  const status = STATUS_COPY[lane];
  const credits = config?.credits_enabled ?? false;
  const submissions = config?.submissions_enabled ?? false;
  const judging = config?.judging_enabled ?? false;
  const lumaId = hackathonLumaEventId(hackathon);
  const lumaTitle = lumaId ?? hackathon.luma_url ?? "—";
  const fbProj = hackathonFirebaseProjectId(hackathon);
  return (
    <Link
      href={`/app/master/${hackathon.id}`}
      className="group flex flex-col gap-3 rounded-xl border border-white/5 bg-zinc-900/40 p-4 transition hover:border-white/15"
    >
      <div className="flex items-start justify-between gap-3">
        <h3 className="text-sm font-semibold leading-snug text-zinc-100 group-hover:text-white">
          {hackathon.name}
        </h3>
        <span
          className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider ${status.tone}`}
        >
          {status.label}
        </span>
      </div>
      <p className="text-xs text-zinc-400">
        {formatDate(hackathon.start_date)} → {formatDate(hackathon.end_date)}
      </p>
      <div className="flex flex-wrap gap-1.5">
        <PortalChip
          label="Credits"
          enabled={credits}
          title="Uses hackathon_portal_config.credits_enabled. When off, /app/…/credits shows closed."
        />
        <PortalChip
          label="Submit"
          enabled={submissions}
          title="Uses hackathon_portal_config.submissions_enabled (plus open/close window)."
        />
        <PortalChip
          label="Judge"
          enabled={judging}
          title="Uses hackathon_portal_config.judging_enabled."
        />
      </div>
      <dl className="grid grid-cols-3 gap-2 text-[10px] uppercase tracking-wider text-zinc-500">
        <div className="flex flex-col rounded-md border border-white/5 bg-zinc-950/40 px-2 py-1">
          <dt>Firebase</dt>
          <dd
            className="truncate text-[11px] font-mono text-zinc-300"
            title={fbProj ?? "—"}
          >
            {fbProj ?? "—"}
          </dd>
        </div>
        <div className="flex flex-col rounded-md border border-white/5 bg-zinc-950/40 px-2 py-1">
          <dt>Vercel</dt>
          <dd
            className="truncate text-[11px] font-mono text-zinc-300"
            title={hackathon.vercel_project_slug ?? "—"}
          >
            {hackathon.vercel_project_slug ?? "—"}
          </dd>
        </div>
        <div className="flex flex-col rounded-md border border-white/5 bg-zinc-950/40 px-2 py-1">
          <dt>Luma</dt>
          <dd
            className="truncate text-[11px] font-mono text-zinc-300"
            title={lumaTitle}
          >
            {lumaId ? (
              <>
                {lumaId}
                {attendeeCount > 0 ? (
                  <span className="text-zinc-500"> · {attendeeCount} synced</span>
                ) : null}
              </>
            ) : attendeeCount > 0 ? (
              <>
                <span className="text-zinc-500">No evt id · </span>
                {attendeeCount} synced
              </>
            ) : (
              "—"
            )}
          </dd>
        </div>
      </dl>
    </Link>
  );
}

export default async function MasterAuthedHomePage() {
  const [
    { hackathons, queryError, supabaseEnvReady, envDiagnostics },
    configs,
  ] = await Promise.all([loadHackathonsForBoard(), loadAllPortalConfigs()]);

  const requireFirebase =
    process.env.MASTER_OVERVIEW_REQUIRE_FIREBASE?.trim() === "1";
  const visible = hackathons.filter(
    (h) => !hideHackathonFromMasterOverview(h, { requireFirebase }),
  );
  const attendeeCounts =
    visible.length > 0
      ? await loadAttendeeCountsForHackathons(visible.map((h) => h.id))
      : new Map<string, number>();

  const grouped = STATUS_ORDER.map((status) => ({
    status,
    rows: visible.filter((h) => hackathonLaneStatus(h) === status),
  }));

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-100">
          Master overview
        </h1>
        <p className="text-sm text-zinc-400">
          Hackathons with a Luma event id, showing the three portals (credits ·
          submit · judge) and paired Firebase / Vercel identifiers. Click a card
          to configure.
        </p>
      </header>

      <CreateHackathonForm />

      {!supabaseEnvReady ? (
        <div className="rounded-lg border border-amber-500/40 bg-amber-500/5 p-4 text-sm text-amber-200">
          Supabase env not detected. URL present:{" "}
          {String(envDiagnostics.urlPresent)} · key present:{" "}
          {String(envDiagnostics.keyPresent)}.
        </div>
      ) : null}

      {queryError ? (
        <div className="rounded-lg border border-rose-500/40 bg-rose-500/5 p-4 text-sm text-rose-200">
          Supabase query error: {queryError}
        </div>
      ) : null}

      {grouped.map(({ status, rows }) => (
        <section key={status} className="flex flex-col gap-3">
          <div className="flex items-baseline justify-between">
            <h2 className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-400">
              {STATUS_COPY[status].label}
            </h2>
            <span className="text-xs text-zinc-600">{rows.length}</span>
          </div>
          {rows.length === 0 ? (
            <p className="rounded-lg border border-dashed border-white/5 bg-zinc-900/30 p-4 text-xs text-zinc-500">
              No hackathons in this lane yet.
            </p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {rows.map((h) => (
                <HackathonCardAdmin
                  key={h.id}
                  hackathon={h}
                  config={configs.get(h.id) ?? null}
                  attendeeCount={attendeeCounts.get(h.id) ?? 0}
                />
              ))}
            </div>
          )}
        </section>
      ))}
    </div>
  );
}
