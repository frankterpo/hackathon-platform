import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import type {
  AgentRunRow,
  HackathonRow,
  HackathonTaskRow,
} from "@/types/database";

/** Non-empty trimmed string, or undefined if missing/blank. */
function envTrim(name: string): string | undefined {
  const raw = process.env[name];
  if (typeof raw !== "string") {
    return undefined;
  }
  const t = raw.trim();
  return t.length > 0 ? t : undefined;
}

/** What Next actually sees (no secret values). Use for setup banners. */
export type SupabaseEnvDiagnostics = {
  urlPresent: boolean;
  keyPresent: boolean;
  /** URL set but not parseable as http(s) */
  urlInvalid: boolean;
};

export function getSupabaseEnvDiagnostics(): SupabaseEnvDiagnostics {
  const url = envTrim("NEXT_PUBLIC_SUPABASE_URL") ?? envTrim("SUPABASE_URL");
  const key =
    envTrim("SUPABASE_SERVICE_ROLE_KEY") ??
    envTrim("NEXT_PUBLIC_SUPABASE_ANON_KEY") ??
    envTrim("SUPABASE_ANON_KEY");
  let urlInvalid = false;
  if (url) {
    try {
      const parsed = new URL(url);
      if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
        urlInvalid = true;
      }
    } catch {
      urlInvalid = true;
    }
  }
  return {
    urlPresent: Boolean(url),
    keyPresent: Boolean(key),
    urlInvalid,
  };
}

/**
 * Server-only Supabase URL + key as loaded by Next.js from `.env`, `.env.local`, etc.
 * Uses `NEXT_PUBLIC_SUPABASE_URL` or falls back to `SUPABASE_URL` (CLI-style naming).
 * Keys: service role (preferred), then anon (`NEXT_PUBLIC_*` or `SUPABASE_ANON_KEY` from dashboard).
 */
export function resolveSupabaseServerEnv(): {
  url: string;
  key: string;
} | null {
  const url = envTrim("NEXT_PUBLIC_SUPABASE_URL") ?? envTrim("SUPABASE_URL");
  const key =
    envTrim("SUPABASE_SERVICE_ROLE_KEY") ??
    envTrim("NEXT_PUBLIC_SUPABASE_ANON_KEY") ??
    envTrim("SUPABASE_ANON_KEY");
  if (!url || !key) {
    return null;
  }
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return null;
    }
  } catch {
    return null;
  }
  return { url, key };
}

export function hasServiceRoleKey(): boolean {
  return Boolean(envTrim("SUPABASE_SERVICE_ROLE_KEY"));
}

export function createServerSupabaseClient(): SupabaseClient | null {
  const env = resolveSupabaseServerEnv();
  if (!env) {
    return null;
  }
  return createClient(env.url, env.key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/** Hackathon row without PostgREST embeds — works before lookup-table migration is applied. */
const HACKATHON_BASE_SELECT = [
  "id,name,status,start_date,end_date,starts_at,ends_at,theme_slug,slug,vercel_project_slug",
  "luma_event_id,luma_url,luma_event_title,luma_timezone,luma_location,luma_description,luma_raw_payload,firebase_config_ref",
  "luma_event_uuid,firebase_project_uuid",
  "created_at,updated_at",
].join(",");

/** Pre–integration-migration schema: no UUID FK columns on hackathons. */
const HACKATHON_LEGACY_SELECT = [
  "id,name,status,start_date,end_date,starts_at,ends_at,theme_slug,slug,vercel_project_slug",
  "luma_event_id,luma_url,luma_event_title,luma_timezone,luma_location,luma_description,luma_raw_payload,firebase_config_ref",
  "created_at,updated_at",
].join(",");

const HACKATHON_DETAIL_SELECT = [
  HACKATHON_BASE_SELECT.replace(/,created_at,updated_at$/, ""),
  "luma_event_lookup:luma_events!hackathons_luma_event_uuid_fkey(luma_event_id,display_name)",
  "firebase_project_lookup:firebase_projects!hackathons_firebase_project_uuid_fkey(firebase_project_id,display_name)",
  "created_at,updated_at",
].join(",");

/**
 * PostgREST returns this when embed hints reference FKs that are not in its schema cache
 * (migration not applied, or cache not yet refreshed after DDL).
 */
export function isPostgrestEmbedRelationshipError(message: string): boolean {
  const m = message.toLowerCase();
  return (
    m.includes("could not find a relationship") ||
    (m.includes("relationship") && m.includes("schema cache"))
  );
}

/** Base select references integration UUID columns; fails if lookup migration never ran. */
export function isMissingIntegrationUuidColumnsError(message: string): boolean {
  const m = message.toLowerCase();
  return (
    m.includes("luma_event_uuid") &&
    (m.includes("does not exist") || m.includes("column"))
  );
}

function withNullEmbedLookups(row: unknown): HackathonRow {
  const r = row as Partial<HackathonRow>;
  return {
    ...(r as HackathonRow),
    luma_event_uuid: r.luma_event_uuid ?? null,
    firebase_project_uuid: r.firebase_project_uuid ?? null,
    luma_event_lookup: r.luma_event_lookup ?? null,
    firebase_project_lookup: r.firebase_project_lookup ?? null,
  };
}

const MOCK_NOW = new Date();

const DEV_MOCK_HACKATHONS: HackathonRow[] = [
  {
    id: "00000000-0000-4000-8000-000000000001",
    name: "Mock · Spring build sprint (past)",
    status: "completed",
    start_date: new Date(MOCK_NOW.getTime() - 45 * 864e5).toISOString(),
    end_date: new Date(MOCK_NOW.getTime() - 43 * 864e5).toISOString(),
    starts_at: new Date(MOCK_NOW.getTime() - 45 * 864e5).toISOString(),
    ends_at: new Date(MOCK_NOW.getTime() - 43 * 864e5).toISOString(),
    theme_slug: "mock-spring-sprint",
    slug: "mock-spring-sprint",
    vercel_project_slug: null,
    luma_event_id: null,
    luma_url: null,
    luma_event_title: null,
    luma_timezone: null,
    luma_location: null,
    luma_description: null,
    luma_raw_payload: null,
    firebase_config_ref: null,
    luma_event_uuid: null,
    firebase_project_uuid: null,
    luma_event_lookup: null,
    firebase_project_lookup: null,
    created_at: new Date(MOCK_NOW.getTime() - 50 * 864e5).toISOString(),
    updated_at: new Date(MOCK_NOW.getTime() - 43 * 864e5).toISOString(),
  },
  {
    id: "00000000-0000-4000-8000-000000000002",
    name: "Mock · API literacy week (past)",
    status: "completed",
    start_date: new Date(MOCK_NOW.getTime() - 120 * 864e5).toISOString(),
    end_date: new Date(MOCK_NOW.getTime() - 118 * 864e5).toISOString(),
    starts_at: new Date(MOCK_NOW.getTime() - 120 * 864e5).toISOString(),
    ends_at: new Date(MOCK_NOW.getTime() - 118 * 864e5).toISOString(),
    theme_slug: "mock-api-week",
    slug: "mock-api-week",
    vercel_project_slug: "demo-hack-api-2025",
    luma_event_id: null,
    luma_url: null,
    luma_event_title: null,
    luma_timezone: null,
    luma_location: null,
    luma_description: null,
    luma_raw_payload: null,
    firebase_config_ref: null,
    luma_event_uuid: null,
    firebase_project_uuid: null,
    luma_event_lookup: null,
    firebase_project_lookup: null,
    created_at: new Date(MOCK_NOW.getTime() - 125 * 864e5).toISOString(),
    updated_at: new Date(MOCK_NOW.getTime() - 118 * 864e5).toISOString(),
  },
  {
    id: "00000000-0000-4000-8000-000000000003",
    name: "Mock · Edge & AI jam (past)",
    status: "completed",
    start_date: new Date(MOCK_NOW.getTime() - 200 * 864e5).toISOString(),
    end_date: new Date(MOCK_NOW.getTime() - 198 * 864e5).toISOString(),
    starts_at: new Date(MOCK_NOW.getTime() - 200 * 864e5).toISOString(),
    ends_at: new Date(MOCK_NOW.getTime() - 198 * 864e5).toISOString(),
    theme_slug: "mock-edge-ai",
    slug: "mock-edge-ai",
    vercel_project_slug: null,
    luma_event_id: "mock-luma-past",
    luma_url: "https://luma.com/mock-luma-past",
    luma_event_title: "Mock · Edge & AI jam (past)",
    luma_timezone: null,
    luma_location: null,
    luma_description: null,
    luma_raw_payload: null,
    firebase_config_ref: null,
    luma_event_uuid: null,
    firebase_project_uuid: null,
    luma_event_lookup: null,
    firebase_project_lookup: null,
    created_at: new Date(MOCK_NOW.getTime() - 205 * 864e5).toISOString(),
    updated_at: new Date(MOCK_NOW.getTime() - 198 * 864e5).toISOString(),
  },
  {
    id: "00000000-0000-4000-8000-000000000004",
    name: "Mock · Product week (scheduled)",
    status: "scheduled",
    start_date: new Date(MOCK_NOW.getTime() + 14 * 864e5).toISOString(),
    end_date: new Date(MOCK_NOW.getTime() + 16 * 864e5).toISOString(),
    starts_at: new Date(MOCK_NOW.getTime() + 14 * 864e5).toISOString(),
    ends_at: new Date(MOCK_NOW.getTime() + 16 * 864e5).toISOString(),
    theme_slug: "mock-product-week",
    slug: "mock-product-week",
    vercel_project_slug: null,
    luma_event_id: null,
    luma_url: null,
    luma_event_title: null,
    luma_timezone: null,
    luma_location: null,
    luma_description: null,
    luma_raw_payload: null,
    firebase_config_ref: null,
    luma_event_uuid: null,
    firebase_project_uuid: null,
    luma_event_lookup: null,
    firebase_project_lookup: null,
    created_at: MOCK_NOW.toISOString(),
    updated_at: MOCK_NOW.toISOString(),
  },
  {
    id: "00000000-0000-4000-8000-000000000005",
    name: "Mock · Design systems day (scheduled)",
    status: "scheduled",
    start_date: new Date(MOCK_NOW.getTime() + 45 * 864e5).toISOString(),
    end_date: new Date(MOCK_NOW.getTime() + 45 * 864e5 + 36e6).toISOString(),
    starts_at: new Date(MOCK_NOW.getTime() + 45 * 864e5).toISOString(),
    ends_at: new Date(MOCK_NOW.getTime() + 45 * 864e5 + 36e6).toISOString(),
    theme_slug: "mock-design-systems",
    slug: "mock-design-systems",
    vercel_project_slug: null,
    luma_event_id: "mock-luma-upcoming",
    luma_url: "https://luma.com/mock-luma-upcoming",
    luma_event_title: "Mock · Design systems day (scheduled)",
    luma_timezone: null,
    luma_location: null,
    luma_description: null,
    luma_raw_payload: null,
    firebase_config_ref: null,
    luma_event_uuid: null,
    firebase_project_uuid: null,
    luma_event_lookup: null,
    firebase_project_lookup: null,
    created_at: MOCK_NOW.toISOString(),
    updated_at: MOCK_NOW.toISOString(),
  },
];

export type HackathonsLoadResult = {
  hackathons: HackathonRow[];
  queryError: string | null;
  usedDevMock: boolean;
  /** True when URL + key are present and URL is valid (same predicate as client creation). */
  supabaseEnvReady: boolean;
  envDiagnostics: SupabaseEnvDiagnostics;
};

function devMockEnabled(): boolean {
  return (
    process.env.NODE_ENV === "development" &&
    process.env.NEXT_PUBLIC_USE_MOCK_HACKATHONS === "1"
  );
}

/**
 * Public `/` Hackathon radar and admin Kanban use this unchanged. `/app/master` loads the
 * same rows then filters with `hideHackathonFromMasterOverview` (and optional
 * `MASTER_OVERVIEW_REQUIRE_FIREBASE`); the board loader never filters on Firebase.
 * Local/prod data fetch needs `NEXT_PUBLIC_SUPABASE_URL` (or `SUPABASE_URL`) plus
 * `SUPABASE_SERVICE_ROLE_KEY` or `NEXT_PUBLIC_SUPABASE_ANON_KEY` / `SUPABASE_ANON_KEY`.
 */
export async function loadHackathonsForBoard(): Promise<HackathonsLoadResult> {
  const mockRequested = devMockEnabled();
  const supabaseEnvReady = resolveSupabaseServerEnv() !== null;
  const envDiagnostics = getSupabaseEnvDiagnostics();

  const supabase = createServerSupabaseClient();
  if (!supabase) {
    if (mockRequested) {
      return {
        hackathons: DEV_MOCK_HACKATHONS,
        queryError: null,
        usedDevMock: true,
        supabaseEnvReady,
        envDiagnostics,
      };
    }
    return {
      hackathons: [],
      queryError: null,
      usedDevMock: false,
      supabaseEnvReady,
      envDiagnostics,
    };
  }

  let { data, error } = await supabase
    .from("hackathons")
    .select(HACKATHON_DETAIL_SELECT);

  if (error && isMissingIntegrationUuidColumnsError(error.message)) {
    const leg = await supabase.from("hackathons").select(HACKATHON_LEGACY_SELECT);
    data = leg.data;
    error = leg.error;
  } else if (error && isPostgrestEmbedRelationshipError(error.message)) {
    console.warn(
      "[hackathon-platform] loadHackathonsForBoard: retrying without luma_events/firebase_projects embeds (run `npm run supabase:push` for migration 20260516183000_integration_lookup_tables.sql).",
      error.message,
    );
    const second = await supabase
      .from("hackathons")
      .select(HACKATHON_BASE_SELECT);
    data = second.data;
    error = second.error;
    if (error && isMissingIntegrationUuidColumnsError(error.message)) {
      const third = await supabase
        .from("hackathons")
        .select(HACKATHON_LEGACY_SELECT);
      data = third.data;
      error = third.error;
    }
  }

  if (error) {
    console.error(
      "[hackathon-platform] loadHackathonsForBoard",
      error.message,
      error,
    );
    if (mockRequested) {
      return {
        hackathons: DEV_MOCK_HACKATHONS,
        queryError: error.message,
        usedDevMock: true,
        supabaseEnvReady,
        envDiagnostics,
      };
    }
    return {
      hackathons: [],
      queryError: error.message,
      usedDevMock: false,
      supabaseEnvReady,
      envDiagnostics,
    };
  }

  const rows = (data ?? []).map(withNullEmbedLookups);
  rows.sort((a, b) => {
    const ta = a.start_date ?? a.created_at ?? "";
    const tb = b.start_date ?? b.created_at ?? "";
    return ta.localeCompare(tb);
  });

  if (rows.length === 0 && mockRequested) {
    return {
      hackathons: DEV_MOCK_HACKATHONS,
      queryError: null,
      usedDevMock: true,
      supabaseEnvReady,
      envDiagnostics,
    };
  }

  return {
    hackathons: rows,
    queryError: null,
    usedDevMock: false,
    supabaseEnvReady,
    envDiagnostics,
  };
}

export function isSupabaseConfigured(): boolean {
  return resolveSupabaseServerEnv() !== null;
}

export async function loadHackathonById(
  id: string,
): Promise<{ hackathon: HackathonRow | null; error: string | null }> {
  const trimmed = id?.trim();
  if (!trimmed) {
    return { hackathon: null, error: "Missing id." };
  }
  const supabase = createServerSupabaseClient();
  if (!supabase) {
    return { hackathon: null, error: "Supabase client unavailable." };
  }
  let { data, error } = await supabase
    .from("hackathons")
    .select(HACKATHON_DETAIL_SELECT)
    .eq("id", trimmed)
    .maybeSingle();

  if (error && isMissingIntegrationUuidColumnsError(error.message)) {
    const leg = await supabase
      .from("hackathons")
      .select(HACKATHON_LEGACY_SELECT)
      .eq("id", trimmed)
      .maybeSingle();
    data = leg.data;
    error = leg.error;
  } else if (error && isPostgrestEmbedRelationshipError(error.message)) {
    console.warn(
      "[loadHackathonById] retrying without integration embeds:",
      error.message,
    );
    const second = await supabase
      .from("hackathons")
      .select(HACKATHON_BASE_SELECT)
      .eq("id", trimmed)
      .maybeSingle();
    data = second.data;
    error = second.error;
    if (error && isMissingIntegrationUuidColumnsError(error.message)) {
      const third = await supabase
        .from("hackathons")
        .select(HACKATHON_LEGACY_SELECT)
        .eq("id", trimmed)
        .maybeSingle();
      data = third.data;
      error = third.error;
    }
  }

  if (error) {
    console.error("[loadHackathonById]", error.message, error);
    return { hackathon: null, error: error.message };
  }
  return {
    hackathon: data ? withNullEmbedLookups(data) : null,
    error: null,
  };
}

export async function loadHackathonTasks(
  hackathonId: string,
): Promise<{ tasks: HackathonTaskRow[]; error: string | null }> {
  const trimmed = hackathonId?.trim();
  if (!trimmed) {
    return { tasks: [], error: "Missing hackathon id." };
  }
  const supabase = createServerSupabaseClient();
  if (!supabase) {
    return { tasks: [], error: "Supabase client unavailable." };
  }
  const { data, error } = await supabase
    .from("hackathon_tasks")
    .select(
      "id,hackathon_id,title,task_type,status,sort_order,notes,due_at,created_at,updated_at",
    )
    .eq("hackathon_id", trimmed)
    .order("sort_order", { ascending: true })
    .order("id", { ascending: true });

  if (error) {
    console.error("[loadHackathonTasks]", error.message, error);
    return { tasks: [], error: error.message };
  }
  return { tasks: (data ?? []) as HackathonTaskRow[], error: null };
}

/** Read-only stub rows for `public.agent_runs` (no runners in V1). */
export async function loadAgentRunsForHackathon(
  hackathonId: string,
): Promise<{ runs: AgentRunRow[]; error: string | null }> {
  const trimmed = hackathonId?.trim();
  if (!trimmed) {
    return { runs: [], error: "Missing hackathon id." };
  }
  const supabase = createServerSupabaseClient();
  if (!supabase) {
    return { runs: [], error: null };
  }
  const { data, error } = await supabase
    .from("agent_runs")
    .select(
      "id,hackathon_task_id,hackathon_id,intent,output_draft,state,created_at",
    )
    .eq("hackathon_id", trimmed)
    .order("created_at", { ascending: false })
    .limit(25);

  if (error) {
    console.error("[loadAgentRunsForHackathon]", error.message, error);
    return { runs: [], error: error.message };
  }
  return { runs: (data ?? []) as AgentRunRow[], error: null };
}
