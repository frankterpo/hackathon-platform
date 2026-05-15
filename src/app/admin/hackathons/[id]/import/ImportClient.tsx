"use client";

import { useState, useTransition } from "react";

import {
  importCsvAction,
  type ImportState,
} from "@/app/admin/hackathons/[id]/import/actions";

const TARGET_HELP: Record<string, string> = {
  attendees:
    "headers: email, first_name, last_name, source, rsvp_at, checked_in_at",
  credits:
    "headers: email, first_name, last_name, amount_usd, external_ref|url, firebase_doc_path",
  judges: "headers: email, display_name",
};

export function ImportClient({ hackathonId }: { hackathonId: string }) {
  const [pending, startTransition] = useTransition();
  const [state, setState] = useState<ImportState | null>(null);
  const [target, setTarget] = useState<"attendees" | "credits" | "judges">(
    "attendees",
  );

  function onSubmit(formData: FormData) {
    setState(null);
    startTransition(async () => {
      const res = await importCsvAction(hackathonId, formData);
      setState(res);
    });
  }

  return (
    <form
      action={onSubmit}
      className="flex flex-col gap-3 rounded-xl border border-white/10 bg-zinc-900/50 p-5"
    >
      <div className="flex flex-col gap-1">
        <label className="text-xs uppercase tracking-wider text-zinc-400">
          Target
        </label>
        <select
          name="target"
          value={target}
          onChange={(e) =>
            setTarget(e.target.value as "attendees" | "credits" | "judges")
          }
          className="rounded-md border border-white/10 bg-zinc-950 px-3 py-2 text-sm text-zinc-100"
        >
          <option value="attendees">Attendees (Luma RSVPs)</option>
          <option value="credits">Credit allocations</option>
          <option value="judges">Judges</option>
        </select>
        <p className="text-[11px] text-zinc-500">{TARGET_HELP[target]}</p>
      </div>
      <label className="flex flex-col gap-1 text-xs uppercase tracking-wider text-zinc-400">
        Admin secret
        <input
          name="adminSecret"
          type="password"
          required
          className="rounded-md border border-white/10 bg-zinc-950 px-3 py-2 text-sm text-zinc-100"
        />
      </label>
      <label className="flex flex-col gap-1 text-xs uppercase tracking-wider text-zinc-400">
        CSV
        <textarea
          name="csv"
          rows={8}
          required
          placeholder={`email,first_name,last_name${target === "credits" ? ",amount_usd,url" : ""}\nyou@example.com,Pablo,Te${target === "credits" ? ",250,https://provider.example/redeem/abc" : ""}`}
          className="rounded-md border border-white/10 bg-zinc-950 px-3 py-2 font-mono text-xs text-zinc-100"
        />
      </label>
      <button
        type="submit"
        disabled={pending}
        className="self-start rounded-md border border-zinc-300 bg-zinc-100 px-4 py-2 text-sm font-semibold text-zinc-900 transition hover:bg-white disabled:opacity-50"
      >
        {pending ? "Importing…" : "Upsert rows"}
      </button>
      {state ? (
        <p
          className={`text-xs ${state.ok ? "text-emerald-300" : "text-rose-300"}`}
        >
          {state.message} {state.ok ? `(${state.inserted} rows)` : null}
        </p>
      ) : null}
    </form>
  );
}
