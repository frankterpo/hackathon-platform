import "server-only";

import { BrowserUse } from "browser-use-sdk/v3";
import { z } from "zod";

/**
 * Luma guest sync uses Browser Use cloud: profile "luma" (or BROWSER_USE_LUMA_PROFILE_ID)
 * must stay logged into https://lu.ma in that profile. Task opens /manage/event/{id}/guests.
 * Troubleshooting: wrong evt id (use slug from manage URL, not public page only), host account,
 * Checked-in filter, pagination — see formatLumaEmptyGuestsHelp.
 */

/** LLMs sometimes emit email_address or omit email; normalize before DB upsert. */
const GuestSchema = z
  .object({
    email: z.string().optional(),
    email_address: z.string().optional(),
    first_name: z.string().nullable().optional(),
    last_name: z.string().nullable().optional(),
    full_name: z.string().nullable().optional(),
    rsvp_at: z.string().nullable().optional(),
    checked_in_at: z.string().nullable().optional(),
  })
  .transform((row) => {
    const emailRaw = (row.email ?? row.email_address ?? "").trim();
    return {
      email: emailRaw.toLowerCase(),
      first_name: row.first_name ?? null,
      last_name: row.last_name ?? null,
      full_name: row.full_name ?? null,
      rsvp_at: row.rsvp_at ?? null,
      checked_in_at: row.checked_in_at ?? null,
    };
  });

const GuestsResultSchema = z.object({
  guests: z.array(GuestSchema),
});

export type LumaGuest = z.infer<typeof GuestSchema>;

const PROFILE_NAME = "luma";

/** RFC 4122 UUID v1–v5 (dash-separated). */
function isUuidString(value: string): boolean {
  return /^[\da-f]{8}-[\da-f]{4}-[1-5][\da-f]{3}-[89ab][\da-f]{3}-[\da-f]{12}$/i.test(
    value.trim(),
  );
}

function getClient(): BrowserUse | null {
  const key = process.env.BROWSER_USE_API_KEY?.trim();
  if (!key) return null;
  return new BrowserUse({ apiKey: key });
}

async function getOrCreateLumaProfileId(client: BrowserUse): Promise<string> {
  const list = await client.profiles.list({ query: PROFILE_NAME });
  const existing = list.items.find((p) => p.name === PROFILE_NAME);
  if (existing) return existing.id;
  const created = await client.profiles.create({ name: PROFILE_NAME });
  return created.id;
}

/**
 * Prefer `BROWSER_USE_LUMA_PROFILE_ID` (trimmed UUID) when set; otherwise list/create profile named "luma".
 */
async function resolveLumaProfileId(client: BrowserUse): Promise<string> {
  const override = process.env.BROWSER_USE_LUMA_PROFILE_ID?.trim();
  if (override) {
    if (isUuidString(override)) return override.toLowerCase();
    console.warn(
      "[luma/browser-use] BROWSER_USE_LUMA_PROFILE_ID is set but not a valid UUID; falling back to profile name lookup.",
    );
  }
  return getOrCreateLumaProfileId(client);
}

/** Segment used in https://lu.ma/manage/event/{id}/guests (often evt-…). */
export function normalizeLumaEventIdForManageUrl(raw: string): string {
  const t = raw.trim();
  if (!t) return t;
  try {
    const href = t.includes("://") ? t : `https://${t}`;
    if (href.includes("lu.ma") || href.includes("luma.co")) {
      const u = new URL(href);
      const fromManage = u.pathname.match(/\/manage\/event\/([^/]+)/i);
      if (fromManage?.[1]) return decodeURIComponent(fromManage[1]);
    }
  } catch {
    /* use raw */
  }
  return t;
}

export function lumaManageGuestsUrl(lumaEventId: string): string {
  const id = normalizeLumaEventIdForManageUrl(lumaEventId);
  return `https://lu.ma/manage/event/${encodeURIComponent(id)}/guests`;
}

/** User-facing checklist when scrape returns []. */
export function formatLumaEmptyGuestsHelp(args: {
  lumaEventId: string;
  includeRsvp: boolean;
}): string {
  const id = normalizeLumaEventIdForManageUrl(args.lumaEventId);
  const url = lumaManageGuestsUrl(args.lumaEventId);
  return [
    "No guests were extracted (0 rows). Checklist:",
    `• Browser Use profile: In the Browser Use cloud app, open the persistent profile (name "${PROFILE_NAME}" or id from BROWSER_USE_LUMA_PROFILE_ID) and log in at https://lu.ma as the event host. Re-run sync after the profile shows a logged-in Luma session.`,
    `• Event id: hackathons.luma_event_id must match the manage URL segment (often evt-…). Verify while logged in: ${url}`,
    id.startsWith("evt-")
      ? null
      : `• Your id "${id}" does not start with evt-; if the manage URL uses evt-…, update luma_event_id to that value.`,
    '• Luma UI: On the guests page, select tabs/filters that show Checked-in (or all) guests; scroll to the end / load any "Show more" so every row is on-screen before extraction.',
    args.includeRsvp
      ? "• If the list is truly empty in Luma, no one has RSVP'd or checked in yet."
      : "• If guests only RSVP'd and are not checked in yet, enable \"Also include RSVP'd\" in the UI or pass include_rsvp=1 on the API.",
    "• Server: BROWSER_USE_API_KEY (bu_…) must be set on this deployment.",
  ]
    .filter((line): line is string => Boolean(line))
    .join("\n");
}

function buildGuestListTask(lumaEventId: string, includeRsvp: boolean): string {
  const id = normalizeLumaEventIdForManageUrl(lumaEventId);
  const includeWord = includeRsvp ? "checked-in OR RSVP'd" : "checked-in";
  return [
    `Open ${lumaManageGuestsUrl(lumaEventId)} in the already-logged-in Luma session (event id ${id}).`,
    `Wait for the guest list to fully load. If asked to log in, stop and return an empty guests array.`,
    `Extract every guest that is ${includeWord} for this event.`,
    `For each guest, extract:`,
    `- email (required, lowercased). Use key "email" in JSON.`,
    `- first_name (string or null)`,
    `- last_name (string or null)`,
    `- full_name (string or null)`,
    `- rsvp_at (ISO 8601 string if visible, else null)`,
    `- checked_in_at (ISO 8601 string if visible, else null)`,
    `Return ALL guests; do not truncate. If the list is paginated, scroll or click "Show more" until everyone is loaded.`,
  ].join("\n");
}

function buildGuestListRetryTask(lumaEventId: string, includeRsvp: boolean): string {
  const includeWord = includeRsvp ? "checked-in OR RSVP'd" : "checked-in";
  return [
    buildGuestListTask(lumaEventId, includeRsvp),
    `RETRY PASS: The previous extraction returned zero guests.`,
    `If you see a login or onboarding screen instead of a table of guests, return an empty guests array.`,
    `Otherwise: click any tab or filter needed to reveal ${includeWord} guests, scroll to the absolute bottom of the list, wait for lazy-loaded rows, then extract again with the same schema.`,
  ].join("\n");
}

/**
 * Pull *checked-in* guests for a Luma event id using a browser-use cloud session
 * that's already logged into Luma (manually, in the dashboard preview, against
 * the profile named "luma").
 *
 * Returns guests with at least { email }. Names and timestamps are best-effort
 * from Luma's UI and may be null.
 */
export async function fetchLumaCheckedInGuests(args: {
  lumaEventId: string;
  /** When true, also include RSVP'd-but-not-checked-in. Default false. */
  includeRsvp?: boolean;
}): Promise<{ guests: LumaGuest[]; error: string | null }> {
  const client = getClient();
  if (!client) {
    return { guests: [], error: "BROWSER_USE_API_KEY not set." };
  }

  let sessionId: string | null = null;
  try {
    const profileId = await resolveLumaProfileId(client);
    const session = await client.sessions.create({ profileId });
    sessionId = session.id;

    const task = buildGuestListTask(args.lumaEventId, args.includeRsvp ?? false);
    const result = await client.run(task, {
      sessionId,
      schema: GuestsResultSchema,
    });

    let guests = result.output?.guests ?? [];
    if (guests.length === 0) {
      console.warn(
        "[luma/browser-use] first guest extraction returned 0 rows; retrying in same session",
      );
      const retry = await client.run(
        buildGuestListRetryTask(args.lumaEventId, args.includeRsvp ?? false),
        { sessionId, schema: GuestsResultSchema },
      );
      guests = retry.output?.guests ?? [];
    }
    return { guests, error: null };
  } catch (error) {
    return { guests: [], error: (error as Error).message };
  } finally {
    if (sessionId) {
      try {
        await client.sessions.stop(sessionId);
      } catch (error) {
        console.error("[luma/browser-use] sessions.stop failed", error);
      }
    }
  }
}

/**
 * One-shot: discover the events the logged-in user hosts. Useful for confirming
 * the profile login is healthy before running the full sync.
 */
const EventSchema = z.object({
  id: z.string().nullable().optional(),
  url: z.string().nullable().optional(),
  name: z.string().nullable().optional(),
  start_at: z.string().nullable().optional(),
});
const EventsResultSchema = z.object({ events: z.array(EventSchema) });

export async function listLumaHostedEvents(): Promise<{
  events: z.infer<typeof EventSchema>[];
  error: string | null;
}> {
  const client = getClient();
  if (!client) return { events: [], error: "BROWSER_USE_API_KEY not set." };

  let sessionId: string | null = null;
  try {
    const profileId = await resolveLumaProfileId(client);
    const session = await client.sessions.create({ profileId });
    sessionId = session.id;

    const result = await client.run(
      [
        "Open https://lu.ma/manage/calendars in the already-logged-in Luma session.",
        "If asked to log in, stop and return an empty events array.",
        "List every event the user hosts. For each: id (the Luma evt-... id if visible),",
        "url (the public lu.ma/<slug> page), name, start_at (ISO 8601 if visible, else null).",
        "Return all events; do not truncate.",
      ].join("\n"),
      { sessionId, schema: EventsResultSchema },
    );

    return { events: result.output?.events ?? [], error: null };
  } catch (error) {
    return { events: [], error: (error as Error).message };
  } finally {
    if (sessionId) {
      try {
        await client.sessions.stop(sessionId);
      } catch (error) {
        console.error("[luma/browser-use] sessions.stop failed", error);
      }
    }
  }
}
