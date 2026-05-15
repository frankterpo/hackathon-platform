"use client";

import { useState, useTransition } from "react";

import { sendMagicLinkAction } from "@/app/app/[hack_id]/_lib/magic-link";

type Props = {
  next: string;
  intro?: string;
};

export function MagicLinkForm({ next, intro }: Props) {
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [ok, setOk] = useState<boolean | null>(null);

  function onSubmit(formData: FormData) {
    setMessage(null);
    setOk(null);
    formData.set("next", next);
    startTransition(async () => {
      const res = await sendMagicLinkAction(formData);
      setOk(res.ok);
      setMessage(res.message);
    });
  }

  return (
    <form
      action={onSubmit}
      className="flex flex-col gap-3 rounded-xl border border-white/10 bg-zinc-900/50 p-5"
    >
      {intro ? (
        <p className="text-sm text-zinc-300">{intro}</p>
      ) : (
        <p className="text-sm text-zinc-300">
          Enter the email you used to RSVP on Luma. We send a one-time magic
          link — no passwords.
        </p>
      )}
      <input
        type="email"
        name="email"
        required
        autoComplete="email"
        placeholder="you@example.com"
        className="rounded-md border border-white/10 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-zinc-400 focus:outline-none"
      />
      <button
        type="submit"
        disabled={pending}
        className="rounded-md border border-zinc-300 bg-zinc-100 px-3 py-2 text-sm font-medium text-zinc-900 transition hover:bg-white disabled:opacity-50"
      >
        {pending ? "Sending…" : "Send magic link"}
      </button>
      {message ? (
        <p
          className={`text-xs ${
            ok ? "text-emerald-300" : "text-rose-300"
          }`}
        >
          {message}
        </p>
      ) : null}
    </form>
  );
}
