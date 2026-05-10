import type { HackathonRow } from "@/types/database";
import {
  firebaseConsoleUrl,
  lumaEventUrl,
  supabaseDashboardUrl,
  vercelDeploymentGuess,
  vercelProjectUrl,
} from "@/lib/links";

type Props = {
  hack: HackathonRow;
  supabaseProjectRef: string | null;
};

const linkClass =
  "inline-flex items-center gap-1 rounded-md border border-white/10 bg-white/5 px-2 py-1 text-xs text-zinc-300 transition hover:border-white/20 hover:bg-white/10 hover:text-white";

export function HackathonCard({ hack, supabaseProjectRef }: Props) {
  const theme = hack.theme_slug ?? "default";
  const dateRange = formatRange(hack.start_date, hack.end_date);
  const slug = hack.vercel_project_slug;

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
          <a
            className={linkClass}
            href={vercelDeploymentGuess(slug)}
            target="_blank"
            rel="noreferrer"
          >
            Vercel live
          </a>
          <a
            className={linkClass}
            href={vercelProjectUrl(slug)}
            target="_blank"
            rel="noreferrer"
          >
            Vercel project
          </a>
          <a
            className={linkClass}
            href={lumaEventUrl(hack.luma_event_id)}
            target="_blank"
            rel="noreferrer"
          >
            Luma
          </a>
          <a
            className={linkClass}
            href={firebaseConsoleUrl(hack.firebase_config_ref)}
            target="_blank"
            rel="noreferrer"
          >
            Firebase
          </a>
          <a
            className={linkClass}
            href={supabaseDashboardUrl(supabaseProjectRef)}
            target="_blank"
            rel="noreferrer"
          >
            Supabase
          </a>
        </div>
      </div>
    </article>
  );
}

function formatRange(start: string | null, end: string | null): string {
  if (!start && !end) {
    return "Dates TBC";
  }
  const fmt = (s: string | null) =>
    s
      ? new Date(s).toLocaleDateString(undefined, {
          month: "short",
          day: "numeric",
          year: "numeric",
        })
      : "…";
  return `${fmt(start)} → ${fmt(end)}`;
}
