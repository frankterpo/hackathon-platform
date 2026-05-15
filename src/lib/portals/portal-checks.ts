import "server-only";

import { loadPortalConfig } from "@/lib/portals/admin-data";

export type GateResult =
  | { ok: true }
  | { ok: false; reason: "disabled" | "before_open" | "after_close" };

export async function gateCredits(hackathonId: string): Promise<GateResult> {
  const cfg = await loadPortalConfig(hackathonId);
  if (!cfg.credits_enabled) return { ok: false, reason: "disabled" };
  return { ok: true };
}

export async function gateSubmit(hackathonId: string): Promise<GateResult> {
  const cfg = await loadPortalConfig(hackathonId);
  if (!cfg.submissions_enabled) return { ok: false, reason: "disabled" };
  const now = Date.now();
  if (cfg.submissions_open_at && now < new Date(cfg.submissions_open_at).getTime()) {
    return { ok: false, reason: "before_open" };
  }
  if (cfg.submissions_close_at && now > new Date(cfg.submissions_close_at).getTime()) {
    return { ok: false, reason: "after_close" };
  }
  return { ok: true };
}

export async function gateJudge(hackathonId: string): Promise<GateResult> {
  const cfg = await loadPortalConfig(hackathonId);
  if (!cfg.judging_enabled) return { ok: false, reason: "disabled" };
  return { ok: true };
}

export type GateReason = "disabled" | "before_open" | "after_close";

export function gateMessage(reason: GateReason): string {
  switch (reason) {
    case "disabled":
      return "This portal is currently closed by the organizers.";
    case "before_open":
      return "This portal opens later. Check back at the announced start time.";
    case "after_close":
      return "This portal has closed. Contact the organizers if you think this is wrong.";
  }
}
