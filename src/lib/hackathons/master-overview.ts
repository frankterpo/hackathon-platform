import {
  type HackathonRow,
  type HackathonStatus,
  hackathonFirebaseProjectId,
  hackathonLumaEventId,
} from "@/types/database";

/** Values sometimes stored instead of a real Luma API id (`evt-…`). */
const LUMA_EVENT_ID_PLACEHOLDERS = new Set([
  "-",
  "–",
  "—",
  "n/a",
  "na",
  "none",
  "null",
  "pending",
  "tbd",
  "unknown",
  "unset",
]);

/** Same class of placeholders for `firebase_config_ref` (Firebase project id). */
const FIREBASE_CONFIG_PLACEHOLDERS = LUMA_EVENT_ID_PLACEHOLDERS;

/**
 * True when `luma_event_id` looks like a real Luma event identifier, not null /
 * whitespace / dash placeholders. Aligns with SQL cleanup in
 * `supabase/migrations/*_delete_legacy_hack_shells_without_luma.sql`.
 */
export function isUsableLumaEventId(raw: string | null | undefined): boolean {
  const t = (raw ?? "").trim();
  if (!t) return false;
  if (LUMA_EVENT_ID_PLACEHOLDERS.has(t)) return false;
  if (LUMA_EVENT_ID_PLACEHOLDERS.has(t.toLowerCase())) return false;
  return true;
}

function isUsableFirebaseConfigRef(
  raw: string | null | undefined,
): boolean {
  const t = (raw ?? "").trim();
  if (!t) return false;
  if (FIREBASE_CONFIG_PLACEHOLDERS.has(t)) return false;
  if (FIREBASE_CONFIG_PLACEHOLDERS.has(t.toLowerCase())) return false;
  return true;
}

export type MasterOverviewHideOptions = {
  /**
   * When true, rows without a real Firebase project id are hidden too.
   * Enable with env `MASTER_OVERVIEW_REQUIRE_FIREBASE=1` on the master overview page.
   */
  requireFirebase?: boolean;
};

/**
 * Lane for overview boards: past events sort as completed even if `status` was
 * never updated after the hack ended.
 */
export function hackathonLaneStatus(row: HackathonRow): HackathonStatus {
  if (row.status === "live") return "live";
  const endIso = row.end_date ?? row.ends_at ?? null;
  if (endIso) {
    const ms = Date.parse(endIso);
    if (!Number.isNaN(ms) && ms < Date.now()) return "completed";
  }
  return row.status;
}

/**
 * Rows excluded from the /app/master overview card grid: noise seed hacks and
 * hackathons with no usable Luma event id (null, empty, whitespace, or common
 * placeholder strings such as "-").
 */
export function hideHackathonFromMasterOverview(
  row: HackathonRow,
  opts?: MasterOverviewHideOptions,
): boolean {
  if (row.theme_slug === "legacy-default") return true;
  if (!isUsableLumaEventId(hackathonLumaEventId(row))) return true;
  if (
    opts?.requireFirebase &&
    !isUsableFirebaseConfigRef(hackathonFirebaseProjectId(row))
  ) {
    return true;
  }
  return false;
}
