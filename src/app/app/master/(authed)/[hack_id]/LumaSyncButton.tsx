"use client";

import { useState, useTransition } from "react";

import { syncLumaForHackathonAction, type LumaSyncState } from "./actions";

export function LumaSyncButton({
  hackathonId,
  hasLumaId,
}: {
  hackathonId: string;
  hasLumaId: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [state, setState] = useState<LumaSyncState | null>(null);
  const [includeRsvp, setIncludeRsvp] = useState(false);

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-emerald-400/20 bg-emerald-500/5 p-3">
      <div className="flex items-baseline justify-between">
        <span className="text-sm font-medium text-emerald-200">
          Luma · sync checked-in guests
        </span>
        <span className="text-[11px] text-emerald-400/70">browser-use cloud</span>
      </div>
      <p className="text-[11px] text-zinc-400">
        Pulls the current guest list from Luma and upserts into{" "}
        <code>hackathon_attendees</code>. Late check-ins are additive — rows
        that already claimed credits are never disturbed.
      </p>
      <label className="flex items-center gap-2 text-[11px] text-zinc-400">
        <input
          type="checkbox"
          checked={includeRsvp}
          onChange={(e) => setIncludeRsvp(e.target.checked)}
          className="h-3 w-3"
        />
        Also include RSVP&apos;d (not yet checked-in)
      </label>
      <button
        type="button"
        disabled={pending || !hasLumaId}
        onClick={() => {
          setState(null);
          startTransition(async () => {
            const result = await syncLumaForHackathonAction(hackathonId, {
              includeRsvp,
            });
            setState(result);
          });
        }}
        className="self-start rounded-md border border-emerald-400/40 bg-emerald-500/10 px-3 py-1.5 text-xs font-medium text-emerald-100 hover:border-emerald-300/60 disabled:opacity-50"
      >
        {pending ? "Syncing… (this can take ~30s)" : "Sync now"}
      </button>
      {!hasLumaId ? (
        <p className="text-[11px] text-amber-300/80">
          Set <code>hackathons.luma_event_id</code> on this hack first.
        </p>
      ) : null}
      {state ? (
        <p
          className={`whitespace-pre-line text-[11px] ${state.ok ? "text-emerald-200" : "text-rose-300"}`}
        >
          {state.message}
          {state.ok && state.upserted !== undefined
            ? ` (upserted ${state.upserted}/${state.total})`
            : ""}
        </p>
      ) : null}
    </div>
  );
}
