export type HackathonStatus = "live" | "scheduled" | "completed";

export type HackathonTaskType =
  | "venue"
  | "catering"
  | "luma_copy"
  | "code"
  | "judges"
  | "partners"
  | "social"
  | "other";

export type HackathonTaskStatus =
  | "todo"
  | "in_progress"
  | "done"
  | "blocked";

export type AgentRunState =
  | "draft"
  | "awaiting_approval"
  | "approved"
  | "rejected";

export type HackathonTaskRow = {
  id: string;
  hackathon_id: string;
  title: string;
  task_type: HackathonTaskType;
  status: HackathonTaskStatus;
  sort_order: number;
  notes: string | null;
  due_at: string | null;
  created_at: string;
  updated_at: string;
};

export type AgentRunRow = {
  id: string;
  hackathon_task_id: string | null;
  hackathon_id: string;
  intent: string;
  output_draft: string;
  state: AgentRunState;
  created_at: string;
};

export type LumaEventRow = {
  id: string;
  luma_event_id: string;
  display_name: string | null;
  created_at: string;
  updated_at: string;
};

export type FirebaseProjectRow = {
  id: string;
  firebase_project_id: string;
  display_name: string | null;
  created_at: string;
  updated_at: string;
};

export type HackathonRow = {
  id: string;
  name: string;
  status: HackathonStatus;
  start_date: string | null;
  end_date: string | null;
  starts_at: string;
  ends_at: string;
  theme_slug: string | null;
  slug: string;
  vercel_project_slug: string | null;
  luma_event_id: string | null;
  luma_url: string | null;
  luma_event_title: string | null;
  luma_timezone: string | null;
  luma_location: string | null;
  luma_description: string | null;
  luma_raw_payload: unknown | null;
  firebase_config_ref: string | null;
  luma_event_uuid: string | null;
  firebase_project_uuid: string | null;
  /** PostgREST embed via hackathons.luma_event_uuid (object; array if client quirk). */
  luma_event_lookup:
    | Pick<LumaEventRow, "luma_event_id" | "display_name">
    | Pick<LumaEventRow, "luma_event_id" | "display_name">[]
    | null;
  /** PostgREST embed via hackathons.firebase_project_uuid */
  firebase_project_lookup:
    | Pick<
        FirebaseProjectRow,
        "firebase_project_id" | "display_name"
      >
    | Pick<
        FirebaseProjectRow,
        "firebase_project_id" | "display_name"
      >[]
    | null;
  created_at: string;
  updated_at: string;
};

function pickLookupLumaId(
  lk: HackathonRow["luma_event_lookup"],
): string | null {
  if (lk == null) return null;
  if (Array.isArray(lk)) {
    const id = lk[0]?.luma_event_id?.trim();
    return id && id.length > 0 ? id : null;
  }
  const id = lk.luma_event_id?.trim();
  return id && id.length > 0 ? id : null;
}

function pickLookupLumaDisplayName(
  lk: HackathonRow["luma_event_lookup"],
): string | null {
  if (lk == null) return null;
  if (Array.isArray(lk)) {
    const n = lk[0]?.display_name?.trim();
    return n && n.length > 0 ? n : null;
  }
  const n = lk.display_name?.trim();
  return n && n.length > 0 ? n : null;
}

function pickLookupFirebaseId(
  fk: HackathonRow["firebase_project_lookup"],
): string | null {
  if (fk == null) return null;
  if (Array.isArray(fk)) {
    const id = fk[0]?.firebase_project_id?.trim();
    return id && id.length > 0 ? id : null;
  }
  const id = fk.firebase_project_id?.trim();
  return id && id.length > 0 ? id : null;
}

/** Prefer legacy hackathons.luma_event_id; fallback to FK embed when rollout clears text. */
export function hackathonLumaEventId(row: HackathonRow): string | null {
  const direct = row.luma_event_id?.trim();
  if (direct) return direct;
  return pickLookupLumaId(row.luma_event_lookup);
}

/**
 * Human-readable Luma event name when known: synced title on the hackathon row,
 * then `public.luma_events.display_name` via `luma_event_uuid` FK.
 */
export function hackathonLumaEventTitle(row: HackathonRow): string | null {
  const synced = row.luma_event_title?.trim();
  if (synced) return synced;
  return pickLookupLumaDisplayName(row.luma_event_lookup);
}

/** Prefer legacy firebase_config_ref; fallback to FK embed when rollout clears text. */
export function hackathonFirebaseProjectId(row: HackathonRow): string | null {
  const direct = row.firebase_config_ref?.trim();
  if (direct) return direct;
  return pickLookupFirebaseId(row.firebase_project_lookup);
}
