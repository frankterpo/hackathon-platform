"use client";

import { useActionState } from "react";

import {
  adminLoginAction,
  type AdminLoginState,
} from "@/app/app/master/login/actions";

const initial: AdminLoginState = { ok: false, message: "" };

export function LoginForm({
  next,
  disabled = false,
}: {
  next: string;
  disabled?: boolean;
}) {
  const [state, formAction, pending] = useActionState(
    adminLoginAction,
    initial,
  );

  return (
    <form
      action={formAction}
      className="flex flex-col gap-3 rounded-xl border border-white/10 bg-zinc-900/50 p-5"
    >
      <input type="hidden" name="next" value={next} />
      <label className="flex flex-col gap-1 text-xs uppercase tracking-wider text-zinc-400">
        Password
        <input
          type="password"
          name="password"
          autoComplete="current-password"
          required
          disabled={disabled}
          className="rounded-md border border-white/10 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-zinc-400 focus:outline-none disabled:opacity-50"
        />
      </label>
      <button
        type="submit"
        disabled={disabled || pending}
        className="rounded-md border border-zinc-300 bg-zinc-100 px-3 py-2 text-sm font-medium text-zinc-900 transition hover:bg-white disabled:opacity-50"
      >
        {pending ? "Checking…" : "Sign in"}
      </button>
      {state.message ? (
        <p className={state.ok ? "text-xs text-emerald-300" : "text-xs text-rose-300"}>
          {state.message}
        </p>
      ) : null}
    </form>
  );
}
