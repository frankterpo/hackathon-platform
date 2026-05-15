import "server-only";

import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

import { resolveSupabaseServerEnv } from "./server";

/**
 * Cookie-aware Supabase client for Server Components / Server Actions.
 * Uses the anon key + the user's session cookies (NOT the service role).
 */
export async function createAuthSupabaseClient() {
  const env = resolveSupabaseServerEnv();
  if (!env) return null;

  const anonKey =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() ??
    process.env.SUPABASE_ANON_KEY?.trim();
  if (!anonKey) return null;

  const cookieStore = await cookies();

  return createServerClient(env.url, anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // Server Components may not be allowed to mutate cookies; safe to ignore.
        }
      },
    },
  });
}

export async function getAuthUser(): Promise<{
  email: string | null;
  userId: string | null;
}> {
  const supabase = await createAuthSupabaseClient();
  if (!supabase) return { email: null, userId: null };
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return { email: null, userId: null };
  return {
    email: data.user.email?.trim().toLowerCase() ?? null,
    userId: data.user.id,
  };
}
