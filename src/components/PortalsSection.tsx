"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import type { PublicHackSummary } from "@/lib/portals/public-summary";

type PortalKey = "credits" | "submit" | "judge";

type Tone = "amber" | "violet" | "cyan";

const TONE: Record<Tone, { ring: string; text: string; chip: string }> = {
  amber: {
    ring: "ring-amber-400/20 hover:ring-amber-300/40",
    text: "text-amber-100",
    chip: "text-amber-300/80",
  },
  violet: {
    ring: "ring-violet-400/20 hover:ring-violet-300/40",
    text: "text-violet-100",
    chip: "text-violet-300/80",
  },
  cyan: {
    ring: "ring-cyan-400/20 hover:ring-cyan-300/40",
    text: "text-cyan-100",
    chip: "text-cyan-300/80",
  },
};

function formatDateTime(iso: string | null): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString(undefined, {
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "—";
  }
}

function PortalCard({
  tone,
  title,
  caption,
  enabled,
  stat,
  onView,
  openHref,
}: {
  tone: Tone;
  title: string;
  caption: string;
  enabled: boolean;
  stat: string;
  onView: () => void;
  openHref: string;
}) {
  const t = TONE[tone];
  return (
    <div
      className={`group relative flex flex-col gap-3 rounded-xl bg-zinc-900/40 p-5 ring-1 ring-inset transition ${t.ring}`}
    >
      <div className="flex items-center justify-between">
        <span
          className={`text-[10px] font-semibold uppercase tracking-[0.2em] ${enabled ? t.chip : "text-zinc-500"}`}
        >
          {enabled ? "Open" : "Closed"}
        </span>
        <span className="rounded-full bg-zinc-800/80 px-2 py-0.5 font-mono text-[11px] text-zinc-300">
          {stat}
        </span>
      </div>
      <div className="flex flex-col gap-1">
        <span className={`text-lg font-semibold ${t.text}`}>{title}</span>
        <span className="text-xs text-zinc-500">{caption}</span>
      </div>
      <div className="mt-1 flex items-center gap-2">
        <button
          type="button"
          onClick={onView}
          className="rounded-md border border-white/10 bg-zinc-950/40 px-2.5 py-1 text-[11px] text-zinc-300 hover:border-white/20 hover:text-zinc-100"
        >
          View details →
        </button>
        {enabled ? (
          <Link
            href={openHref}
            className={`rounded-md border border-white/10 px-2.5 py-1 text-[11px] ${t.text} hover:border-white/30`}
          >
            Open portal
          </Link>
        ) : null}
      </div>
    </div>
  );
}

function Modal({
  title,
  subtitle,
  onClose,
  children,
}: {
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-0 backdrop-blur sm:items-center sm:p-6"
      onClick={onClose}
    >
      <div
        className="flex max-h-[90vh] w-full max-w-2xl flex-col rounded-t-2xl border border-white/10 bg-zinc-950 shadow-xl sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 border-b border-white/5 px-5 py-4">
          <div className="flex flex-col">
            <h2 className="text-base font-semibold text-zinc-100">{title}</h2>
            {subtitle ? (
              <p className="text-xs text-zinc-500">{subtitle}</p>
            ) : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-white/10 px-2 py-0.5 text-xs text-zinc-400 hover:border-white/20 hover:text-zinc-200"
            aria-label="Close"
          >
            Esc
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-4">{children}</div>
      </div>
    </div>
  );
}

function CreditsBody({ data }: { data: PublicHackSummary["credits"] }) {
  if (data.allocated === 0) {
    return (
      <p className="text-sm text-zinc-500">
        No credits have been allocated for this hackathon yet.
      </p>
    );
  }
  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-3 gap-2 text-center">
        <Stat label="Allocated" value={String(data.allocated)} />
        <Stat label="Claimed" value={String(data.claimed)} />
        <Stat
          label="Outstanding"
          value={String(data.unclaimed)}
          tone={data.unclaimed > 0 ? "warn" : "default"}
        />
      </div>
      {data.totalUsd ? (
        <p className="text-[11px] text-zinc-500">
          Total face value · ${data.totalUsd.toLocaleString()}
        </p>
      ) : null}
      <div className="overflow-hidden rounded-lg border border-white/5">
        <table className="min-w-full divide-y divide-white/5 text-sm">
          <thead className="bg-zinc-900/60 text-left text-[10px] uppercase tracking-wider text-zinc-500">
            <tr>
              <th className="px-3 py-2">Recipient</th>
              <th className="px-3 py-2">Email</th>
              <th className="px-3 py-2 text-right">Amount</th>
              <th className="px-3 py-2 text-right">Claimed</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {data.rows.map((r, i) => (
              <tr key={`${r.emailMasked}-${i}`} className="hover:bg-zinc-900/40">
                <td className="px-3 py-2 text-zinc-200">{r.name}</td>
                <td className="px-3 py-2 font-mono text-[11px] text-zinc-500">
                  {r.emailMasked}
                </td>
                <td className="px-3 py-2 text-right font-mono text-zinc-300">
                  {r.amountUsd ? `$${r.amountUsd}` : "—"}
                </td>
                <td className="px-3 py-2 text-right text-[11px] text-zinc-400">
                  {r.claimedAt ? (
                    <span className="text-emerald-300">
                      {formatDateTime(r.claimedAt)}
                    </span>
                  ) : (
                    <span className="text-zinc-600">unclaimed</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function SubmissionsBody({ data }: { data: PublicHackSummary["submissions"] }) {
  if (data.count === 0) {
    return (
      <p className="text-sm text-zinc-500">No submissions yet.</p>
    );
  }
  const sorted = [...data.rows].sort((a, b) => (b.avg ?? -1) - (a.avg ?? -1));
  return (
    <ul className="flex flex-col gap-2">
      {sorted.map((s) => (
        <li
          key={s.id}
          className="flex flex-col gap-1.5 rounded-lg border border-white/5 bg-zinc-900/40 p-3"
        >
          <div className="flex items-baseline justify-between gap-3">
            <span className="text-sm font-medium text-zinc-100">{s.title}</span>
            <span className="rounded-full bg-zinc-800/80 px-2 py-0.5 font-mono text-[11px] text-zinc-300">
              {s.avg !== null ? s.avg.toFixed(1) : "—"}
            </span>
          </div>
          <p className="text-[11px] text-zinc-500">
            {s.teamName ?? "Unknown team"}
            {s.submitterMasked ? ` · ${s.submitterMasked}` : ""}
            {" · "}
            {s.numScores} {s.numScores === 1 ? "score" : "scores"}
          </p>
          {s.repoUrl ? (
            <a
              href={s.repoUrl}
              target="_blank"
              rel="noreferrer"
              className="truncate text-[11px] text-zinc-400 underline hover:text-zinc-200"
            >
              {s.repoUrl}
            </a>
          ) : null}
        </li>
      ))}
    </ul>
  );
}

function JudgeBody({ data }: { data: PublicHackSummary["judges"] }) {
  if (data.scoreCount === 0) {
    return (
      <p className="text-sm text-zinc-500">
        No judge scores recorded yet · {data.judgeCount} authorized judge
        {data.judgeCount === 1 ? "" : "s"}.
      </p>
    );
  }
  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-2 gap-2 text-center">
        <Stat label="Authorized judges" value={String(data.judgeCount)} />
        <Stat label="Scores recorded" value={String(data.scoreCount)} />
      </div>
      <ul className="flex flex-col gap-3">
        {data.rows.map((row) => (
          <li
            key={row.submissionId}
            className="rounded-lg border border-white/5 bg-zinc-900/40 p-3"
          >
            <div className="flex items-baseline justify-between gap-3">
              <span className="text-sm font-medium text-zinc-100">
                {row.submissionTitle}
              </span>
              <span className="rounded-full bg-zinc-800/80 px-2 py-0.5 font-mono text-[11px] text-zinc-300">
                {row.avg !== null ? row.avg.toFixed(1) : "—"}
              </span>
            </div>
            <p className="text-[11px] text-zinc-500">
              {row.teamName ?? "Unknown team"} · {row.numScores}{" "}
              {row.numScores === 1 ? "score" : "scores"}
            </p>
            {row.scores.length > 0 ? (
              <ul className="mt-2 flex flex-col divide-y divide-white/5 rounded-md border border-white/5 text-[11px]">
                {row.scores.map((sc, i) => (
                  <li
                    key={`${row.submissionId}-${i}`}
                    className="flex items-center justify-between px-2 py-1.5"
                  >
                    <span className="font-mono text-zinc-500">
                      {sc.judgeMasked}
                    </span>
                    <span className="flex items-center gap-2">
                      {sc.notes ? (
                        <span
                          className="max-w-[18rem] truncate text-zinc-400"
                          title={sc.notes}
                        >
                          {sc.notes}
                        </span>
                      ) : null}
                      <span className="font-mono text-zinc-200">
                        {sc.score.toFixed(1)}
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  );
}

function Stat({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: string;
  tone?: "default" | "warn";
}) {
  const v =
    tone === "warn"
      ? "text-amber-200"
      : "text-zinc-100";
  return (
    <div className="rounded-lg border border-white/5 bg-zinc-900/40 px-3 py-2">
      <div className="text-[10px] uppercase tracking-wider text-zinc-500">
        {label}
      </div>
      <div className={`text-base font-semibold ${v}`}>{value}</div>
    </div>
  );
}

export function PortalsSection({
  hackathonId,
  config,
  summary,
}: {
  hackathonId: string;
  config: {
    credits_enabled: boolean;
    submissions_enabled: boolean;
    judging_enabled: boolean;
  };
  summary: PublicHackSummary;
}) {
  const [open, setOpen] = useState<PortalKey | null>(null);

  const creditStat = `${summary.credits.claimed}/${summary.credits.allocated} claimed`;
  const submitStat = `${summary.submissions.count} submitted`;
  const judgeStat = `${summary.judges.scoreCount} scores`;

  return (
    <>
      <section className="grid gap-4 sm:grid-cols-3">
        <PortalCard
          tone="amber"
          title="Credits"
          caption="Find yourself by first name and confirm your email to claim your credit."
          enabled={config.credits_enabled}
          stat={creditStat}
          onView={() => setOpen("credits")}
          openHref={`/app/${hackathonId}/credits`}
        />
        <PortalCard
          tone="violet"
          title="Submit"
          caption="Drop your project. Tagged to this hackathon automatically."
          enabled={config.submissions_enabled}
          stat={submitStat}
          onView={() => setOpen("submit")}
          openHref={`/app/${hackathonId}/submit`}
        />
        <PortalCard
          tone="cyan"
          title="Judge"
          caption="Judges score every submission against this hack's rubric."
          enabled={config.judging_enabled}
          stat={judgeStat}
          onView={() => setOpen("judge")}
          openHref={`/app/${hackathonId}/judge`}
        />
      </section>

      {open === "credits" ? (
        <Modal
          title="Credits · breakdown"
          subtitle={
            summary.credits.allocated > 0
              ? `${summary.credits.claimed}/${summary.credits.allocated} claimed${summary.credits.totalUsd ? ` · $${summary.credits.totalUsd.toLocaleString()} face value` : ""}`
              : undefined
          }
          onClose={() => setOpen(null)}
        >
          <CreditsBody data={summary.credits} />
        </Modal>
      ) : null}

      {open === "submit" ? (
        <Modal
          title="Submissions"
          subtitle={`${summary.submissions.count} project${summary.submissions.count === 1 ? "" : "s"}`}
          onClose={() => setOpen(null)}
        >
          <SubmissionsBody data={summary.submissions} />
        </Modal>
      ) : null}

      {open === "judge" ? (
        <Modal
          title="Judge scores"
          subtitle={`${summary.judges.scoreCount} score${summary.judges.scoreCount === 1 ? "" : "s"} from ${summary.judges.judgeCount} judge${summary.judges.judgeCount === 1 ? "" : "s"}`}
          onClose={() => setOpen(null)}
        >
          <JudgeBody data={summary.judges} />
        </Modal>
      ) : null}
    </>
  );
}
