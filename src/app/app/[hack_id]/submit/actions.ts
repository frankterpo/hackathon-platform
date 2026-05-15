"use server";

import { revalidatePath } from "next/cache";

import { gateSubmit } from "@/lib/portals/portal-checks";
import { requireHackathon } from "@/lib/portals/access";
import { getAuthUser } from "@/lib/supabase/auth";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export type SubmitState = {
  ok: boolean;
  message: string;
  submissionId: string | null;
};

/**
 * Stable identifier derived from the repo/demo URL so the same project can be
 * de-duped across re-submissions. Falls back to a slug of the URL.
 */
function deriveRepoKey(url: string): string {
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.toLowerCase().replace(/^www\./, "");
    const path = parsed.pathname.replace(/\/+$/, "").replace(/^\/+/, "");
    if (host === "github.com" || host === "gitlab.com" || host === "bitbucket.org") {
      const [org, repo] = path.split("/", 2);
      if (org && repo) return `${host}/${org}/${repo}`.toLowerCase();
    }
    return `${host}/${path}`.toLowerCase().slice(0, 200);
  } catch {
    return url.toLowerCase().replace(/[^a-z0-9._\-/]+/g, "-").slice(0, 200);
  }
}

export async function submitProjectAction(
  hackathonId: string,
  formData: FormData,
): Promise<SubmitState> {
  const trimmed = (hackathonId ?? "").trim();
  const { hackathon } = await requireHackathon(trimmed);
  if (!hackathon) {
    return { ok: false, message: "Unknown hackathon.", submissionId: null };
  }

  const gate = await gateSubmit(trimmed);
  if (!gate.ok) {
    const reasonMsg =
      gate.reason === "disabled"
        ? "Submissions are closed."
        : gate.reason === "before_open"
          ? "Submissions haven't opened yet."
          : "Submissions are closed (deadline passed).";
    return { ok: false, message: reasonMsg, submissionId: null };
  }

  const { email, userId } = await getAuthUser();
  if (!email || !userId) {
    return {
      ok: false,
      message: "Sign in via the magic link first.",
      submissionId: null,
    };
  }

  const title = (formData.get("title") ?? "").toString().trim();
  const teamName = (formData.get("teamName") ?? "").toString().trim() || null;
  const repoUrl = (formData.get("repoUrl") ?? "").toString().trim();
  const body = (formData.get("body") ?? "").toString().trim() || null;

  if (!title) {
    return { ok: false, message: "Title is required.", submissionId: null };
  }
  if (!repoUrl) {
    return {
      ok: false,
      message: "Repo or demo URL is required.",
      submissionId: null,
    };
  }
  const repoKey = deriveRepoKey(repoUrl);

  const supabase = createServerSupabaseClient();
  if (!supabase) {
    return {
      ok: false,
      message: "Supabase is not configured.",
      submissionId: null,
    };
  }

  const { data, error } = await supabase
    .from("submissions")
    .insert({
      hackathon_id: trimmed,
      title,
      team_name: teamName,
      repo_url: repoUrl,
      repo_key: repoKey,
      body,
      submitter_email: email,
      submitter_user_id: userId,
    })
    .select("id")
    .single();

  if (error) {
    return {
      ok: false,
      message: `Could not save submission: ${error.message}`,
      submissionId: null,
    };
  }

  revalidatePath(`/app/${trimmed}/submit`);
  return {
    ok: true,
    message: "Submitted. Good luck!",
    submissionId: (data?.id as string) ?? null,
  };
}
