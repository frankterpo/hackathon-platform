"use client";

import { useActionState, useEffect, useRef } from "react";

import {
  createHackathonAction,
  type CreateHackathonState,
} from "@/app/admin/actions";

function FieldLabel({
  htmlFor,
  children,
}: {
  htmlFor: string;
  children: React.ReactNode;
}) {
  return (
    <label htmlFor={htmlFor} className="text-xs font-medium text-zinc-400">
      {children}
    </label>
  );
}

const inputClass =
  "mt-1 w-full rounded-lg border border-white/10 bg-[#141414] px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-cyan-500/40 focus:outline-none focus:ring-1 focus:ring-cyan-500/30";

const createHackathonInitialState: CreateHackathonState = {
  error: null,
  ok: false,
};

export function CreateHackathonForm() {
  const [state, formAction, pending] = useActionState(
    createHackathonAction,
    createHackathonInitialState,
  );
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.ok && formRef.current) {
      formRef.current.reset();
    }
  }, [state.ok]);

  return (
    <details className="group rounded-2xl border border-white/[0.08] bg-[#101010] [&_summary::-webkit-details-marker]:hidden [&_summary]:cursor-pointer [&_summary]:list-none">
      <summary className="px-4 py-4 sm:px-5 sm:py-5">
        <span className="flex items-center gap-2">
          <span
            aria-hidden
            className="inline-block text-zinc-500 transition-transform duration-200 group-open:rotate-90"
          >
            ▸
          </span>
          <h2 className="text-sm font-semibold text-zinc-100">
            Create hackathon
          </h2>
        </span>
      </summary>
      <div className="border-t border-white/[0.06] px-4 pb-4 sm:px-5 sm:pb-5">
        <p className="max-w-2xl pt-3 text-xs leading-relaxed text-zinc-500 sm:pt-4">
          Inserts into{" "}
          <code className="rounded bg-black/40 px-1 font-mono text-[11px]">
            public.hackathons
          </code>{" "}
          using the server{" "}
          <code className="rounded bg-black/40 px-1 font-mono text-[11px]">
            ADMIN_SECRET
          </code>{" "}
          gate and{" "}
          <code className="rounded bg-black/40 px-1 font-mono text-[11px]">
            SUPABASE_SERVICE_ROLE_KEY
          </code>{" "}
          (see README).
        </p>

        <form
          ref={formRef}
          action={formAction}
          className="mt-4 flex flex-col gap-4"
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <FieldLabel htmlFor="hack-name">Name *</FieldLabel>
              <input
                id="hack-name"
                name="name"
                required
                autoComplete="off"
                className={inputClass}
                placeholder="Spring 2026 internal hack"
              />
            </div>
            <div>
              <FieldLabel htmlFor="hack-status">Status</FieldLabel>
              <select id="hack-status" name="status" className={inputClass}>
                <option value="scheduled">Scheduled</option>
                <option value="live">Live</option>
                <option value="completed">Done</option>
              </select>
            </div>
            <div>
              <FieldLabel htmlFor="hack-theme">Theme slug</FieldLabel>
              <input
                id="hack-theme"
                name="themeSlug"
                className={inputClass}
                placeholder="spring-26"
              />
            </div>
            <div>
              <FieldLabel htmlFor="hack-vercel">Vercel project slug</FieldLabel>
              <input
                id="hack-vercel"
                name="vercelSlug"
                className={inputClass}
                placeholder="my-hack-app"
              />
            </div>
            <div>
              <FieldLabel htmlFor="hack-luma">Luma event id</FieldLabel>
              <input
                id="hack-luma"
                name="lumaEventId"
                className={inputClass}
                placeholder="event handle from lu.ma URL"
              />
            </div>
            <div>
              <FieldLabel htmlFor="hack-firebase">Firebase project id</FieldLabel>
              <input
                id="hack-firebase"
                name="firebaseProjectId"
                className={inputClass}
                placeholder="my-firebase-project"
              />
            </div>
            <div>
              <FieldLabel htmlFor="hack-start">Start date</FieldLabel>
              <input
                id="hack-start"
                name="startDate"
                type="date"
                className={inputClass}
              />
            </div>
            <div>
              <FieldLabel htmlFor="hack-end">End date</FieldLabel>
              <input
                id="hack-end"
                name="endDate"
                type="date"
                className={inputClass}
              />
            </div>
            <div className="sm:col-span-2">
              <FieldLabel htmlFor="admin-secret">Admin secret *</FieldLabel>
              <input
                id="admin-secret"
                name="adminSecret"
                type="password"
                required
                autoComplete="off"
                className={inputClass}
                placeholder="Value of ADMIN_SECRET from .env.local"
              />
            </div>
          </div>

          {state.error ? (
            <p className="rounded-lg border border-red-500/35 bg-red-500/10 px-3 py-2 text-xs text-red-100/95">
              {state.error}
            </p>
          ) : null}
          {state.ok ? (
            <p className="rounded-lg border border-emerald-500/35 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-100/95">
              Saved. Refresh the dashboard or Master overview to see the new
              hackathon.
            </p>
          ) : null}

          <button
            type="submit"
            disabled={pending}
            className="inline-flex w-fit items-center justify-center rounded-lg border border-cyan-500/40 bg-cyan-500/15 px-4 py-2 text-xs font-semibold uppercase tracking-wider text-cyan-100 transition hover:border-cyan-400/60 hover:bg-cyan-500/25 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {pending ? "Saving…" : "Create hackathon"}
          </button>
        </form>
      </div>
    </details>
  );
}
