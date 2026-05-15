import "server-only";

import crypto from "node:crypto";
import { cookies } from "next/headers";

const COOKIE_NAME = "hk_admin";
const COOKIE_TTL_SECONDS = 60 * 60 * 8;
const COOKIE_VERSION = "v1";

function getAdminSecret(): string | null {
  const v = process.env.ADMIN_SECRET?.trim();
  if (!v || v.length < 8) return null;
  return v;
}

function sign(payload: string, secret: string): string {
  return crypto.createHmac("sha256", secret).update(payload).digest("base64url");
}

function timingSafeEqualStrings(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
}

export type AdminAuthState =
  | { ok: true }
  | { ok: false; reason: "no_secret" | "no_cookie" | "expired" | "bad_sig" };

export async function checkAdminSession(): Promise<AdminAuthState> {
  const secret = getAdminSecret();
  if (!secret) return { ok: false, reason: "no_secret" };
  const store = await cookies();
  const cookie = store.get(COOKIE_NAME);
  if (!cookie) return { ok: false, reason: "no_cookie" };
  const parts = cookie.value.split(".");
  if (parts.length !== 3) return { ok: false, reason: "bad_sig" };
  const [version, expStr, sig] = parts;
  if (version !== COOKIE_VERSION) return { ok: false, reason: "bad_sig" };
  const exp = Number(expStr);
  if (!Number.isFinite(exp) || exp < Math.floor(Date.now() / 1000)) {
    return { ok: false, reason: "expired" };
  }
  const expected = sign(`${version}.${expStr}`, secret);
  if (!timingSafeEqualStrings(sig, expected)) {
    return { ok: false, reason: "bad_sig" };
  }
  return { ok: true };
}

export async function isAdmin(): Promise<boolean> {
  return (await checkAdminSession()).ok;
}

export async function setAdminSession(): Promise<void> {
  const secret = getAdminSecret();
  if (!secret) throw new Error("ADMIN_SECRET not set on the server.");
  const exp = Math.floor(Date.now() / 1000) + COOKIE_TTL_SECONDS;
  const expStr = String(exp);
  const sig = sign(`${COOKIE_VERSION}.${expStr}`, secret);
  const value = `${COOKIE_VERSION}.${expStr}.${sig}`;
  const store = await cookies();
  store.set(COOKIE_NAME, value, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: COOKIE_TTL_SECONDS,
  });
}

export async function clearAdminSession(): Promise<void> {
  const store = await cookies();
  store.set(COOKIE_NAME, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });
}

export function adminSecretConfigured(): boolean {
  return getAdminSecret() !== null;
}

export function verifyAdminPassword(input: string): boolean {
  const secret = getAdminSecret();
  if (!secret) return false;
  const a = Buffer.from(secret);
  const b = Buffer.from(input ?? "");
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}
