"use client";

import { useRouter } from "next/navigation";
import { useCallback, useMemo, useState } from "react";

import {
  createHackathonTaskAction,
  deleteHackathonTaskAction,
  moveHackathonTaskAction,
  seedDefaultHackathonTasksAction,
  updateHackathonTaskAction,
} from "@/app/admin/hackathon-task-actions";
import {
  HACKATHON_TASK_STATUS_OPTIONS,
  HACKATHON_TASK_TYPE_OPTIONS,
} from "@/lib/hackathon-task-metadata";
import type {
  AgentRunRow,
  AgentRunState,
  HackathonTaskRow,
} from "@/types/database";

const inputClass =
  "mt-1 w-full min-h-10 rounded-lg border border-white/10 bg-[#141414] px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-cyan-500/40 focus:outline-none focus:ring-2 focus:ring-cyan-500/35 focus-visible:outline-none";

const btnClass =
  "inline-flex min-h-10 min-w-[2.75rem] items-center justify-center rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs font-medium text-zinc-200 transition hover:border-white/20 hover:bg-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-500/55 disabled:pointer-events-none disabled:opacity-40";

const dangerBtnClass =
  "inline-flex min-h-10 min-w-[2.75rem] items-center justify-center rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs font-medium text-red-200/95 transition hover:border-red-400/40 hover:bg-red-500/15 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-400/50 disabled:pointer-events-none disabled:opacity-40";

function dueLocalValue(iso: string | null): string {
  if (!iso) {
    return "";
  }
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) {
    return "";
  }
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function dueToIso(local: string): string | null {
  const t = local.trim();
  if (!t) {
    return null;
  }
  const ms = new Date(t).getTime();
  if (Number.isNaN(ms)) {
    return null;
  }
  return new Date(ms).toISOString();
}

function agentRunStateLabel(state: AgentRunState): string {
  switch (state) {
    case "draft":
      return "Draft";
    case "awaiting_approval":
      return "Awaiting approval";
    case "approved":
      return "Approved";
    case "rejected":
      return "Rejected";
    default: {
      const _x: never = state;
      return _x;
    }
  }
}

function formatRunTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) {
    return "—";
  }
  return d.toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

type Props = {
  hackathonId: string;
  hackathonName: string;
  tasks: HackathonTaskRow[];
  canMutate: boolean;
  loadError: string | null;
  agentRuns?: AgentRunRow[];
  agentRunsError?: string | null;
};

export function HackathonTasksClient({
  hackathonId,
  hackathonName,
  tasks: initialTasks,
  canMutate,
  loadError,
  agentRuns = [],
  agentRunsError = null,
}: Props) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [banner, setBanner] = useState<string | null>(loadError);
  const [titleErrors, setTitleErrors] = useState<Record<string, string>>({});
  const [newTaskTitleError, setNewTaskTitleError] = useState<string | null>(
    null,
  );

  const run = useCallback(
    async (fn: () => Promise<{ ok: boolean; error: string | null }>) => {
      setPending(true);
      setBanner(null);
      const res = await fn();
      setPending(false);
      if (!res.ok) {
        setBanner(res.error ?? "Something went wrong.");
      } else {
        setTitleErrors({});
        setNewTaskTitleError(null);
        router.refresh();
      }
    },
    [router],
  );

  const showEmptyChecklist = initialTasks.length === 0 && !loadError;

  const agentSection = useMemo(() => {
    if (agentRuns.length > 0) {
      return (
        <ul className="mt-3 max-h-48 space-y-2 overflow-y-auto text-xs text-zinc-400">
          {agentRuns.map((r) => (
            <li
              key={r.id}
              className="rounded-lg border border-white/[0.06] bg-black/25 px-3 py-2"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-medium text-zinc-300">
                  {r.intent.trim() || "(no intent label)"}
                </span>
                <span className="rounded-full border border-white/10 bg-white/[0.04] px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-zinc-400">
                  {agentRunStateLabel(r.state)}
                </span>
              </div>
              <p className="mt-1 line-clamp-2 text-zinc-500">
                {r.output_draft.trim() || "—"}
              </p>
              <p className="mt-1 text-[10px] text-zinc-600">
                {formatRunTime(r.created_at)}
              </p>
            </li>
          ))}
        </ul>
      );
    }
    return (
      <p className="mt-3 text-xs leading-relaxed text-zinc-500">
        When runners are wired, drafts and approvals for this hackathon will
        appear here. The <code className="rounded bg-black/40 px-1 font-mono">public.agent_runs</code>{" "}
        table is already in migrations — this UI stays read-only until then.
      </p>
    );
  }, [agentRuns]);

  return (
    <div
      className="flex flex-col gap-8"
      aria-busy={pending}
    >
      <div aria-live="polite" className="min-h-0">
        {banner ? (
          <p
            role="alert"
            className="rounded-lg border border-amber-500/35 bg-amber-500/10 px-3 py-2 text-sm text-amber-100/90"
          >
            {banner}
          </p>
        ) : null}
      </div>

      {!canMutate ? (
        <section
          className="rounded-xl border border-cyan-500/25 bg-cyan-950/20 px-4 py-3 text-sm text-cyan-100/90"
          aria-label="Service role required for edits"
        >
          <p className="font-medium text-cyan-50/95">
            Task edits are disabled: missing{" "}
            <code className="rounded bg-black/40 px-1 font-mono text-xs">
              SUPABASE_SERVICE_ROLE_KEY
            </code>
          </p>
          <p className="mt-2 text-xs leading-relaxed text-cyan-100/75">
            Reads still work (same as Kanban when the service role is absent).
            Add the service role secret to{" "}
            <code className="rounded bg-black/40 px-1 font-mono text-[11px]">
              .env.local
            </code>{" "}
            next to <code className="font-mono text-[11px]">package.json</code>
            , then <strong className="text-cyan-50">restart</strong>{" "}
            <code className="rounded bg-black/40 px-1 font-mono text-[11px]">
              npm run dev
            </code>{" "}
            so Next.js picks it up. Never expose this key in the browser bundle.
          </p>
        </section>
      ) : null}

      {pending ? (
        <p
          className="text-center text-xs font-medium text-zinc-500"
          role="status"
        >
          Saving…
        </p>
      ) : null}

      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
        <div>
          <h2 className="text-sm font-semibold text-zinc-100">Checklist</h2>
          <p className="mt-1 text-xs text-zinc-500">
            {initialTasks.length} task{initialTasks.length === 1 ? "" : "s"}{" "}
            for{" "}
            <span className="text-zinc-400">{hackathonName}</span>
          </p>
        </div>
        {canMutate ? (
          <button
            type="button"
            className={btnClass}
            disabled={pending}
            onClick={() =>
              run(() => seedDefaultHackathonTasksAction(hackathonId))
            }
          >
            Add default checklist (8)
          </button>
        ) : null}
      </div>

      {showEmptyChecklist ? (
        <div className="rounded-xl border border-dashed border-white/15 bg-[#101010] px-4 py-10 text-center sm:px-8">
          <p className="text-sm font-medium text-zinc-200">
            No checklist items yet
          </p>
          <p className="mx-auto mt-2 max-w-md text-xs leading-relaxed text-zinc-500">
            Add tasks one at a time below, or seed the default eight-item
            runbook if you have the service role configured.
          </p>
          {!canMutate ? (
            <p className="mx-auto mt-3 max-w-md text-xs text-zinc-600">
              With read-only credentials you can still review this page after
              tasks exist; seeding and edits need the service role.
            </p>
          ) : null}
        </div>
      ) : null}

      <ul className="flex flex-col gap-4">
        {initialTasks.map((task, index) => (
          <li
            key={task.id}
            className="rounded-xl border border-white/[0.08] bg-[#141414] p-4 shadow-[0_0_0_1px_rgba(255,255,255,0.04)]"
          >
            <form
              className="flex flex-col gap-3"
              onSubmit={(e) => {
                e.preventDefault();
                if (!canMutate) {
                  return;
                }
                const fd = new FormData(e.currentTarget);
                const title = String(fd.get("title") ?? "").trim();
                if (!title) {
                  setTitleErrors((prev) => ({
                    ...prev,
                    [task.id]: "Add a title before saving.",
                  }));
                  return;
                }
                setTitleErrors((prev) => {
                  const next = { ...prev };
                  delete next[task.id];
                  return next;
                });
                void run(() =>
                  updateHackathonTaskAction(hackathonId, task.id, {
                    title,
                    task_type: String(fd.get("task_type") ?? "other"),
                    status: String(fd.get("status") ?? "todo"),
                    notes: String(fd.get("notes") ?? ""),
                    due_at: dueToIso(String(fd.get("due_at") ?? "")),
                  }),
                );
              }}
            >
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <label
                    htmlFor={`title-${task.id}`}
                    className="text-xs font-medium text-zinc-400"
                  >
                    Title
                  </label>
                  <input
                    id={`title-${task.id}`}
                    name="title"
                    required
                    defaultValue={task.title}
                    disabled={!canMutate || pending}
                    aria-invalid={Boolean(titleErrors[task.id])}
                    aria-describedby={
                      titleErrors[task.id]
                        ? `title-err-${task.id}`
                        : undefined
                    }
                    className={inputClass}
                    onChange={() => {
                      if (titleErrors[task.id]) {
                        setTitleErrors((prev) => {
                          const next = { ...prev };
                          delete next[task.id];
                          return next;
                        });
                      }
                    }}
                  />
                  {titleErrors[task.id] ? (
                    <p
                      id={`title-err-${task.id}`}
                      className="mt-1 text-xs text-red-300/90"
                      role="alert"
                    >
                      {titleErrors[task.id]}
                    </p>
                  ) : null}
                </div>
                <div>
                  <label
                    htmlFor={`type-${task.id}`}
                    className="text-xs font-medium text-zinc-400"
                  >
                    Type
                  </label>
                  <select
                    id={`type-${task.id}`}
                    name="task_type"
                    defaultValue={task.task_type}
                    disabled={!canMutate || pending}
                    className={inputClass}
                  >
                    {HACKATHON_TASK_TYPE_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label
                    htmlFor={`status-${task.id}`}
                    className="text-xs font-medium text-zinc-400"
                  >
                    Status
                  </label>
                  <select
                    id={`status-${task.id}`}
                    name="status"
                    defaultValue={task.status}
                    disabled={!canMutate || pending}
                    className={inputClass}
                  >
                    {HACKATHON_TASK_STATUS_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="sm:col-span-2">
                  <label
                    htmlFor={`notes-${task.id}`}
                    className="text-xs font-medium text-zinc-400"
                  >
                    Notes
                  </label>
                  <textarea
                    id={`notes-${task.id}`}
                    name="notes"
                    rows={3}
                    defaultValue={task.notes ?? ""}
                    disabled={!canMutate || pending}
                    className={`${inputClass} min-h-[4.5rem]`}
                  />
                </div>
                <div className="sm:col-span-2">
                  <label
                    htmlFor={`due-${task.id}`}
                    className="text-xs font-medium text-zinc-400"
                  >
                    Due
                  </label>
                  <input
                    id={`due-${task.id}`}
                    name="due_at"
                    type="datetime-local"
                    defaultValue={dueLocalValue(task.due_at)}
                    disabled={!canMutate || pending}
                    className={inputClass}
                  />
                </div>
              </div>
              <div className="flex flex-col gap-2 border-t border-white/[0.06] pt-3 sm:flex-row sm:flex-wrap">
                {canMutate ? (
                  <button type="submit" className={btnClass} disabled={pending}>
                    Save changes
                  </button>
                ) : null}
                {canMutate ? (
                  <button
                    type="button"
                    className={btnClass}
                    disabled={pending || index === 0}
                    aria-label={`Move task “${task.title}” up in the list`}
                    onClick={() =>
                      run(() =>
                        moveHackathonTaskAction(hackathonId, task.id, "up"),
                      )
                    }
                  >
                    Move up
                  </button>
                ) : null}
                {canMutate ? (
                  <button
                    type="button"
                    className={btnClass}
                    disabled={pending || index >= initialTasks.length - 1}
                    aria-label={`Move task “${task.title}” down in the list`}
                    onClick={() =>
                      run(() =>
                        moveHackathonTaskAction(hackathonId, task.id, "down"),
                      )
                    }
                  >
                    Move down
                  </button>
                ) : null}
                {canMutate ? (
                  <button
                    type="button"
                    className={dangerBtnClass}
                    disabled={pending}
                    aria-label={`Delete task “${task.title}”`}
                    onClick={() => {
                      if (
                        !confirm(
                          "Delete this task? This cannot be undone.",
                        )
                      ) {
                        return;
                      }
                      void run(() =>
                        deleteHackathonTaskAction(hackathonId, task.id),
                      );
                    }}
                  >
                    Delete
                  </button>
                ) : null}
              </div>
            </form>
          </li>
        ))}
      </ul>

      {canMutate ? (
        <section className="rounded-xl border border-white/[0.08] bg-[#101010] p-4">
          <h3 className="text-sm font-semibold text-zinc-100">New task</h3>
          <form
            className="mt-3 flex flex-col gap-3"
            onSubmit={(e) => {
              e.preventDefault();
              const fd = new FormData(e.currentTarget);
              const title = String(fd.get("title") ?? "").trim();
              if (!title) {
                setNewTaskTitleError("Title is required.");
                return;
              }
              setNewTaskTitleError(null);
              void run(() =>
                createHackathonTaskAction(hackathonId, {
                  title,
                  task_type: String(fd.get("task_type") ?? "other"),
                  status: String(fd.get("status") ?? "todo"),
                  notes: String(fd.get("notes") ?? ""),
                  due_at: dueToIso(String(fd.get("due_at") ?? "")),
                }),
              );
            }}
          >
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label
                  htmlFor="new-title"
                  className="text-xs font-medium text-zinc-400"
                >
                  Title <span className="text-red-400/90">*</span>
                </label>
                <input
                  id="new-title"
                  name="title"
                  required
                  disabled={pending}
                  aria-invalid={Boolean(newTaskTitleError)}
                  aria-describedby={
                    newTaskTitleError ? "new-title-err" : undefined
                  }
                  className={inputClass}
                  placeholder="e.g. Confirm AV vendor"
                  onChange={() => {
                    if (newTaskTitleError) {
                      setNewTaskTitleError(null);
                    }
                  }}
                />
                {newTaskTitleError ? (
                  <p
                    id="new-title-err"
                    className="mt-1 text-xs text-red-300/90"
                    role="alert"
                  >
                    {newTaskTitleError}
                  </p>
                ) : null}
              </div>
              <div>
                <label
                  htmlFor="new-type"
                  className="text-xs font-medium text-zinc-400"
                >
                  Type
                </label>
                <select
                  id="new-type"
                  name="task_type"
                  defaultValue="other"
                  disabled={pending}
                  className={inputClass}
                >
                  {HACKATHON_TASK_TYPE_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label
                  htmlFor="new-status"
                  className="text-xs font-medium text-zinc-400"
                >
                  Status
                </label>
                <select
                  id="new-status"
                  name="status"
                  defaultValue="todo"
                  disabled={pending}
                  className={inputClass}
                >
                  {HACKATHON_TASK_STATUS_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="sm:col-span-2">
                <label
                  htmlFor="new-notes"
                  className="text-xs font-medium text-zinc-400"
                >
                  Notes
                </label>
                <textarea
                  id="new-notes"
                  name="notes"
                  rows={3}
                  disabled={pending}
                  className={`${inputClass} min-h-[4.5rem]`}
                />
              </div>
              <div className="sm:col-span-2">
                <label
                  htmlFor="new-due"
                  className="text-xs font-medium text-zinc-400"
                >
                  Due
                </label>
                <input
                  id="new-due"
                  name="due_at"
                  type="datetime-local"
                  disabled={pending}
                  className={inputClass}
                />
              </div>
            </div>
            <button type="submit" className={btnClass} disabled={pending}>
              Add task
            </button>
          </form>
        </section>
      ) : null}

      <section
        className="rounded-xl border border-white/[0.06] bg-[#0c0c0c] p-4"
        aria-labelledby="agent-runs-heading"
      >
        <h3
          id="agent-runs-heading"
          className="text-sm font-semibold text-zinc-200"
        >
          Agent runs{" "}
          <span className="font-normal text-zinc-500">(coming soon)</span>
        </h3>
        {agentRunsError ? (
          <p
            className="mt-2 rounded-lg border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-xs text-amber-100/85"
            role="status"
          >
            Could not load <code className="font-mono">agent_runs</code>:{" "}
            <span className="font-mono text-[11px]">{agentRunsError}</span>. If
            migrations are not applied yet, this table may not exist.
          </p>
        ) : null}
        {agentSection}
      </section>
    </div>
  );
}
