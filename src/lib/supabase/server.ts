import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import type { HackathonRow } from "@/types/database";

function getServerSupabase(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const key = serviceKey ?? anonKey;
  if (!url || !key) {
    return null;
  }
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export async function fetchHackathons(): Promise<HackathonRow[]> {
  const supabase = getServerSupabase();
  if (!supabase) {
    return [];
  }

  const { data, error } = await supabase
    .from("hackathons")
    .select("*")
    .order("start_date", { ascending: true, nullsFirst: false });

  if (error) {
    console.error("[hackathon-platform] fetchHackathons", error.message);
    return [];
  }

  return (data ?? []) as HackathonRow[];
}

export function isSupabaseConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      (process.env.SUPABASE_SERVICE_ROLE_KEY ??
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
  );
}
