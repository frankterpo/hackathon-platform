"use server";

import { revalidatePath } from "next/cache";

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
  const payload = {
    name,
    status: parseStatus(formData.get("status")),
    theme_slug: themeSlug,
    slug: themeSlug,
    vercel_project_slug: emptyToNull(formData.get("vercelSlug")),
    luma_event_id: emptyToNull(formData.get("lumaEventId")),
    firebase_config_ref: emptyToNull(formData.get("firebaseProjectId")),
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
  revalidatePath("/admin/master-panel");
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
  revalidatePath("/admin/master-panel");
  return { error: null, ok: true };
}
