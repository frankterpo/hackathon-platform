"use server";

import { headers } from "next/headers";

import { createAuthSupabaseClient } from "@/lib/supabase/auth";

export type MagicLinkResult = {
  ok: boolean;
  message: string;
};

export async function sendMagicLinkAction(
  formData: FormData,
): Promise<MagicLinkResult> {
  const emailRaw = formData.get("email");
  const nextRaw = formData.get("next");

  const email = (typeof emailRaw === "string" ? emailRaw : "").trim().toLowerCase();
  const next = typeof nextRaw === "string" && nextRaw.startsWith("/") ? nextRaw : "/app/master";

  if (!email || !email.includes("@")) {
    return { ok: false, message: "Enter the email you used to RSVP on Luma." };
  }

  const supabase = await createAuthSupabaseClient();
  if (!supabase) {
    return {
      ok: false,
      message:
        "Auth is not configured (missing NEXT_PUBLIC_SUPABASE_ANON_KEY). Add it to .env.local and restart dev.",
    };
  }

  const headerStore = await headers();
  const host =
    headerStore.get("x-forwarded-host") ?? headerStore.get("host") ?? "";
  const proto = headerStore.get("x-forwarded-proto") ?? "https";
  const base =
    host && !host.startsWith("localhost") && !host.startsWith("127.")
      ? `${proto}://${host}`
      : `http://${host || "localhost:3000"}`;
  const redirectTo = `${base}/auth/callback?next=${encodeURIComponent(next)}`;

  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: redirectTo,
      shouldCreateUser: true,
    },
  });

  if (error) {
    return { ok: false, message: error.message };
  }
  return {
    ok: true,
    message: `Magic link sent to ${email}. Open it to continue.`,
  };
}
