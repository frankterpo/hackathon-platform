"use server";

import { revalidatePath } from "next/cache";

import { isAdmin } from "@/lib/admin/session";
import {
  fetchLumaCheckedInGuests,
  formatLumaEmptyGuestsHelp,
} from "@/lib/luma/browser-use";
import { createServerSupabaseClient, loadHackathonById } from "@/lib/supabase/server";
import { hackathonLumaEventId } from "@/types/database";

export type SaveConfigState = {
  ok: boolean;
  message: string;
};

function parseBool(input: FormDataEntryValue | null): boolean {
  if (typeof input !== "string") return false;
  return input === "on" || input === "true" || input === "1";
}

function parseTimestamp(input: FormDataEntryValue | null): string | null {
  if (typeof input !== "string") return null;
  const t = input.trim();
  if (!t) return null;
  // datetime-local returns "YYYY-MM-DDTHH:MM"; treat as local and convert to ISO.
  const d = new Date(t);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

export async function savePortalConfigAction(
  hackathonId: string,
  formData: FormData,
): Promise<SaveConfigState> {
  if (!(await isAdmin())) {
    return { ok: false, message: "Not authorized." };
  }
  const trimmed = (hackathonId ?? "").trim();
  if (!trimmed) return { ok: false, message: "Missing hackathon id." };

  const supabase = createServerSupabaseClient();
  if (!supabase) {
    return { ok: false, message: "Supabase not configured." };
  }

  const payload = {
    hackathon_id: trimmed,
    credits_enabled: parseBool(formData.get("credits_enabled")),
    submissions_enabled: parseBool(formData.get("submissions_enabled")),
    submissions_open_at: parseTimestamp(formData.get("submissions_open_at")),
    submissions_close_at: parseTimestamp(formData.get("submissions_close_at")),
    judging_enabled: parseBool(formData.get("judging_enabled")),
    judges_can_see_other_scores: parseBool(
      formData.get("judges_can_see_other_scores"),
    ),
  };

  const { error } = await supabase
    .from("hackathon_portal_config")
    .upsert(payload, { onConflict: "hackathon_id" });
  if (error) {
    return { ok: false, message: error.message };
  }
  revalidatePath(`/app/master/${trimmed}`);
  revalidatePath("/app/master");
  return { ok: true, message: "Saved." };
}

export type LumaSyncState = {
  ok: boolean;
  message: string;
  upserted?: number;
  total?: number;
};

/**
 * Trigger a Luma checked-in sync for one hackathon, on demand from the admin
 * dashboard. Reads `hackathons.luma_event_id`, drives the browser-use cloud
 * profile named "luma" (must already be logged in), and upserts attendees.
 *
 * Idempotent + additive: never disturbs rows that already claimed credits.
 */
export async function syncLumaForHackathonAction(
  hackathonId: string,
  options: { includeRsvp?: boolean } = {},
): Promise<LumaSyncState> {
  if (!(await isAdmin())) {
    return { ok: false, message: "Not authorized." };
  }
  const trimmed = (hackathonId ?? "").trim();
  if (!trimmed) return { ok: false, message: "Missing hackathon id." };

  if (!process.env.BROWSER_USE_API_KEY?.trim()) {
    return {
      ok: false,
      message: "BROWSER_USE_API_KEY is not configured on this deployment.",
    };
  }

  const { hackathon, error: loadErr } = await loadHackathonById(trimmed);
  if (loadErr) return { ok: false, message: loadErr };
  if (!hackathon) return { ok: false, message: "Hackathon not found." };
  const lumaEventId = hackathonLumaEventId(hackathon);
  if (!lumaEventId) {
    return {
      ok: false,
      message:
        "This hackathon has no luma_event_id set. Add it in the database first.",
    };
  }

  const supabase = createServerSupabaseClient();
  if (!supabase) {
    return { ok: false, message: "Supabase not configured." };
  }

  const { guests, error: scrapeErr } = await fetchLumaCheckedInGuests({
    lumaEventId,
    includeRsvp: options.includeRsvp ?? false,
  });
  if (scrapeErr) {
    return {
      ok: false,
      message: `browser-use: ${scrapeErr}`,
    };
  }
  if (guests.length === 0) {
    const hint = formatLumaEmptyGuestsHelp({
      lumaEventId,
      includeRsvp: options.includeRsvp ?? false,
    });
    return {
      ok: true,
      message: `${hint}\n\nSummary: upserted 0 (browser-use returned no guest rows).`,
      upserted: 0,
      total: 0,
    };
  }

  const rows = guests
    .map((g) => {
      const email = (g.email ?? "").trim().toLowerCase();
      if (!email.includes("@")) return null;
      return {
        hackathon_id: trimmed,
        email,
        first_name: g.first_name ?? null,
        last_name: g.last_name ?? null,
        source: g.checked_in_at ? "luma_checkin" : "luma_rsvp",
        rsvp_at: g.rsvp_at ?? null,
        checked_in_at: g.checked_in_at ?? null,
      };
    })
    .filter((r): r is NonNullable<typeof r> => r !== null);

  if (rows.length === 0) {
    return {
      ok: true,
      message: `No usable rows out of ${guests.length} guests.`,
      upserted: 0,
      total: guests.length,
    };
  }

  const { error: upsertErr } = await supabase
    .from("hackathon_attendees")
    .upsert(rows, { onConflict: "hackathon_id,email" });
  if (upsertErr) {
    return { ok: false, message: upsertErr.message };
  }

  revalidatePath(`/app/master/${trimmed}`);
  revalidatePath("/app/master");
  return {
    ok: true,
    message: `Synced ${rows.length} guests from Luma.`,
    upserted: rows.length,
    total: guests.length,
  };
}
