import "server-only";

import { createServerSupabaseClient } from "@/lib/supabase/server";

export type PortalConfigRow = {
  hackathon_id: string;
  credits_enabled: boolean;
  submissions_enabled: boolean;
  submissions_open_at: string | null;
  submissions_close_at: string | null;
  judging_enabled: boolean;
  judges_can_see_other_scores: boolean;
};

export const DEFAULT_CONFIG: Omit<PortalConfigRow, "hackathon_id"> = {
  credits_enabled: false,
  submissions_enabled: false,
  submissions_open_at: null,
  submissions_close_at: null,
  judging_enabled: false,
  judges_can_see_other_scores: false,
};

export async function loadPortalConfig(
  hackathonId: string,
): Promise<PortalConfigRow> {
  const supabase = createServerSupabaseClient();
  if (!supabase) {
    return { hackathon_id: hackathonId, ...DEFAULT_CONFIG };
  }
  const { data, error } = await supabase
    .from("hackathon_portal_config")
    .select(
      "hackathon_id,credits_enabled,submissions_enabled,submissions_open_at,submissions_close_at,judging_enabled,judges_can_see_other_scores",
    )
    .eq("hackathon_id", hackathonId)
    .maybeSingle();
  if (error || !data) {
    return { hackathon_id: hackathonId, ...DEFAULT_CONFIG };
  }
  return data as PortalConfigRow;
}

export type HackathonCounts = {
  attendees: number;
  judges: number;
  allocations: number;
  claims: number;
  submissions: number;
  scores: number;
};

export async function loadHackathonCounts(
  hackathonId: string,
): Promise<HackathonCounts> {
  const supabase = createServerSupabaseClient();
  const empty: HackathonCounts = {
    attendees: 0,
    judges: 0,
    allocations: 0,
    claims: 0,
    submissions: 0,
    scores: 0,
  };
  if (!supabase) return empty;

  const head = { count: "exact" as const, head: true };
  const [att, jud, alloc, claims, subs] = await Promise.all([
    supabase
      .from("hackathon_attendees")
      .select("hackathon_id", head)
      .eq("hackathon_id", hackathonId),
    supabase
      .from("hackathon_judges")
      .select("hackathon_id", head)
      .eq("hackathon_id", hackathonId),
    supabase
      .from("credit_allocations")
      .select("hackathon_id", head)
      .eq("hackathon_id", hackathonId),
    supabase
      .from("credit_claims")
      .select("hackathon_id", head)
      .eq("hackathon_id", hackathonId),
    supabase
      .from("submissions")
      .select("id", head)
      .eq("hackathon_id", hackathonId),
  ]);

  // judge_scores has no hackathon_id; join via submissions.
  let scores = 0;
  if (supabase) {
    const { count } = await supabase
      .from("judge_scores")
      .select("submission_id, submissions!inner(hackathon_id)", head)
      .eq("submissions.hackathon_id", hackathonId);
    scores = count ?? 0;
  }

  return {
    attendees: att.count ?? 0,
    judges: jud.count ?? 0,
    allocations: alloc.count ?? 0,
    claims: claims.count ?? 0,
    submissions: subs.count ?? 0,
    scores,
  };
}

/** One round-trip; counts attendees per hackathon id (for compact UI badges). */
export async function loadAttendeeCountsForHackathons(
  hackathonIds: string[],
): Promise<Map<string, number>> {
  const supabase = createServerSupabaseClient();
  const out = new Map<string, number>();
  const ids = [...new Set(hackathonIds.map((id) => id.trim()).filter(Boolean))];
  if (!supabase || ids.length === 0) return out;
  for (const id of ids) out.set(id, 0);
  const { data, error } = await supabase
    .from("hackathon_attendees")
    .select("hackathon_id")
    .in("hackathon_id", ids);
  if (error) return out;
  for (const row of (data ?? []) as Array<{ hackathon_id: string }>) {
    const hid = row.hackathon_id;
    out.set(hid, (out.get(hid) ?? 0) + 1);
  }
  return out;
}

export async function loadAllPortalConfigs(): Promise<
  Map<string, PortalConfigRow>
> {
  const supabase = createServerSupabaseClient();
  const out = new Map<string, PortalConfigRow>();
  if (!supabase) return out;
  const { data } = await supabase
    .from("hackathon_portal_config")
    .select(
      "hackathon_id,credits_enabled,submissions_enabled,submissions_open_at,submissions_close_at,judging_enabled,judges_can_see_other_scores",
    );
  for (const row of (data ?? []) as PortalConfigRow[]) {
    out.set(row.hackathon_id, row);
  }
  return out;
}
