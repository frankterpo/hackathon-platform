import Link from "next/link";
import { notFound } from "next/navigation";

import { MagicLinkForm } from "@/components/MagicLinkForm";
import { loadJudge, requireHackathon } from "@/lib/portals/access";
import { gateJudge, gateMessage } from "@/lib/portals/portal-checks";
import { getAuthUser } from "@/lib/supabase/auth";
import { createServerSupabaseClient } from "@/lib/supabase/server";

import { JudgeRowClient } from "./JudgeRowClient";

export const dynamic = "force-dynamic";

type Params = { hack_id: string };

type SubmissionLite = {
  id: string;
  title: string;
  team_name: string | null;
  repo_url: string | null;
  demo_url: string | null;
  chosen_track: string | null;
};

type ScoreLite = {
  submission_id: string;
  score: number;
  notes: string | null;
};

type RubricShape = {
  max?: number;
  criteria?: string[];
  notes?: string;
};

export default async function JudgePortalPage({
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

  const gate = await gateJudge(hackathon.id);
  if (!gate.ok) {
    return (
      <Shell hackathon={hackathon}>
        <div className="rounded-xl border border-cyan-400/30 bg-cyan-400/5 p-5 text-sm text-cyan-200">
          {gateMessage(gate.reason)}
        </div>
      </Shell>
    );
  }

  const next = `/app/${hackathon.id}/judge`;
  const { email, userId } = await getAuthUser();

  if (!email) {
    return (
      <Shell hackathon={hackathon}>
        <MagicLinkForm
          next={next}
          intro="Judges sign in with the email the organizers added to the judge list."
        />
      </Shell>
    );
  }

  const { judge } = await loadJudge(hackathon.id, email);
  if (!judge) {
    return (
      <Shell hackathon={hackathon}>
        <p className="text-sm text-zinc-300">
          Signed in as <span className="text-zinc-100">{email}</span>.
        </p>
        <div className="rounded-xl border border-rose-400/30 bg-rose-400/5 p-5 text-sm text-rose-200">
          You are not on the judge list for{" "}
          <span className="font-medium">{hackathon.name}</span>. Ask the
          organizers to add your email.
        </div>
      </Shell>
    );
  }

  const supabase = createServerSupabaseClient();
  let submissions: SubmissionLite[] = [];
  let scores: ScoreLite[] = [];
  let rubric: RubricShape = { max: 10 };

  if (supabase) {
    const [subsRes, scoresRes, rubricRes] = await Promise.all([
      supabase
        .from("submissions")
        .select("id,title,team_name,repo_url,demo_url,chosen_track")
        .eq("hackathon_id", hackathon.id)
        .order("created_at", { ascending: true }),
      userId
        ? judge.judge_id
          ? supabase
              .from("judge_scores")
              .select("submission_id,score,notes")
              .or(
                `judge_user_id.eq.${userId},judge_id.eq.${judge.judge_id}`,
              )
          : supabase
              .from("judge_scores")
              .select("submission_id,score,notes")
              .eq("judge_user_id", userId)
        : Promise.resolve({ data: [] as ScoreLite[], error: null } as const),
      supabase
        .from("hackathon_judging_criteria")
        .select("rubric,notes")
        .eq("hackathon_id", hackathon.id)
        .maybeSingle(),
    ]);
    submissions = (subsRes.data as SubmissionLite[]) ?? [];
    scores = (scoresRes.data as ScoreLite[]) ?? [];
    if (rubricRes.data) {
      const merged = (rubricRes.data.rubric ?? {}) as RubricShape;
      rubric = {
        max: merged.max ?? 10,
        criteria: merged.criteria,
        notes: rubricRes.data.notes ?? merged.notes,
      };
    }
  }

  const scoreByid = new Map(scores.map((s) => [s.submission_id, s] as const));

  return (
    <Shell hackathon={hackathon}>
      <p className="text-sm text-zinc-300">
        Signed in as <span className="text-zinc-100">{email}</span> · scoring
        out of <span className="font-mono">{rubric.max ?? 10}</span>.
      </p>
      {rubric.criteria && rubric.criteria.length ? (
        <p className="text-xs text-zinc-500">
          Rubric: {rubric.criteria.join(" · ")}
        </p>
      ) : null}
      {rubric.notes ? (
        <p className="text-xs text-zinc-500">{rubric.notes}</p>
      ) : null}

      {submissions.length === 0 ? (
        <p className="rounded-lg border border-dashed border-white/5 bg-zinc-900/30 p-4 text-xs text-zinc-500">
          No submissions yet.
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {submissions.map((s) => (
            <JudgeRowClient
              key={s.id}
              hackathonId={hackathon.id}
              submission={s}
              existing={
                scoreByid.has(s.id)
                  ? {
                      score: scoreByid.get(s.id)!.score,
                      notes: scoreByid.get(s.id)!.notes,
                    }
                  : null
              }
            />
          ))}
        </ul>
      )}
    </Shell>
  );
}

function Shell({
  hackathon,
  children,
}: {
  hackathon: { id: string; name: string };
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-1">
        <p className="text-xs uppercase tracking-[0.2em] text-cyan-300/80">
          Judging portal
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
      {children}
    </div>
  );
}
