"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";

import {
  getFirebaseDbForProject,
  resolveCreditLink,
} from "@/lib/firebase/admin";
import { gateCredits } from "@/lib/portals/portal-checks";
import { requireHackathon } from "@/lib/portals/access";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { hackathonFirebaseProjectId } from "@/types/database";

const SEARCH_LIMIT = 8;
const ATTEMPT_WINDOW_MS = 10 * 60 * 1000;
const ATTEMPT_MAX_PER_IP = 30;

type AttemptOutcome =
  | "name_search"
  | "email_match"
  | "claimed"
  | "rejected_unknown"
  | "rejected_already_claimed"
  | "rejected_disabled"
  | "rejected_rate_limit";

async function getRequestMeta(): Promise<{ ip: string | null; ua: string | null }> {
  const h = await headers();
  const fwd = h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
  return { ip: fwd, ua: h.get("user-agent") };
}

async function logAttempt(args: {
  hackathonId: string;
  email: string | null;
  outcome: AttemptOutcome;
  ip: string | null;
  ua: string | null;
}): Promise<void> {
  const supabase = createServerSupabaseClient();
  if (!supabase) return;
  await supabase.from("credit_claim_attempts").insert({
    hackathon_id: args.hackathonId,
    email: args.email,
    ip: args.ip,
    user_agent: args.ua,
    outcome: args.outcome,
  });
}

async function rateLimited(ip: string | null): Promise<boolean> {
  if (!ip) return false;
  const supabase = createServerSupabaseClient();
  if (!supabase) return false;
  const since = new Date(Date.now() - ATTEMPT_WINDOW_MS).toISOString();
  const { count } = await supabase
    .from("credit_claim_attempts")
    .select("id", { head: true, count: "exact" })
    .eq("ip", ip)
    .gte("created_at", since);
  return (count ?? 0) > ATTEMPT_MAX_PER_IP;
}

export type AttendeeMatch = {
  display_name: string;
  email_hint: string;
};

function maskEmail(email: string): string {
  const [local, domain] = email.split("@");
  if (!domain) return "***";
  const head = local.slice(0, 1);
  return `${head}${"*".repeat(Math.max(2, local.length - 1))}@${domain}`;
}

export type SearchAttendeesState = {
  ok: boolean;
  message: string;
  matches: AttendeeMatch[];
};

export async function searchAttendeesByNameAction(
  hackathonId: string,
  formData: FormData,
): Promise<SearchAttendeesState> {
  const trimmed = (hackathonId ?? "").trim();
  const { ip, ua } = await getRequestMeta();
  if (await rateLimited(ip)) {
    await logAttempt({ hackathonId: trimmed, email: null, outcome: "rejected_rate_limit", ip, ua });
    return { ok: false, message: "Too many attempts — try again in a few minutes.", matches: [] };
  }
  const gate = await gateCredits(trimmed);
  if (!gate.ok) {
    await logAttempt({ hackathonId: trimmed, email: null, outcome: "rejected_disabled", ip, ua });
    return { ok: false, message: "Credits portal is closed.", matches: [] };
  }
  const query = (formData.get("query") ?? "").toString().trim();
  if (query.length < 2) {
    return { ok: false, message: "Type at least 2 letters of your first name.", matches: [] };
  }

  const supabase = createServerSupabaseClient();
  if (!supabase) {
    return { ok: false, message: "Supabase not configured.", matches: [] };
  }

  const { data, error } = await supabase
    .from("credit_allocations")
    .select("first_name,last_name,email")
    .eq("hackathon_id", trimmed)
    .ilike("first_name", `${query}%`)
    .order("first_name", { ascending: true })
    .limit(SEARCH_LIMIT);

  if (error) {
    return { ok: false, message: error.message, matches: [] };
  }

  const matches: AttendeeMatch[] = ((data ?? []) as Array<{
    first_name: string | null;
    last_name: string | null;
    email: string;
  }>).map((row) => {
    const first = row.first_name ?? "";
    const lastInitial = row.last_name ? `${row.last_name.slice(0, 1).toUpperCase()}.` : "";
    return {
      display_name: `${first} ${lastInitial}`.trim() || "(unnamed)",
      email_hint: maskEmail(row.email),
    };
  });

  await logAttempt({ hackathonId: trimmed, email: null, outcome: "name_search", ip, ua });
  return { ok: true, message: `${matches.length} match${matches.length === 1 ? "" : "es"}.`, matches };
}

export type ClaimByEmailState = {
  ok: boolean;
  message: string;
  link: string | null;
  code: string | null;
  alreadyClaimed: boolean;
};

export async function claimCreditByEmailAction(
  hackathonId: string,
  formData: FormData,
): Promise<ClaimByEmailState> {
  const trimmed = (hackathonId ?? "").trim();
  const { ip, ua } = await getRequestMeta();
  const baseFail = (
    message: string,
    outcome: AttemptOutcome,
    email: string | null,
  ): ClaimByEmailState => {
    void logAttempt({ hackathonId: trimmed, email, outcome, ip, ua });
    return { ok: false, message, link: null, code: null, alreadyClaimed: false };
  };

  if (await rateLimited(ip)) {
    return baseFail("Too many attempts — try again in a few minutes.", "rejected_rate_limit", null);
  }

  const gate = await gateCredits(trimmed);
  if (!gate.ok) {
    return baseFail("Credits portal is closed.", "rejected_disabled", null);
  }

  const { hackathon } = await requireHackathon(trimmed);
  if (!hackathon) {
    return baseFail("Unknown hackathon.", "rejected_unknown", null);
  }

  const emailRaw = (formData.get("email") ?? "").toString().trim().toLowerCase();
  if (!emailRaw.includes("@")) {
    return baseFail("Enter a valid email.", "rejected_unknown", null);
  }

  const supabase = createServerSupabaseClient();
  if (!supabase) {
    return baseFail("Supabase not configured.", "rejected_unknown", emailRaw);
  }

  const { data: alloc, error: allocErr } = await supabase
    .from("credit_allocations")
    .select("hackathon_id,email,first_name,last_name,external_ref,firebase_doc_path")
    .eq("hackathon_id", trimmed)
    .eq("email", emailRaw)
    .maybeSingle();

  if (allocErr) {
    return baseFail(`Lookup failed: ${allocErr.message}`, "rejected_unknown", emailRaw);
  }
  if (!alloc) {
    return baseFail(
      "That email isn't on the credit list for this hackathon. If you RSVP'd / checked in on Luma and this is wrong, contact the organizers.",
      "rejected_unknown",
      emailRaw,
    );
  }

  const { data: existing } = await supabase
    .from("credit_claims")
    .select("delivered_link,delivered_code")
    .eq("hackathon_id", trimmed)
    .eq("email", emailRaw)
    .maybeSingle();

  if (existing) {
    void logAttempt({ hackathonId: trimmed, email: emailRaw, outcome: "rejected_already_claimed", ip, ua });
    return {
      ok: true,
      message: "Already claimed earlier. Here is the link we delivered then.",
      link: (existing as { delivered_link: string | null }).delivered_link,
      code: (existing as { delivered_code: string | null }).delivered_code,
      alreadyClaimed: true,
    };
  }

  let deliveredLink: string | null = null;
  let deliveredCode: string | null = null;
  const fbProjectId = hackathonFirebaseProjectId(hackathon);
  if (fbProjectId && getFirebaseDbForProject(fbProjectId)) {
    const fb = await resolveCreditLink({
      firebaseProjectId: fbProjectId,
      hackathonId: trimmed,
      email: emailRaw,
      docPath: (alloc as { firebase_doc_path: string | null }).firebase_doc_path,
    });
    deliveredLink = fb.url;
    deliveredCode = fb.code;
    if (fb.error && !deliveredLink && !deliveredCode) {
      return baseFail(
        `Could not resolve your credit link from Firebase: ${fb.error}`,
        "rejected_unknown",
        emailRaw,
      );
    }
  } else {
    const ref = (alloc as { external_ref: string | null }).external_ref ?? null;
    if (ref && /^https?:\/\//i.test(ref)) {
      deliveredLink = ref;
    } else {
      deliveredCode = ref;
    }
  }

  const { error: insertErr } = await supabase.from("credit_claims").insert({
    hackathon_id: trimmed,
    email: emailRaw,
    delivered_link: deliveredLink,
    delivered_code: deliveredCode,
    ip,
    user_agent: ua,
  });

  if (insertErr) {
    if (insertErr.code === "23505") {
      const { data: again } = await supabase
        .from("credit_claims")
        .select("delivered_link,delivered_code")
        .eq("hackathon_id", trimmed)
        .eq("email", emailRaw)
        .maybeSingle();
      if (again) {
        void logAttempt({
          hackathonId: trimmed,
          email: emailRaw,
          outcome: "rejected_already_claimed",
          ip,
          ua,
        });
        return {
          ok: true,
          message: "Already claimed.",
          link: (again as { delivered_link: string | null }).delivered_link,
          code: (again as { delivered_code: string | null }).delivered_code,
          alreadyClaimed: true,
        };
      }
    }
    return baseFail(`Could not record claim: ${insertErr.message}`, "rejected_unknown", emailRaw);
  }

  void logAttempt({ hackathonId: trimmed, email: emailRaw, outcome: "claimed", ip, ua });
  revalidatePath(`/app/${trimmed}/credits`);
  return {
    ok: true,
    message: "Credit claimed. Open the link below.",
    link: deliveredLink,
    code: deliveredCode,
    alreadyClaimed: false,
  };
}
