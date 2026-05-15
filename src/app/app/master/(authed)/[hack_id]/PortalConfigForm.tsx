"use client";

import { useState, useTransition } from "react";

import {
  savePortalConfigAction,
  type SaveConfigState,
} from "@/app/app/master/(authed)/[hack_id]/actions";
import type { PortalConfigRow } from "@/lib/portals/admin-data";

function toLocalInput(iso: string | null): string {
  if (!iso) return "";
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "";
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  } catch {
    return "";
  }
}

export function PortalConfigForm({
  hackathonId,
  initial,
}: {
  hackathonId: string;
  initial: PortalConfigRow;
}) {
  const [pending, startTransition] = useTransition();
  const [state, setState] = useState<SaveConfigState | null>(null);

  function onSubmit(formData: FormData) {
    setState(null);
    startTransition(async () => {
      const res = await savePortalConfigAction(hackathonId, formData);
      setState(res);
    });
  }

  return (
    <form
      action={onSubmit}
      className="flex flex-col gap-5 rounded-xl border border-white/10 bg-zinc-900/40 p-5"
    >
      <h2 className="text-sm font-semibold uppercase tracking-[0.2em] text-zinc-400">
        Portal configuration
      </h2>

      <fieldset className="flex flex-col gap-2 rounded-lg border border-amber-400/20 bg-amber-400/5 p-3">
        <legend className="px-1 text-[11px] font-semibold uppercase tracking-wider text-amber-200">
          Credits
        </legend>
        <label className="flex items-center gap-2 text-sm text-zinc-200">
          <input
            type="checkbox"
            name="credits_enabled"
            defaultChecked={initial.credits_enabled}
            className="h-4 w-4 accent-amber-300"
          />
          Enable credits portal
        </label>
        <p className="text-[11px] text-amber-200/70">
          When off, /credits returns &quot;closed&quot;. Already-claimed rows are
          unaffected.
        </p>
      </fieldset>

      <fieldset className="flex flex-col gap-2 rounded-lg border border-violet-400/20 bg-violet-400/5 p-3">
        <legend className="px-1 text-[11px] font-semibold uppercase tracking-wider text-violet-200">
          Submissions
        </legend>
        <label className="flex items-center gap-2 text-sm text-zinc-200">
          <input
            type="checkbox"
            name="submissions_enabled"
            defaultChecked={initial.submissions_enabled}
            className="h-4 w-4 accent-violet-300"
          />
          Enable submissions portal
        </label>
        <div className="grid gap-2 sm:grid-cols-2">
          <label className="flex flex-col gap-1 text-[10px] uppercase tracking-wider text-violet-200/80">
            Opens at (local time)
            <input
              type="datetime-local"
              name="submissions_open_at"
              defaultValue={toLocalInput(initial.submissions_open_at)}
              className="rounded-md border border-white/10 bg-zinc-950 px-2 py-1.5 text-xs text-zinc-100"
            />
          </label>
          <label className="flex flex-col gap-1 text-[10px] uppercase tracking-wider text-violet-200/80">
            Closes at (local time)
            <input
              type="datetime-local"
              name="submissions_close_at"
              defaultValue={toLocalInput(initial.submissions_close_at)}
              className="rounded-md border border-white/10 bg-zinc-950 px-2 py-1.5 text-xs text-zinc-100"
            />
          </label>
        </div>
        <p className="text-[11px] text-violet-200/70">
          Window is server-enforced. Leave times empty to mean &quot;always
          open while enabled&quot;.
        </p>
      </fieldset>

      <fieldset className="flex flex-col gap-2 rounded-lg border border-cyan-400/20 bg-cyan-400/5 p-3">
        <legend className="px-1 text-[11px] font-semibold uppercase tracking-wider text-cyan-200">
          Judging
        </legend>
        <label className="flex items-center gap-2 text-sm text-zinc-200">
          <input
            type="checkbox"
            name="judging_enabled"
            defaultChecked={initial.judging_enabled}
            className="h-4 w-4 accent-cyan-300"
          />
          Enable judging portal
        </label>
        <label className="flex items-center gap-2 text-sm text-zinc-200">
          <input
            type="checkbox"
            name="judges_can_see_other_scores"
            defaultChecked={initial.judges_can_see_other_scores}
            className="h-4 w-4 accent-cyan-300"
          />
          Judges can see each other&apos;s scores
        </label>
      </fieldset>

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="rounded-md border border-zinc-300 bg-zinc-100 px-3 py-1.5 text-sm font-semibold text-zinc-900 transition hover:bg-white disabled:opacity-50"
        >
          {pending ? "Saving…" : "Save configuration"}
        </button>
        {state ? (
          <p
            className={`text-xs ${state.ok ? "text-emerald-300" : "text-rose-300"}`}
          >
            {state.message}
          </p>
        ) : null}
      </div>
    </form>
  );
}
