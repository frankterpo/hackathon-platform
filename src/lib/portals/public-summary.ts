import "server-only";

import { createServerSupabaseClient } from "@/lib/supabase/server";

export type CreditsSummary = {
  allocated: number;
  claimed: number;
  unclaimed: number;
  totalUsd: number | null;
  /** Sorted: claimed first, then unclaimed. Emails are masked. */
  rows: Array<{
    name: string;
    emailMasked: string;
    amountUsd: number | null;
    claimedAt: string | null;
  }>;
};

export type SubmissionsSummary = {
  count: number;
  rows: Array<{
    id: string;
    title: string;
    teamName: string | null;
    repoUrl: string | null;
    submitterMasked: string | null;
    createdAt: string;
    avg: number | null;
    numScores: number;
  }>;
};

export type JudgesSummary = {
  judgeCount: number;
  scoreCount: number;
  rows: Array<{
    submissionId: string;
    submissionTitle: string;
    teamName: string | null;
    avg: number | null;
    numScores: number;
    scores: Array<{
      judgeMasked: string;
      score: number;
      notes: string | null;
    }>;
  }>;
};

export type PublicHackSummary = {
  credits: CreditsSummary;
  submissions: SubmissionsSummary;
  judges: JudgesSummary;
};

const EMPTY: PublicHackSummary = {
  credits: { allocated: 0, claimed: 0, unclaimed: 0, totalUsd: null, rows: [] },
  submissions: { count: 0, rows: [] },
  judges: { judgeCount: 0, scoreCount: 0, rows: [] },
};

/**
 * Mask "francisco@gmail.com" → "f***@gmail.com". Keeps the domain so people can
 * still recognise themselves, hides the local-part to keep the public hack
 * page from leaking attendee emails.
 */
function maskEmail(email: string | null | undefined): string {
  if (!email) return "—";
  const trimmed = email.trim();
  const at = trimmed.indexOf("@");
  if (at < 1) return "—";
  const local = trimmed.slice(0, at);
  const domain = trimmed.slice(at + 1);
  const lead = local[0] ?? "";
  return `${lead}***@${domain}`;
}

function fullName(first: string | null, last: string | null): string {
  const f = (first ?? "").trim();
  const l = (last ?? "").trim();
  if (!f && !l) return "—";
  if (l) return `${f} ${l[0]}.`.trim();
  return f;
}

export async function loadPublicHackSummary(
  hackathonId: string,
): Promise<PublicHackSummary> {
  const supabase = createServerSupabaseClient();
  if (!supabase) return EMPTY;
  const id = hackathonId.trim();
  if (!id) return EMPTY;

  const [allocRes, claimRes, subsRes] = await Promise.all([
    supabase
      .from("credit_allocations")
      .select("email,first_name,last_name,amount_usd")
      .eq("hackathon_id", id),
    supabase
      .from("credit_claims")
      .select("email,claimed_at")
      .eq("hackathon_id", id),
    supabase
      .from("submissions")
      .select(
        "id,title,team_name,repo_url,submitter_email,created_at",
      )
      .eq("hackathon_id", id)
      .order("created_at", { ascending: true }),
  ]);

  const allocations = (allocRes.data ?? []) as Array<{
    email: string;
    first_name: string | null;
    last_name: string | null;
    amount_usd: number | null;
  }>;
  const claims = (claimRes.data ?? []) as Array<{
    email: string;
    claimed_at: string;
  }>;
  const submissions = (subsRes.data ?? []) as Array<{
    id: string;
    title: string;
    team_name: string | null;
    repo_url: string | null;
    submitter_email: string | null;
    created_at: string;
  }>;

  const claimedMap = new Map<string, string>();
  for (const c of claims) claimedMap.set(c.email.toLowerCase(), c.claimed_at);

  const totalUsd = allocations.reduce(
    (sum, a) => sum + Number(a.amount_usd ?? 0),
    0,
  );
  const claimedCount = allocations.reduce(
    (n, a) => n + (claimedMap.has(a.email.toLowerCase()) ? 1 : 0),
    0,
  );

  const creditRows = allocations
    .map((a) => ({
      name: fullName(a.first_name, a.last_name),
      emailMasked: maskEmail(a.email),
      amountUsd: a.amount_usd === null ? null : Number(a.amount_usd),
      claimedAt: claimedMap.get(a.email.toLowerCase()) ?? null,
    }))
    .sort((a, b) => {
      if (Boolean(a.claimedAt) !== Boolean(b.claimedAt)) {
        return a.claimedAt ? -1 : 1;
      }
      return a.name.localeCompare(b.name);
    });

  // Judge scores per submission
  const submissionIds = submissions.map((s) => s.id);
  let scoreRows: Array<{
    submission_id: string;
    judge_email: string | null;
    score: number;
    notes: string | null;
  }> = [];
  let judgeRows: Array<{ email: string; display_name: string | null }> = [];
  if (submissionIds.length > 0) {
    const { data } = await supabase
      .from("judge_scores")
      .select("submission_id,judge_email,score,notes")
      .in("submission_id", submissionIds);
    scoreRows = (data ?? []) as typeof scoreRows;
  }
  const { data: judgesData } = await supabase
    .from("hackathon_judges")
    .select("email,display_name")
    .eq("hackathon_id", id);
  judgeRows = (judgesData ?? []) as typeof judgeRows;

  const scoresBySub = new Map<
    string,
    Array<{ judgeMasked: string; score: number; notes: string | null }>
  >();
  for (const sr of scoreRows) {
    const arr = scoresBySub.get(sr.submission_id) ?? [];
    arr.push({
      judgeMasked: maskEmail(sr.judge_email),
      score: Number(sr.score),
      notes: sr.notes,
    });
    scoresBySub.set(sr.submission_id, arr);
  }

  const submissionRows = submissions.map((s) => {
    const list = scoresBySub.get(s.id) ?? [];
    const avg =
      list.length > 0
        ? list.reduce((sum, x) => sum + x.score, 0) / list.length
        : null;
    return {
      id: s.id,
      title: s.title,
      teamName: s.team_name,
      repoUrl: s.repo_url,
      submitterMasked: s.submitter_email ? maskEmail(s.submitter_email) : null,
      createdAt: s.created_at,
      avg,
      numScores: list.length,
    };
  });

  const judgeBreakdownRows = submissions
    .map((s) => {
      const list = scoresBySub.get(s.id) ?? [];
      const avg =
        list.length > 0
          ? list.reduce((sum, x) => sum + x.score, 0) / list.length
          : null;
      return {
        submissionId: s.id,
        submissionTitle: s.title,
        teamName: s.team_name,
        avg,
        numScores: list.length,
        scores: list.sort((a, b) => b.score - a.score),
      };
    })
    .sort((a, b) => (b.avg ?? -1) - (a.avg ?? -1));

  return {
    credits: {
      allocated: allocations.length,
      claimed: claimedCount,
      unclaimed: allocations.length - claimedCount,
      totalUsd: allocations.length > 0 ? totalUsd : null,
      rows: creditRows,
    },
    submissions: {
      count: submissions.length,
      rows: submissionRows,
    },
    judges: {
      judgeCount: judgeRows.length,
      scoreCount: scoreRows.length,
      rows: judgeBreakdownRows,
    },
  };
}
