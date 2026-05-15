"use server";

import { revalidatePath } from "next/cache";

import { loadJudge, requireHackathon } from "@/lib/portals/access";
import { gateJudge } from "@/lib/portals/portal-checks";
import { getAuthUser } from "@/lib/supabase/auth";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export type JudgeScoreState = {
  ok: boolean;
  message: string;
};

export async function submitJudgeScoreAction(
  hackathonId: string,
  formData: FormData,
): Promise<JudgeScoreState> {
  const trimmed = (hackathonId ?? "").trim();
  const { hackathon } = await requireHackathon(trimmed);
  if (!hackathon) {
    return { ok: false, message: "Unknown hackathon." };
  }

  const gate = await gateJudge(trimmed);
  if (!gate.ok) {
    return { ok: false, message: "Judging portal is closed." };
  }

  const { email, userId } = await getAuthUser();
  if (!email || !userId) {
    return { ok: false, message: "Sign in via the magic link first." };
  }

  const { judge } = await loadJudge(trimmed, email);
  if (!judge) {
    return {
      ok: false,
      message:
        "Your email is not on the judge list for this hackathon. Ask the organizers to add you.",
    };
  }

  const submissionId = (formData.get("submissionId") ?? "").toString().trim();
  const scoreRaw = (formData.get("score") ?? "").toString().trim();
  const notes = (formData.get("notes") ?? "").toString().trim() || null;
  const scoreNum = Number(scoreRaw);
  if (!submissionId || !Number.isFinite(scoreNum)) {
    return { ok: false, message: "Submission id and numeric score required." };
  }

  const supabase = createServerSupabaseClient();
  if (!supabase) {
    return { ok: false, message: "Supabase is not configured." };
  }

  const payload: Record<string, unknown> = {
    submission_id: submissionId,
    judge_email: email,
    judge_user_id: userId,
    score: scoreNum,
    notes,
  };
  if (judge?.judge_id) {
    payload.judge_id = judge.judge_id;
  }

  const { error } = await supabase.from("judge_scores").upsert(payload, {
    onConflict: "submission_id,judge_user_id",
  });

  if (error) {
    return { ok: false, message: `Could not save score: ${error.message}` };
  }
  revalidatePath(`/app/${trimmed}/judge`);
  return { ok: true, message: "Score saved." };
}
