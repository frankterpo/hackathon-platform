"use client";

import { useState, useTransition } from "react";

import {
  submitProjectAction,
  type SubmitState,
} from "@/app/app/[hack_id]/submit/actions";

type Props = { hackathonId: string };

export function SubmitClient({ hackathonId }: Props) {
  const [pending, startTransition] = useTransition();
  const [state, setState] = useState<SubmitState | null>(null);

  function onSubmit(formData: FormData) {
    setState(null);
    startTransition(async () => {
      const res = await submitProjectAction(hackathonId, formData);
      setState(res);
    });
  }

  return (
    <form
      action={onSubmit}
      className="flex flex-col gap-3 rounded-xl border border-white/10 bg-zinc-900/50 p-5"
    >
      <Field label="Project title" name="title" required />
      <Field label="Team name (optional)" name="teamName" />
      <Field
        label="Repo / demo URL"
        name="repoUrl"
        type="url"
        required
        placeholder="https://github.com/..."
      />
      <label className="flex flex-col gap-1 text-xs uppercase tracking-wider text-zinc-400">
        Description (optional)
        <textarea
          name="body"
          rows={5}
          className="rounded-md border border-white/10 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-zinc-400 focus:outline-none"
        />
      </label>
      <button
        type="submit"
        disabled={pending}
        className="self-start rounded-md border border-violet-300 bg-violet-200 px-4 py-2 text-sm font-semibold text-violet-950 transition hover:bg-violet-100 disabled:opacity-50"
      >
        {pending ? "Submitting…" : "Submit project"}
      </button>
      {state ? (
        <p
          className={`text-xs ${state.ok ? "text-emerald-300" : "text-rose-300"}`}
        >
          {state.message}
        </p>
      ) : null}
    </form>
  );
}

function Field({
  label,
  name,
  required = false,
  type = "text",
  placeholder,
}: {
  label: string;
  name: string;
  required?: boolean;
  type?: string;
  placeholder?: string;
}) {
  return (
    <label className="flex flex-col gap-1 text-xs uppercase tracking-wider text-zinc-400">
      {label}
      <input
        type={type}
        name={name}
        required={required}
        placeholder={placeholder}
        className="rounded-md border border-white/10 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-zinc-400 focus:outline-none"
      />
    </label>
  );
}
