import "server-only";

import {
  createServerSupabaseClient,
  loadHackathonById,
} from "@/lib/supabase/server";
import type { HackathonRow } from "@/types/database";

/**
 * Verify that `hackathonId` actually exists. The URL-supplied id is a routing hint;
 * write paths should always re-derive it from the URL and run this check.
 */
export async function requireHackathon(
  hackathonId: string,
): Promise<{ hackathon: HackathonRow | null; error: string | null }> {
  const trimmed = (hackathonId ?? "").trim();
  if (!trimmed) {
    return { hackathon: null, error: "Missing hackathon id." };
  }
  return loadHackathonById(trimmed);
}

export type AttendeeRow = {
  hackathon_id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  source: string;
  rsvp_at: string | null;
  checked_in_at: string | null;
};

export async function loadAttendee(
  hackathonId: string,
  email: string,
): Promise<{ attendee: AttendeeRow | null; error: string | null }> {
  const supabase = createServerSupabaseClient();
  if (!supabase) {
    return { attendee: null, error: "Supabase client unavailable." };
  }
  const normalizedEmail = email.trim().toLowerCase();
  const { data, error } = await supabase
    .from("hackathon_attendees")
    .select(
      "hackathon_id,email,first_name,last_name,source,rsvp_at,checked_in_at",
    )
    .eq("hackathon_id", hackathonId.trim())
    .eq("email", normalizedEmail)
    .maybeSingle();
  if (error) {
    return { attendee: null, error: error.message };
  }
  return { attendee: (data as AttendeeRow) ?? null, error: null };
}

export type CreditAllocationRow = {
  hackathon_id: string;
  email: string;
  amount_usd: number | null;
  external_ref: string | null;
  firebase_doc_path: string | null;
};

export async function loadCreditAllocation(
  hackathonId: string,
  email: string,
): Promise<{ allocation: CreditAllocationRow | null; error: string | null }> {
  const supabase = createServerSupabaseClient();
  if (!supabase) {
    return { allocation: null, error: "Supabase client unavailable." };
  }
  const normalizedEmail = email.trim().toLowerCase();
  const { data, error } = await supabase
    .from("credit_allocations")
    .select("hackathon_id,email,amount_usd,external_ref,firebase_doc_path")
    .eq("hackathon_id", hackathonId.trim())
    .eq("email", normalizedEmail)
    .maybeSingle();
  if (error) {
    return { allocation: null, error: error.message };
  }
  return { allocation: (data as CreditAllocationRow) ?? null, error: null };
}

export type CreditClaimRow = {
  id: string;
  hackathon_id: string;
  email: string;
  delivered_link: string | null;
  delivered_code: string | null;
  claimed_at: string;
};

export async function loadCreditClaim(
  hackathonId: string,
  email: string,
): Promise<{ claim: CreditClaimRow | null; error: string | null }> {
  const supabase = createServerSupabaseClient();
  if (!supabase) {
    return { claim: null, error: "Supabase client unavailable." };
  }
  const normalizedEmail = email.trim().toLowerCase();
  const { data, error } = await supabase
    .from("credit_claims")
    .select(
      "id,hackathon_id,email,delivered_link,delivered_code,claimed_at",
    )
    .eq("hackathon_id", hackathonId.trim())
    .eq("email", normalizedEmail)
    .maybeSingle();
  if (error) {
    return { claim: null, error: error.message };
  }
  return { claim: (data as CreditClaimRow) ?? null, error: null };
}

export type JudgeRow = {
  hackathon_id: string;
  email: string;
  display_name: string | null;
  user_id: string | null;
  /** Canonical judge identity (`public.judges.id`), synced from email. */
  judge_id: string | null;
};

export async function loadJudge(
  hackathonId: string,
  email: string,
): Promise<{ judge: JudgeRow | null; error: string | null }> {
  const supabase = createServerSupabaseClient();
  if (!supabase) {
    return { judge: null, error: "Supabase client unavailable." };
  }
  const normalizedEmail = email.trim().toLowerCase();
  const { data, error } = await supabase
    .from("hackathon_judges")
    .select("hackathon_id,email,display_name,user_id,judge_id")
    .eq("hackathon_id", hackathonId.trim())
    .eq("email", normalizedEmail)
    .maybeSingle();
  if (error) {
    return { judge: null, error: error.message };
  }
  return { judge: (data as JudgeRow) ?? null, error: null };
}
