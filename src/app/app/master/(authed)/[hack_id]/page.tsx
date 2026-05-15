import Link from "next/link";
import { notFound } from "next/navigation";

import {
  loadHackathonCounts,
  loadPortalConfig,
} from "@/lib/portals/admin-data";
import { loadHackathonById, createServerSupabaseClient } from "@/lib/supabase/server";
import {
  hackathonFirebaseProjectId,
  hackathonLumaEventId,
  hackathonLumaEventTitle,
} from "@/types/database";
import { LumaSyncButton } from "./LumaSyncButton";
import { PortalConfigForm } from "./PortalConfigForm";

export const dynamic = "force-dynamic";

type Params = { hack_id: string };

type SubmissionLite = {
  id: string;
  title: string;
  team_name: string | null;
  repo_url: string | null;
  submitter_email: string | null;
  created_at: string;
};

type ScoreSummary = {
  submission_id: string;
  avg_score: number;
  num_scores: number;
};

async function loadSubmissionsAndScores(hackathonId: string): Promise<{
  submissions: SubmissionLite[];
  scoreBySubmission: Map<string, ScoreSummary>;
}> {
  const supabase = createServerSupabaseClient();
  const empty = { submissions: [], scoreBySubmission: new Map() };
  if (!supabase) return empty;

  const { data: subs } = await supabase
    .from("submissions")
    .select("id,title,team_name,repo_url,submitter_email,created_at")
    .eq("hackathon_id", hackathonId)
    .order("created_at", { ascending: true });

  const submissions = (subs ?? []) as SubmissionLite[];
  const ids = submissions.map((s) => s.id);
  if (ids.length === 0) return { submissions, scoreBySubmission: new Map() };

  const { data: scores } = await supabase
    .from("judge_scores")
    .select("submission_id,score")
    .in("submission_id", ids);

  const map = new Map<string, ScoreSummary>();
  for (const row of (scores ?? []) as { submission_id: string; score: number }[]) {
    const cur = map.get(row.submission_id);
    if (cur) {
      const total = cur.avg_score * cur.num_scores + Number(row.score);
      cur.num_scores += 1;
      cur.avg_score = total / cur.num_scores;
    } else {
      map.set(row.submission_id, {
        submission_id: row.submission_id,
        avg_score: Number(row.score),
        num_scores: 1,
      });
    }
  }

  return { submissions, scoreBySubmission: map };
}

function StatTile({
  label,
  value,
  hint,
}: {
  label: string;
  value: string | number;
  hint?: string;
}) {
  return (
    <div className="flex flex-col gap-0.5 rounded-lg border border-white/5 bg-zinc-950/50 p-3">
      <span className="text-[10px] uppercase tracking-wider text-zinc-500">
        {label}
      </span>
      <span className="text-lg font-semibold text-zinc-100">{value}</span>
      {hint ? <span className="text-[11px] text-zinc-500">{hint}</span> : null}
    </div>
  );
}

export default async function MasterHackPage({
  params,
}: {
  params: Promise<Params>;
}) {
  const { hack_id } = await params;
  const { hackathon, error } = await loadHackathonById(hack_id);
  if (error) {
    return (
      <div className="rounded-lg border border-rose-500/40 bg-rose-500/5 p-4 text-sm text-rose-200">
        {error}
      </div>
    );
  }
  if (!hackathon) notFound();

  const [config, counts, { submissions, scoreBySubmission }] = await Promise.all([
    loadPortalConfig(hackathon.id),
    loadHackathonCounts(hackathon.id),
    loadSubmissionsAndScores(hackathon.id),
  ]);

  const lumaTitle = hackathonLumaEventTitle(hackathon);
  const headerTitle = lumaTitle ?? hackathon.name;
  const lumaUrl = hackathon.luma_url?.trim();
  const headerIsLinkedLuma =
    Boolean(lumaTitle) && Boolean(lumaUrl && lumaUrl.length > 0);

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-2">
        <Link
          href="/app/master"
          className="text-xs text-zinc-500 hover:text-zinc-300"
        >
          ← Master
        </Link>
        <h1 className="text-3xl font-semibold tracking-tight text-zinc-100">
          {headerIsLinkedLuma ? (
            <a
              href={lumaUrl}
              target="_blank"
              rel="noreferrer"
              className="text-inherit underline-offset-4 hover:underline"
            >
              {headerTitle}
            </a>
          ) : (
            headerTitle
          )}
        </h1>
        <p className="text-sm text-zinc-400">
          Status: <span className="capitalize text-zinc-200">{hackathon.status}</span>
          {" · "}
          Hack id: <code className="text-zinc-300">{hackathon.id}</code>
        </p>
        <div className="grid grid-cols-3 gap-2 text-[11px] sm:max-w-xl">
          <Link
            href={`/app/${hackathon.id}/credits`}
            className="rounded-md border border-amber-400/30 bg-amber-400/5 px-2 py-1.5 text-center text-amber-200 hover:border-amber-300/50"
          >
            Open Credits portal →
          </Link>
          <Link
            href={`/app/${hackathon.id}/submit`}
            className="rounded-md border border-violet-400/30 bg-violet-400/5 px-2 py-1.5 text-center text-violet-200 hover:border-violet-300/50"
          >
            Open Submit portal →
          </Link>
          <Link
            href={`/app/${hackathon.id}/judge`}
            className="rounded-md border border-cyan-400/30 bg-cyan-400/5 px-2 py-1.5 text-center text-cyan-200 hover:border-cyan-300/50"
          >
            Open Judge portal →
          </Link>
        </div>
      </header>

      <section className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
        <StatTile label="Attendees" value={counts.attendees} />
        <StatTile label="Judges" value={counts.judges} />
        <StatTile
          label="Credit allocations"
          value={counts.allocations}
          hint={`${counts.claims} claimed`}
        />
        <StatTile label="Submissions" value={counts.submissions} />
        <StatTile label="Judge scores" value={counts.scores} />
        <StatTile
          label="Firebase project"
          value={hackathonFirebaseProjectId(hackathon) ?? "—"}
        />
      </section>

      <section className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <PortalConfigForm hackathonId={hackathon.id} initial={config} />

        <div className="flex flex-col gap-3">
          <h2 className="text-sm font-semibold uppercase tracking-[0.2em] text-zinc-400">
            Quick admin actions
          </h2>
          <LumaSyncButton
            hackathonId={hackathon.id}
            hasLumaId={Boolean(hackathonLumaEventId(hackathon))}
          />
          <Link
            href={`/admin/hackathons/${hackathon.id}/import`}
            className="rounded-lg border border-white/10 bg-zinc-900/40 p-3 text-sm text-zinc-200 hover:border-white/20"
          >
            CSV import (attendees · credits · judges)
            <p className="mt-0.5 text-[11px] text-zinc-500">
              Late check-ins are upserted by email — already-claimed rows are
              never disturbed.
            </p>
          </Link>
          <Link
            href={`/admin/hackathons/${hackathon.id}/tasks`}
            className="rounded-lg border border-white/10 bg-zinc-900/40 p-3 text-sm text-zinc-200 hover:border-white/20"
          >
            Operational task board (existing)
          </Link>
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <div className="flex items-baseline justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-[0.2em] text-zinc-400">
            Submissions ({submissions.length})
          </h2>
          <span className="text-xs text-zinc-600">
            Read-only · live mirror of <code>public.submissions</code>
          </span>
        </div>
        {submissions.length === 0 ? (
          <p className="rounded-lg border border-dashed border-white/5 bg-zinc-900/30 p-4 text-xs text-zinc-500">
            No submissions yet.
          </p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-white/5">
            <table className="min-w-full divide-y divide-white/5 text-sm">
              <thead className="bg-zinc-900/60 text-left text-[10px] uppercase tracking-wider text-zinc-500">
                <tr>
                  <th className="px-3 py-2">Title</th>
                  <th className="px-3 py-2">Team</th>
                  <th className="px-3 py-2">Submitter</th>
                  <th className="px-3 py-2">Repo</th>
                  <th className="px-3 py-2 text-right">Avg score</th>
                  <th className="px-3 py-2 text-right">#</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {submissions.map((s) => {
                  const score = scoreBySubmission.get(s.id);
                  return (
                    <tr key={s.id} className="hover:bg-zinc-900/40">
                      <td className="px-3 py-2 text-zinc-100">{s.title}</td>
                      <td className="px-3 py-2 text-zinc-400">
                        {s.team_name ?? "—"}
                      </td>
                      <td className="px-3 py-2 text-zinc-400">
                        {s.submitter_email ?? "—"}
                      </td>
                      <td className="px-3 py-2 text-zinc-400">
                        {s.repo_url ? (
                          <a
                            href={s.repo_url}
                            target="_blank"
                            rel="noreferrer"
                            className="underline hover:text-zinc-200"
                          >
                            link
                          </a>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className="px-3 py-2 text-right font-mono text-zinc-200">
                        {score ? score.avg_score.toFixed(1) : "—"}
                      </td>
                      <td className="px-3 py-2 text-right font-mono text-zinc-500">
                        {score ? score.num_scores : 0}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
