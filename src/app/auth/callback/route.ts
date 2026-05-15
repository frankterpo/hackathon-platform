import { NextResponse } from "next/server";

import { createAuthSupabaseClient } from "@/lib/supabase/auth";

/**
 * Magic-link callback. Supabase redirects here with `?code=...`; we exchange
 * it for a session cookie and bounce back to the requested page (`?next=/...`).
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const next = url.searchParams.get("next") ?? "/app/master";

  if (!code) {
    return NextResponse.redirect(new URL(next, url.origin));
  }

  const supabase = await createAuthSupabaseClient();
  if (!supabase) {
    return NextResponse.redirect(
      new URL(`${next}?auth_error=missing_env`, url.origin),
    );
  }

  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    return NextResponse.redirect(
      new URL(
        `${next}?auth_error=${encodeURIComponent(error.message)}`,
        url.origin,
      ),
    );
  }

  return NextResponse.redirect(new URL(next, url.origin));
}
