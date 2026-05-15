import { NextResponse } from "next/server";

import { isAdmin } from "@/lib/admin/session";
import {
  fetchLumaCheckedInGuests,
  formatLumaEmptyGuestsHelp,
} from "@/lib/luma/browser-use";
import {
  createServerSupabaseClient,
  isMissingIntegrationUuidColumnsError,
  isPostgrestEmbedRelationshipError,
} from "@/lib/supabase/server";

/**
 * Pull Luma event guests via browser-use cloud and upsert them into
 * `public.hackathon_attendees`. Designed for both Vercel Cron and on-demand
 * admin triggers from the master dashboard.
 *
 * Auth (any of):
 *   - signed in as admin (cookie set by /app/master/login)
 *   - ?secret=$CRON_SECRET
 *   - Authorization: Bearer $CRON_SECRET
 *
 * Envs:
 *   BROWSER_USE_API_KEY  - browser-use cloud API key (bu_...)
 *                          The "luma" profile in your dashboard must be
 *                          logged into Luma manually before first run.
 *   LUMA_HACK_MAP        - JSON: { "<luma_event_id>": "<hackathon_id>" }
 *                          OR omitted to derive from `hackathons.luma_event_id`
 *                          (or FK join to public.luma_events when text is null).
 *   CRON_SECRET          - shared secret for cron / curl access
 *
 * Behaviour:
 *   - never disturbs an attendee row that already has `credit_claimed_at`
 *   - upserts on (hackathon_id, email) so late check-ins are additive
 *   - per-event errors don't fail the whole run
 */

type GuestRow = {
  hackathon_id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  source: "luma_checkin" | "luma_rsvp";
  rsvp_at: string | null;
  checked_in_at: string | null;
};

async function authorized(req: Request): Promise<boolean> {
  if (await isAdmin()) return true;
  const expected = process.env.CRON_SECRET?.trim();
  if (!expected) return false;
  const url = new URL(req.url);
  if (url.searchParams.get("secret") === expected) return true;
  const auth = req.headers.get("authorization") ?? "";
  return auth === `Bearer ${expected}`;
}

async function resolveHackMap(
  filterHackathonId: string | null,
): Promise<{ map: Record<string, string>; error: string | null }> {
  const raw = process.env.LUMA_HACK_MAP?.trim();
  if (raw) {
    try {
      const parsed = JSON.parse(raw) as Record<string, string>;
      if (filterHackathonId) {
        const filtered = Object.fromEntries(
          Object.entries(parsed).filter(([, hid]) => hid === filterHackathonId),
        );
        return { map: filtered, error: null };
      }
      return { map: parsed, error: null };
    } catch {
      return { map: {}, error: "LUMA_HACK_MAP is not valid JSON." };
    }
  }
  // Fall back to rows with a Luma id on the hackathon or via luma_event_uuid → luma_events.
  const supabase = createServerSupabaseClient();
  if (!supabase) {
    return { map: {}, error: "Supabase not configured." };
  }
  const embedSelect =
    "id,luma_event_id,luma_event_lookup:luma_events!hackathons_luma_event_uuid_fkey(luma_event_id)";
  let query = supabase
    .from("hackathons")
    .select(embedSelect)
    .or("luma_event_id.not.is.null,luma_event_uuid.not.is.null");
  if (filterHackathonId) query = query.eq("id", filterHackathonId);
  let data: Record<string, unknown>[] | null = null;
  let error = null as { message: string } | null;

  const r1 = await query;
  data = (r1.data as Record<string, unknown>[] | undefined) ?? null;
  error = r1.error;

  if (error?.message && isMissingIntegrationUuidColumnsError(error.message)) {
    let q0 = supabase
      .from("hackathons")
      .select("id,luma_event_id")
      .not("luma_event_id", "is", null);
    if (filterHackathonId) q0 = q0.eq("id", filterHackathonId);
    const z = await q0;
    data = (z.data as Record<string, unknown>[] | undefined) ?? null;
    error = z.error;
  } else if (error?.message && isPostgrestEmbedRelationshipError(error.message)) {
    let q2 = supabase
      .from("hackathons")
      .select("id,luma_event_id,luma_event_uuid")
      .or("luma_event_id.not.is.null,luma_event_uuid.not.is.null");
    if (filterHackathonId) q2 = q2.eq("id", filterHackathonId);
    const second = await q2;
    data = (second.data as Record<string, unknown>[] | undefined) ?? null;
    error = second.error;
    if (error?.message && isMissingIntegrationUuidColumnsError(error.message)) {
      let q3 = supabase
        .from("hackathons")
        .select("id,luma_event_id")
        .not("luma_event_id", "is", null);
      if (filterHackathonId) q3 = q3.eq("id", filterHackathonId);
      const third = await q3;
      data = (third.data as Record<string, unknown>[] | undefined) ?? null;
      error = third.error;
    }
  }

  if (error) return { map: {}, error: error.message };
  const map: Record<string, string> = {};
  for (const row of data ?? []) {
    const r = row as Record<string, unknown>;
    const rid = typeof r.id === "string" ? r.id : "";
    let lid = typeof r.luma_event_id === "string" ? r.luma_event_id.trim() : "";
    if (!lid) {
      const lk = r.luma_event_lookup;
      if (Array.isArray(lk) && lk[0] && typeof lk[0] === "object") {
        const o = lk[0] as { luma_event_id?: unknown };
        lid = typeof o.luma_event_id === "string" ? o.luma_event_id.trim() : "";
      } else if (lk && typeof lk === "object" && !Array.isArray(lk)) {
        const o = lk as { luma_event_id?: unknown };
        lid = typeof o.luma_event_id === "string" ? o.luma_event_id.trim() : "";
      }
    }
    if (lid && rid) map[lid] = rid;
  }
  return { map, error: null };
}

async function syncOne(args: {
  lumaEventId: string;
  hackathonId: string;
  includeRsvp: boolean;
}): Promise<{
  upserted: number;
  total: number;
  error: string | null;
  empty_hint?: string | null;
}> {
  const supabase = createServerSupabaseClient();
  if (!supabase) {
    return { upserted: 0, total: 0, error: "Supabase not configured." };
  }
  const { guests, error: scrapeError } = await fetchLumaCheckedInGuests({
    lumaEventId: args.lumaEventId,
    includeRsvp: args.includeRsvp,
  });
  if (scrapeError) return { upserted: 0, total: 0, error: scrapeError };
  if (guests.length === 0) {
    return {
      upserted: 0,
      total: 0,
      error: null,
      empty_hint: formatLumaEmptyGuestsHelp({
        lumaEventId: args.lumaEventId,
        includeRsvp: args.includeRsvp,
      }),
    };
  }

  const rows: GuestRow[] = [];
  for (const g of guests) {
    const email = (g.email ?? "").trim().toLowerCase();
    if (!email.includes("@")) continue;
    rows.push({
      hackathon_id: args.hackathonId,
      email,
      first_name: g.first_name ?? null,
      last_name: g.last_name ?? null,
      source: g.checked_in_at ? "luma_checkin" : "luma_rsvp",
      rsvp_at: g.rsvp_at ?? null,
      checked_in_at: g.checked_in_at ?? null,
    });
  }
  if (rows.length === 0) return { upserted: 0, total: guests.length, error: null };

  // Upsert is additive: rows that already exist will be updated only on the
  // returned columns; credit-claim state lives on a separate table so this
  // never disturbs anyone who already redeemed.
  const { error } = await supabase
    .from("hackathon_attendees")
    .upsert(rows, { onConflict: "hackathon_id,email" });
  if (error) return { upserted: 0, total: rows.length, error: error.message };
  return { upserted: rows.length, total: guests.length, error: null };
}

async function handle(req: Request): Promise<Response> {
  if (!(await authorized(req))) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const url = new URL(req.url);
  const filterHackathonId = url.searchParams.get("hackathon_id");
  const includeRsvp = url.searchParams.get("include_rsvp") === "1";

  if (!process.env.BROWSER_USE_API_KEY?.trim()) {
    return NextResponse.json(
      { error: "BROWSER_USE_API_KEY not set" },
      { status: 500 },
    );
  }
  const { map, error } = await resolveHackMap(filterHackathonId);
  if (error) return NextResponse.json({ error }, { status: 500 });
  if (Object.keys(map).length === 0) {
    return NextResponse.json(
      {
        ok: true,
        summary: {},
        note:
          "No Luma events to sync. Set LUMA_HACK_MAP env or hackathons.luma_event_id.",
      },
      { status: 200 },
    );
  }

  const summary: Record<
    string,
    {
      hackathon_id: string;
      upserted: number;
      total: number;
      error: string | null;
      empty_hint?: string | null;
    }
  > = {};
  for (const [lumaEventId, hackathonId] of Object.entries(map)) {
    try {
      const r = await syncOne({ lumaEventId, hackathonId, includeRsvp });
      summary[lumaEventId] = { hackathon_id: hackathonId, ...r };
    } catch (e) {
      summary[lumaEventId] = {
        hackathon_id: hackathonId,
        upserted: 0,
        total: 0,
        error: (e as Error).message,
      };
    }
  }
  return NextResponse.json({ ok: true, summary });
}

export async function GET(request: Request) {
  return handle(request);
}

export async function POST(request: Request) {
  return handle(request);
}

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 300;
