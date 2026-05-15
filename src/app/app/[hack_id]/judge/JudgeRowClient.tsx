"use client";

import { useState, useTransition } from "react";

import {
  submitJudgeScoreAction,
  type JudgeScoreState,
} from "@/app/app/[hack_id]/judge/actions";

type Props = {
  hackathonId: string;
  submission: {
    id: string;
    title: string;
    team_name: string | null;
    repo_url: string | null;
    demo_url: string | null;
    chosen_track: string | null;
  };
  existing: { score: number; notes: string | null } | null;
};

export function JudgeRowClient({ hackathonId, submission, existing }: Props) {
  const [pending, startTransition] = useTransition();
  const [state, setState] = useState<JudgeScoreState | null>(null);

  function onSubmit(formData: FormData) {
    setState(null);
    formData.set("submissionId", submission.id);
    startTransition(async () => {
      const res = await submitJudgeScoreAction(hackathonId, formData);
      setState(res);
    });
  }

  return (
    <li className="flex flex-col gap-3 rounded-xl border border-white/5 bg-zinc-900/40 p-4">
      <div>
        <div className="text-sm font-medium text-zinc-100">
          {submission.title}
        </div>
        <div className="text-xs text-zinc-500">
          {submission.chosen_track ? (
            <span className="text-zinc-400">{submission.chosen_track}</span>
          ) : null}
          {submission.chosen_track &&
          (submission.team_name || submission.repo_url || submission.demo_url)
            ? " · "
            : null}
          {submission.team_name ?? "unknown team"}
          {submission.demo_url ? (
            <>
              {" · "}
              <a
                href={submission.demo_url}
                target="_blank"
                rel="noreferrer"
                className="underline hover:text-zinc-300"
              >
                demo
              </a>
            </>
          ) : null}
          {submission.repo_url ? (
            <>
              {" · "}
              <a
                href={submission.repo_url}
                target="_blank"
                rel="noreferrer"
                className="underline hover:text-zinc-300"
              >
                repo
              </a>
            </>
          ) : null}
        </div>
      </div>
      <form
        action={onSubmit}
        className="flex flex-col gap-2 sm:flex-row sm:items-end"
      >
        <label className="flex flex-col gap-1 text-[10px] uppercase tracking-wider text-zinc-400">
          Score
          <input
            name="score"
            type="number"
            step="0.1"
            defaultValue={existing?.score ?? ""}
            required
            className="w-24 rounded-md border border-white/10 bg-zinc-950 px-2 py-1.5 text-sm text-zinc-100 focus:border-zinc-400 focus:outline-none"
          />
        </label>
        <label className="flex flex-1 flex-col gap-1 text-[10px] uppercase tracking-wider text-zinc-400">
          Notes (optional)
          <input
            name="notes"
            defaultValue={existing?.notes ?? ""}
            className="rounded-md border border-white/10 bg-zinc-950 px-2 py-1.5 text-sm text-zinc-100 focus:border-zinc-400 focus:outline-none"
          />
        </label>
        <button
          type="submit"
          disabled={pending}
          className="rounded-md border border-cyan-300 bg-cyan-200 px-3 py-1.5 text-xs font-semibold text-cyan-950 transition hover:bg-cyan-100 disabled:opacity-50"
        >
          {pending ? "Saving…" : existing ? "Update" : "Save"}
        </button>
      </form>
      {state ? (
        <p
          className={`text-[11px] ${state.ok ? "text-emerald-300" : "text-rose-300"}`}
        >
          {state.message}
        </p>
      ) : null}
    </li>
  );
}
