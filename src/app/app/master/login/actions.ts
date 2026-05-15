"use server";

import { redirect } from "next/navigation";

import {
  setAdminSession,
  verifyAdminPassword,
  adminSecretConfigured,
  clearAdminSession,
} from "@/lib/admin/session";

export type AdminLoginState = {
  ok: boolean;
  message: string;
};

export async function adminLoginAction(
  _prev: AdminLoginState,
  formData: FormData,
): Promise<AdminLoginState> {
  if (!adminSecretConfigured()) {
    return {
      ok: false,
      message: "ADMIN_SECRET is not set on the server.",
    };
  }
  const password = (formData.get("password") ?? "").toString();
  if (!verifyAdminPassword(password)) {
    return { ok: false, message: "Wrong password." };
  }
  await setAdminSession();

  const nextRaw = formData.get("next");
  const next =
    typeof nextRaw === "string" && nextRaw.startsWith("/app/master")
      ? nextRaw
      : "/app/master";
  redirect(next);
}

export async function adminLogoutAction(): Promise<void> {
  await clearAdminSession();
  redirect("/app/master/login");
}
