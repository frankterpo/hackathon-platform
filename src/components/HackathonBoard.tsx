import { HackathonKanbanBoard } from "@/components/HackathonKanbanBoard";
import type { SupabaseEnvDiagnostics } from "@/lib/supabase/server";
import type { HackathonRow } from "@/types/database";

type Props = {
  hackathons: HackathonRow[];
  supabaseProjectRef: string | null;
  setupRequired: boolean;
  envDiagnostics?: SupabaseEnvDiagnostics;
  queryError?: string | null;
  usedDevMock?: boolean;
  /** Drag-and-drop + status writes (use on `/admin/master-panel`; needs SUPABASE_SERVICE_ROLE_KEY). */
  enableKanbanDrag?: boolean;
  /** Override default hero copy (e.g. admin vs public home). */
  eyebrow?: string;
  title?: string;
  description?: string;
};

export function HackathonBoard({
  hackathons,
  supabaseProjectRef,
  setupRequired,
  envDiagnostics,
  queryError = null,
  usedDevMock = false,
  enableKanbanDrag = false,
  eyebrow = "Master hackathon platform",
  title = "Hackathon radar",
  description = "One repository, multiple events. Theme and routing follow each Vercel deployment; data and judging flow through Supabase submissions and scores.",
}: Props) {
  const showQueryErrBanner = Boolean(queryError);
  const emptyConfiguredBoard =
    !setupRequired && !usedDevMock && !queryError && hackathons.length === 0;

  return (
    <div className="flex w-full flex-1 flex-col gap-8">
      <header className="space-y-2">
        <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-zinc-500">
          {eyebrow}
        </p>
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-50 sm:text-3xl">
          {title}
        </h1>
        <p className="max-w-2xl text-sm leading-relaxed text-zinc-500">
          {description}
        </p>
        {enableKanbanDrag ? (
          <p className="rounded-lg border border-white/[0.08] bg-white/[0.04] px-3 py-2 text-xs text-zinc-400">
            <span className="font-medium text-zinc-300">Admin:</span> drag cards
            between columns to update{" "}
            <code className="rounded bg-black/30 px-1 font-mono text-[11px]">
              status
            </code>{" "}
            in Supabase (service role required).
          </p>
        ) : null}
        {setupRequired ? (
          <div className="space-y-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-100/90">
            <p>
              The server could not build a Supabase client. Put keys in{" "}
              <code className="font-mono text-xs">.env.local</code> next to{" "}
              <code className="font-mono text-xs">package.json</code>, with no
              quotes wrapping the whole line, then <strong>restart</strong>{" "}
              <code className="font-mono text-xs">npm run dev</code>.
            </p>
            {envDiagnostics ? (
              <ul className="list-inside list-disc text-xs text-amber-100/80">
                {!envDiagnostics.urlPresent ? (
                  <li>
                    Missing URL — set{" "}
                    <code className="font-mono">NEXT_PUBLIC_SUPABASE_URL</code>{" "}
                    or <code className="font-mono">SUPABASE_URL</code> (e.g.{" "}
                    <code className="font-mono">
                      https://&lt;ref&gt;.supabase.co
                    </code>
                    ).
                  </li>
                ) : null}
                {envDiagnostics.urlInvalid ? (
                  <li>
                    URL is invalid — must be{" "}
                    <code className="font-mono">https://…</code> with no stray
                    spaces.
                  </li>
                ) : null}
                {!envDiagnostics.keyPresent ? (
                  <li>
                    Missing API key — set{" "}
                    <code className="font-mono">SUPABASE_SERVICE_ROLE_KEY</code>{" "}
                    (best for this app), or{" "}
                    <code className="font-mono">
                      NEXT_PUBLIC_SUPABASE_ANON_KEY
                    </code>
                    , or <code className="font-mono">SUPABASE_ANON_KEY</code>.
                  </li>
                ) : null}
              </ul>
            ) : null}
          </div>
        ) : null}
        {showQueryErrBanner ? (
          <p className="rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-100/95">
            <span className="font-semibold text-red-200">
              Supabase query failed:
            </span>{" "}
            <span className="font-mono text-xs">{queryError}</span>
            <span className="mt-1 block text-xs text-red-200/80">
              Check URL/key env vars, table{" "}
              <code className="rounded bg-black/30 px-1">
                public.hackathons
              </code>
              , and that migrations match{" "}
              <code className="rounded bg-black/30 px-1">
                supabase/migrations/
              </code>
              .
            </span>
          </p>
        ) : null}
        {usedDevMock ? (
          <p className="rounded-lg border border-cyan-500/35 bg-cyan-500/10 px-3 py-2 text-sm text-cyan-100/90">
            Showing{" "}
            <code className="rounded bg-black/40 px-1 py-0.5 font-mono text-xs">
              NEXT_PUBLIC_USE_MOCK_HACKATHONS=1
            </code>{" "}
            placeholder rows (development only).
          </p>
        ) : null}
        {emptyConfiguredBoard ? (
          <p className="rounded-lg border border-zinc-600/40 bg-zinc-800/40 px-3 py-2 text-sm text-zinc-300">
            No rows in{" "}
            <code className="rounded bg-black/40 px-1 font-mono text-xs">
              public.hackathons
            </code>
            . If you use the anon key, RLS may hide every row — use{" "}
            <code className="rounded bg-black/40 px-1 font-mono text-xs">
              SUPABASE_SERVICE_ROLE_KEY
            </code>{" "}
            on the server or add{" "}
            <code className="font-mono text-xs">SELECT</code> policies. Options:{" "}
            <code className="rounded bg-black/40 px-1 font-mono text-xs">
              npm run supabase:apply
            </code>
            , paste <code className="font-mono text-xs">supabase/seed.sql</code>{" "}
            in the SQL editor, or use{" "}
            <span className="font-medium text-zinc-200">Create hackathon</span>{" "}
            on{" "}
            <code className="rounded bg-black/40 px-1 font-mono text-xs">
              /admin/master-panel
            </code>{" "}
            with{" "}
            <code className="rounded bg-black/40 px-1 font-mono text-xs">
              ADMIN_SECRET
            </code>
            .
          </p>
        ) : null}
      </header>

      <HackathonKanbanBoard
        key={hackathons
          .map((h) => `${h.id}:${h.status}:${h.updated_at}`)
          .join("|")}
        hackathons={hackathons}
        supabaseProjectRef={supabaseProjectRef}
        interactive={enableKanbanDrag}
      />
    </div>
  );
}
