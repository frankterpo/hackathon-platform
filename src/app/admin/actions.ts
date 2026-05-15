"use server";

import { revalidatePath } from "next/cache";
import type { SupabaseClient } from "@supabase/supabase-js";

import type { HackathonStatus } from "@/types/database";
import {
  createServerSupabaseClient,
  hasServiceRoleKey,
} from "@/lib/supabase/server";

export type CreateHackathonState = {
  error: string | null;
  ok: boolean;
};

function parseStatus(raw: FormDataEntryValue | null): HackathonStatus {
  const s = typeof raw === "string" ? raw : "";
  if (s === "live" || s === "scheduled" || s === "completed") {
    return s;
  }
  return "scheduled";
}

function emptyToNull(raw: FormDataEntryValue | null): string | null {
  if (typeof raw !== "string") {
    return null;
  }
  const t = raw.trim();
  return t.length > 0 ? t : null;
}

async function ensureLumaEventRowId(
  supabase: SupabaseClient,
  lumaEventId: string | null,
): Promise<string | null> {
  if (!lumaEventId) return null;
  const trimmed = lumaEventId.trim();
  if (!trimmed) return null;
  const { data: existing } = await supabase
    .from("luma_events")
    .select("id")
    .eq("luma_event_id", trimmed)
    .maybeSingle();
  if (existing) return (existing as { id: string }).id;
  const { data: inserted, error } = await supabase
    .from("luma_events")
    .insert({ luma_event_id: trimmed, display_name: null })
    .select("id")
    .single();
  if (error?.code === "23505") {
    const { data: again } = await supabase
      .from("luma_events")
      .select("id")
      .eq("luma_event_id", trimmed)
      .maybeSingle();
    return (again as { id: string } | null)?.id ?? null;
  }
  if (error) {
    console.error("[ensureLumaEventRowId]", error.message, error);
    return null;
  }
  return (inserted as { id: string } | null)?.id ?? null;
}

async function ensureFirebaseProjectRowId(
  supabase: SupabaseClient,
  firebaseProjectId: string | null,
): Promise<string | null> {
  if (!firebaseProjectId) return null;
  const trimmed = firebaseProjectId.trim();
  if (!trimmed) return null;
  const { data: existing } = await supabase
    .from("firebase_projects")
    .select("id")
    .eq("firebase_project_id", trimmed)
    .maybeSingle();
  if (existing) return (existing as { id: string }).id;
  const { data: inserted, error } = await supabase
    .from("firebase_projects")
    .insert({ firebase_project_id: trimmed, display_name: null })
    .select("id")
    .single();
  if (error?.code === "23505") {
    const { data: again } = await supabase
      .from("firebase_projects")
      .select("id")
      .eq("firebase_project_id", trimmed)
      .maybeSingle();
    return (again as { id: string } | null)?.id ?? null;
  }
  if (error) {
    console.error("[ensureFirebaseProjectRowId]", error.message, error);
    return null;
  }
  return (inserted as { id: string } | null)?.id ?? null;
}

function toSlug(value: string): string {
  const slug = value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-")
    .slice(0, 64);

  return slug || "hackathon";
}

export async function createHackathonAction(
  _prev: CreateHackathonState,
  formData: FormData,
): Promise<CreateHackathonState> {
  const expected = process.env.ADMIN_SECRET?.trim();
  if (!expected) {
    return {
      error:
        "ADMIN_SECRET is not set on the server. Add ADMIN_SECRET to .env.local (see .env.example), or insert rows via supabase/seed.sql or the Supabase SQL editor.",
      ok: false,
    };
  }

  const adminSecretRaw = formData.get("adminSecret");
  const secret =
    typeof adminSecretRaw === "string" ? adminSecretRaw.trim() : "";
  if (secret !== expected) {
    return {
      error: "Admin secret does not match server ADMIN_SECRET.",
      ok: false,
    };
  }

  const nameRaw = formData.get("name");
  const name = typeof nameRaw === "string" ? nameRaw.trim() : "";
  if (!name) {
    return { error: "Hackathon name is required.", ok: false };
  }

  const supabase = createServerSupabaseClient();
  if (!supabase) {
    return {
      error:
        "Supabase client could not be created. Add NEXT_PUBLIC_SUPABASE_URL (or SUPABASE_URL) plus SUPABASE_SERVICE_ROLE_KEY or NEXT_PUBLIC_SUPABASE_ANON_KEY to .env.local (see .env.example). Service role is required for inserts while RLS has no anon write policies.",
      ok: false,
    };
  }

  if (!hasServiceRoleKey()) {
    return {
      error:
        "SUPABASE_SERVICE_ROLE_KEY is missing. Inserts are blocked for anon-only setups until you add RLS policies; add the service role key for this admin form.",
      ok: false,
    };
  }

  const themeSlug = emptyToNull(formData.get("themeSlug")) ?? toSlug(name);
  const startDate = emptyToNull(formData.get("startDate"));
  const endDate = emptyToNull(formData.get("endDate"));
  const lumaEv = emptyToNull(formData.get("lumaEventId"));
  const fbRef = emptyToNull(formData.get("firebaseProjectId"));
  const luma_event_uuid = await ensureLumaEventRowId(supabase, lumaEv);
  const firebase_project_uuid = await ensureFirebaseProjectRowId(supabase, fbRef);
  if (lumaEv && !luma_event_uuid) {
    return {
      error:
        "Could not create or resolve public.luma_events row for this Luma event id. Check logs and migrations.",
      ok: false,
    };
  }
  if (fbRef && !firebase_project_uuid) {
    return {
      error:
        "Could not create or resolve public.firebase_projects row for this Firebase project id. Check logs and migrations.",
      ok: false,
    };
  }
  const payload = {
    name,
    status: parseStatus(formData.get("status")),
    theme_slug: themeSlug,
    slug: themeSlug,
    vercel_project_slug: emptyToNull(formData.get("vercelSlug")),
    luma_event_id: lumaEv,
    firebase_config_ref: fbRef,
    luma_event_uuid,
    firebase_project_uuid,
    start_date: startDate,
    end_date: endDate,
    starts_at: startDate ?? new Date().toISOString(),
    ends_at: endDate ?? startDate ?? new Date().toISOString(),
  };

  const { error } = await supabase.from("hackathons").insert(payload);

  if (error) {
    console.error("[createHackathonAction]", error.message, error);
    return {
      error: `Could not insert row: ${error.message}. Confirm migrations are applied (npm run supabase:push), table public.hackathons exists, and the service role key is correct.`,
      ok: false,
    };
  }

  revalidatePath("/");
  revalidatePath("/app/master");
  return { error: null, ok: true };
}

export async function updateHackathonStatusAction(
  hackathonId: string,
  status: HackathonStatus,
): Promise<{ error: string | null; ok: boolean }> {
  if (!hackathonId?.trim()) {
    return { error: "Missing hackathon id.", ok: false };
  }
  if (status !== "live" && status !== "scheduled" && status !== "completed") {
    return { error: "Invalid status.", ok: false };
  }
  if (!hasServiceRoleKey()) {
    return {
      error:
        "SUPABASE_SERVICE_ROLE_KEY is required to move cards (same as admin inserts). Add it to .env.local.",
      ok: false,
    };
  }
  const supabase = createServerSupabaseClient();
  if (!supabase) {
    return { error: "Could not create Supabase client.", ok: false };
  }

  const { error } = await supabase
    .from("hackathons")
    .update({ status })
    .eq("id", hackathonId.trim());

  if (error) {
    console.error("[updateHackathonStatusAction]", error.message, error);
    return { error: error.message, ok: false };
  }

  revalidatePath("/");
  revalidatePath("/app/master");
  return { error: null, ok: true };
}
