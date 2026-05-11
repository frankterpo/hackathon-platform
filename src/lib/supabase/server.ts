import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import type { HackathonRow } from "@/types/database";

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
    vercel_project_slug: "cursor-hackathon-london-2026-1",
    luma_event_id: "mock-luma-upcoming",
    luma_url: "https://luma.com/mock-luma-upcoming",
    luma_event_title: "Mock · Design systems day (scheduled)",
    luma_timezone: null,
    luma_location: null,
    luma_description: null,
    luma_raw_payload: null,
    firebase_config_ref: null,
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

  const { data, error } = await supabase
    .from("hackathons")
    .select(
      "id,name,status,start_date,end_date,starts_at,ends_at,theme_slug,slug,vercel_project_slug,luma_event_id,luma_url,luma_event_title,luma_timezone,luma_location,luma_description,luma_raw_payload,firebase_config_ref,created_at,updated_at",
    );

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

  const rows = (data ?? []) as HackathonRow[];
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
