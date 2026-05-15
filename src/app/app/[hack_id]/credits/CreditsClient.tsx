"use client";

import { useState, useTransition } from "react";

import {
  claimCreditByEmailAction,
  searchAttendeesByNameAction,
  type AttendeeMatch,
  type ClaimByEmailState,
  type SearchAttendeesState,
} from "@/app/app/[hack_id]/credits/actions";

type Step = "find-name" | "confirm-email" | "claimed";

type Props = {
  hackathonId: string;
  hackathonName: string;
};

export function CreditsClient({ hackathonId, hackathonName }: Props) {
  const [step, setStep] = useState<Step>("find-name");
  const [pendingSearch, startSearch] = useTransition();
  const [pendingClaim, startClaim] = useTransition();

  const [search, setSearch] = useState<SearchAttendeesState | null>(null);
  const [picked, setPicked] = useState<AttendeeMatch | null>(null);
  const [claim, setClaim] = useState<ClaimByEmailState | null>(null);

  function onSearch(formData: FormData) {
    setSearch(null);
    startSearch(async () => {
      const res = await searchAttendeesByNameAction(hackathonId, formData);
      setSearch(res);
    });
  }

  function onPick(match: AttendeeMatch) {
    setPicked(match);
    setStep("confirm-email");
    setClaim(null);
  }

  function onClaim(formData: FormData) {
    setClaim(null);
    startClaim(async () => {
      const res = await claimCreditByEmailAction(hackathonId, formData);
      setClaim(res);
      if (res.ok) setStep("claimed");
    });
  }

  if (step === "claimed" && claim?.ok) {
    return (
      <div className="rounded-xl border border-emerald-400/30 bg-emerald-400/5 p-5">
        <p className="text-xs uppercase tracking-[0.2em] text-emerald-300">
          {claim.alreadyClaimed ? "Previously claimed" : "Credit claimed"}
        </p>
        {claim.link ? (
          <a
            href={claim.link}
            target="_blank"
            rel="noreferrer"
            className="mt-2 block break-all text-sm text-emerald-100 underline decoration-emerald-300/40 underline-offset-4 hover:decoration-emerald-300"
          >
            {claim.link}
          </a>
        ) : null}
        {claim.code ? (
          <p className="mt-2 break-all font-mono text-sm text-emerald-100">
            {claim.code}
          </p>
        ) : null}
        <p className="mt-3 text-xs text-emerald-200/70">{claim.message}</p>
      </div>
    );
  }

  if (step === "confirm-email" && picked) {
    return (
      <form
        action={onClaim}
        className="flex flex-col gap-3 rounded-xl border border-white/10 bg-zinc-900/50 p-5"
      >
        <p className="text-sm text-zinc-300">
          Hi <span className="font-semibold text-zinc-100">{picked.display_name}</span>.
          Confirm by entering your email — we&apos;ll match it against the hackathon
          attendee list.
        </p>
        <p className="text-[11px] text-zinc-500">
          Hint: <span className="font-mono">{picked.email_hint}</span>
        </p>
        <input
          type="email"
          name="email"
          required
          autoComplete="email"
          placeholder="you@example.com"
          className="rounded-md border border-white/10 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-zinc-400 focus:outline-none"
        />
        <div className="flex items-center gap-2">
          <button
            type="submit"
            disabled={pendingClaim}
            className="rounded-md border border-amber-300 bg-amber-200 px-3 py-2 text-sm font-semibold text-amber-950 transition hover:bg-amber-100 disabled:opacity-50"
          >
            {pendingClaim ? "Claiming…" : "Claim my credit"}
          </button>
          <button
            type="button"
            onClick={() => {
              setPicked(null);
              setStep("find-name");
            }}
            className="rounded-md border border-white/10 px-3 py-2 text-xs text-zinc-300 hover:border-white/20"
          >
            ← back
          </button>
        </div>
        {claim && !claim.ok ? (
          <p className="text-xs text-rose-300">{claim.message}</p>
        ) : null}
      </form>
    );
  }

  return (
    <form
      action={onSearch}
      className="flex flex-col gap-3 rounded-xl border border-white/10 bg-zinc-900/50 p-5"
    >
      <p className="text-sm text-zinc-300">
        Type your <span className="font-semibold">first name</span> to find
        yourself on the {hackathonName} attendee list.
      </p>
      <input
        type="text"
        name="query"
        required
        autoComplete="given-name"
        placeholder="e.g. Francisco"
        minLength={2}
        className="rounded-md border border-white/10 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-zinc-400 focus:outline-none"
      />
      <button
        type="submit"
        disabled={pendingSearch}
        className="self-start rounded-md border border-zinc-300 bg-zinc-100 px-3 py-2 text-sm font-medium text-zinc-900 transition hover:bg-white disabled:opacity-50"
      >
        {pendingSearch ? "Searching…" : "Find me"}
      </button>

      {search?.matches.length ? (
        <ul className="flex flex-col divide-y divide-white/5 rounded-lg border border-white/5 bg-zinc-950/40">
          {search.matches.map((m, idx) => (
            <li key={`${m.display_name}-${idx}`}>
              <button
                type="button"
                onClick={() => onPick(m)}
                className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm text-zinc-200 hover:bg-zinc-800/40"
              >
                <span>{m.display_name}</span>
                <span className="font-mono text-[11px] text-zinc-500">
                  {m.email_hint}
                </span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      {search && !search.matches.length && search.message ? (
        <p
          className={`text-xs ${search.ok ? "text-zinc-400" : "text-rose-300"}`}
        >
          {search.message}
        </p>
      ) : null}
    </form>
  );
}
