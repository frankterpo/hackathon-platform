import { HackathonCard } from "@/components/HackathonCard";
import type { HackathonRow } from "@/types/database";

type ColumnKey = "live" | "scheduled" | "completed";

const columns: { key: ColumnKey; title: string; hint: string }[] = [
  { key: "live", title: "Live", hint: "In progress" },
  { key: "scheduled", title: "Scheduled", hint: "Upcoming" },
  { key: "completed", title: "Completed", hint: "Archived" },
];

type Props = {
  hackathons: HackathonRow[];
  supabaseProjectRef: string | null;
  setupRequired: boolean;
};

export function HackathonBoard({
  hackathons,
  supabaseProjectRef,
  setupRequired,
}: Props) {
  const grouped = groupByStatus(hackathons);

  return (
    <div className="flex w-full flex-1 flex-col gap-8">
      <header className="space-y-2">
        <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-zinc-500">
          Master hackathon platform
        </p>
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-50 sm:text-3xl">
          Hackathon radar
        </h1>
        <p className="max-w-2xl text-sm leading-relaxed text-zinc-500">
          One repository, multiple events. Theme and routing follow each Vercel
          deployment; data and judging flow through Supabase submissions and
          scores.
        </p>
        {setupRequired ? (
          <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-100/90">
            Add{" "}
            <code className="rounded bg-black/40 px-1 py-0.5 font-mono text-xs">
              NEXT_PUBLIC_SUPABASE_URL
            </code>{" "}
            and{" "}
            <code className="rounded bg-black/40 px-1 py-0.5 font-mono text-xs">
              SUPABASE_SERVICE_ROLE_KEY
            </code>{" "}
            (or anon key + RLS policies) to load rows from{" "}
            <code className="font-mono text-xs">public.hackathons</code>.
          </p>
        ) : null}
      </header>

      <div className="grid gap-4 lg:grid-cols-3">
        {columns.map((col) => (
          <section
            key={col.key}
            className="flex min-h-[320px] flex-col gap-3 rounded-2xl border border-white/[0.06] bg-[#101010] p-4"
          >
            <div className="flex items-baseline justify-between gap-2 border-b border-white/[0.06] pb-3">
              <div>
                <h2 className="text-sm font-semibold text-zinc-100">
                  {col.title}
                </h2>
                <p className="text-xs text-zinc-600">{col.hint}</p>
              </div>
              <span className="rounded-full bg-white/5 px-2 py-0.5 text-[11px] font-medium text-zinc-400">
                {grouped[col.key].length}
              </span>
            </div>
            <div className="flex flex-1 flex-col gap-3">
              {grouped[col.key].length === 0 ? (
                <p className="rounded-lg border border-dashed border-white/10 px-3 py-6 text-center text-xs text-zinc-600">
                  No hackathons
                </p>
              ) : (
                grouped[col.key].map((h) => (
                  <HackathonCard
                    key={h.id}
                    hack={h}
                    supabaseProjectRef={supabaseProjectRef}
                  />
                ))
              )}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}

function groupByStatus(rows: HackathonRow[]): Record<ColumnKey, HackathonRow[]> {
  const base: Record<ColumnKey, HackathonRow[]> = {
    live: [],
    scheduled: [],
    completed: [],
  };
  for (const row of rows) {
    const k = row.status as ColumnKey;
    if (k === "live" || k === "scheduled" || k === "completed") {
      base[k].push(row);
    } else {
      base.scheduled.push(row);
    }
  }
  return base;
}
