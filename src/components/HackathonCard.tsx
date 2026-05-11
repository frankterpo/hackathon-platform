import { CopySqlButtons } from "@/components/CopySqlButtons";
import {
  firebaseConsoleUrl,
  lumaEventUrl,
  lumaHostDashboardUrl,
  supabaseDatabaseTablesUrl,
  supabaseProjectHomeUrl,
  supabaseSqlEditorUrl,
  vercelDashboardFallbackUrl,
  vercelLiveDeploymentUrl,
  vercelTeamProjectUrl,
} from "@/lib/links";
import type { HackathonRow } from "@/types/database";

type Props = {
  hack: HackathonRow;
  supabaseProjectRef: string | null;
};

const linkClass =
  "inline-flex items-center gap-1 rounded-md border border-white/10 bg-white/5 px-2 py-1 text-xs text-zinc-300 transition hover:border-white/20 hover:bg-white/10 hover:text-white";

const mutedClass =
  "inline-flex cursor-not-allowed items-center gap-1 rounded-md border border-white/5 bg-white/[0.03] px-2 py-1 text-xs text-zinc-600";

function BoardLink({
  href,
  label,
  title,
}: {
  href: string;
  label: string;
  title: string;
}) {
  if (href === "#") {
    return (
      <span
        className={mutedClass}
        title={`${title} — add value on this hackathon row`}
        aria-disabled
      >
        {label}
        <span className="sr-only"> (not configured)</span>
      </span>
    );
  }
  return (
    <a
      className={linkClass}
      href={href}
      target="_blank"
      rel="noreferrer"
      title={title}
    >
      {label}
    </a>
  );
}

export function HackathonCard({ hack, supabaseProjectRef }: Props) {
  const theme = hack.theme_slug ?? "default";
  const dateRange = formatRange(hack.start_date, hack.end_date);
  const slug = hack.vercel_project_slug;

  const liveUrl = vercelLiveDeploymentUrl(slug);
  const teamProjectUrl = vercelTeamProjectUrl(slug);
  const vercelFallback = vercelDashboardFallbackUrl();
  const vercelProjectHref = teamProjectUrl ?? vercelFallback;

  const lumaEventHref = lumaEventUrl(hack.luma_url ?? hack.luma_event_id);
  const lumaHostHref = lumaHostDashboardUrl(hack.luma_event_id);

  const firebaseHref = firebaseConsoleUrl(hack.firebase_config_ref);

  const supabaseHome = supabaseProjectHomeUrl(supabaseProjectRef);
  const supabaseTables = supabaseDatabaseTablesUrl(supabaseProjectRef);
  const supabaseSql = supabaseSqlEditorUrl(supabaseProjectRef);

  return (
    <article className="flex flex-col gap-3 rounded-xl border border-white/[0.08] bg-[#141414] p-4 shadow-[0_0_0_1px_rgba(255,255,255,0.04)]">
      <div className="space-y-1">
        <h3 className="text-sm font-semibold tracking-tight text-zinc-50">
          {hack.name}
        </h3>
        <p className="text-xs text-zinc-500">{dateRange}</p>
        <p className="text-[11px] uppercase tracking-wider text-zinc-600">
          Theme · {theme}
        </p>
      </div>
      <div className="flex flex-col gap-1.5">
        <span className="text-[10px] font-medium uppercase tracking-widest text-zinc-600">
          Links
        </span>
        <div className="flex flex-wrap gap-1.5">
          <BoardLink
            href={liveUrl ?? "#"}
            label="Vercel · live"
            title={
              slug
                ? "Deployment URL (slug.vercel.app)"
                : "Set vercel_project_slug on this row for the live app URL"
            }
          />
          <BoardLink
            href={vercelProjectHref}
            label="Vercel · project"
            title={
              teamProjectUrl
                ? "Team project on Vercel"
                : "Set NEXT_PUBLIC_VERCEL_TEAM in .env.local for a direct team/project link"
            }
          />
          <BoardLink
            href={lumaEventHref}
            label="Luma · event"
            title="Public event page (set luma_url or a public slug)"
          />
          <BoardLink
            href={lumaHostHref}
            label="Luma · host"
            title={
              hack.luma_event_id
                ? "Host dashboard for this event (requires your Luma session)"
                : "Hosted events dashboard (requires your Luma session)"
            }
          />
          <BoardLink
            href={firebaseHref}
            label="Firebase"
            title={
              hack.firebase_config_ref
                ? "Firebase console for this project"
                : "Set firebase_config_ref to the Firebase project ID (not display name)"
            }
          />
          <BoardLink
            href={supabaseHome}
            label="Supabase · project"
            title="Supabase project dashboard (set NEXT_PUBLIC_SUPABASE_PROJECT_REF for correct deep links)"
          />
          <BoardLink
            href={supabaseTables}
            label="Supabase · tables"
            title="Database → tables — filter public.hackathons and open your row"
          />
          <BoardLink
            href={supabaseSql}
            label="Supabase · SQL"
            title="SQL editor — paste copied queries (Studio cannot pre-fill filters via URL)"
          />
        </div>
        <div className="mt-1 flex flex-col gap-1.5 border-t border-white/[0.06] pt-2">
          <span className="text-[10px] font-medium uppercase tracking-widest text-zinc-600">
            Filter SQL
          </span>
          <CopySqlButtons hackId={hack.id} />
        </div>
      </div>
    </article>
  );
}

function formatRange(start: string | null, end: string | null): string {
  if (!start && !end) {
    return "Dates TBC";
  }
  const formatter = new Intl.DateTimeFormat("en-GB", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
  const fmt = (s: string | null) =>
    s ? formatter.format(new Date(s)) : "…";
  return `${fmt(start)} → ${fmt(end)}`;
}
