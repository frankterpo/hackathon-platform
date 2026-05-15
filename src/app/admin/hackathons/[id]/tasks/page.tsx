import Link from "next/link";
import { notFound } from "next/navigation";

import { HackathonTasksClient } from "@/components/HackathonTasksClient";
import {
  hasServiceRoleKey,
  loadAgentRunsForHackathon,
  loadHackathonById,
  loadHackathonTasks,
} from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type PageProps = { params: Promise<{ id: string }> };

export default async function HackathonTasksAdminPage({ params }: PageProps) {
  const { id } = await params;
  const { hackathon, error: hackathonError } = await loadHackathonById(id);
  if (!hackathon) {
    notFound();
  }

  const { tasks, error: tasksError } = await loadHackathonTasks(id);
  const { runs: agentRuns, error: agentRunsError } =
    await loadAgentRunsForHackathon(id);
  const canMutate = hasServiceRoleKey();
  const loadError =
    [hackathonError, tasksError].filter(Boolean).join(" — ") || null;

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-4 py-8 sm:px-6 sm:py-10 lg:px-8">
      <nav aria-label="Breadcrumb" className="mb-6">
        <ol className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] font-medium uppercase tracking-wider text-zinc-500">
          <li>
            <Link
              href="/app/master"
              className="text-zinc-500 underline-offset-4 transition hover:text-zinc-300 hover:underline"
            >
              Master app
            </Link>
          </li>
          <li aria-hidden="true" className="text-zinc-700">
            /
          </li>
          <li
            className="max-w-[min(100%,14rem)] truncate text-zinc-400"
            title={hackathon.name}
          >
            {hackathon.name}
          </li>
          <li aria-hidden="true" className="text-zinc-700">
            /
          </li>
          <li className="text-zinc-300" aria-current="page">
            Tasks
          </li>
        </ol>
      </nav>

      <header className="mb-8 space-y-2">
        <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-zinc-500">
          Admin · operational tasks
        </p>
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-50 sm:text-3xl">
          {hackathon.name}
        </h1>
        <p className="max-w-xl text-sm leading-relaxed text-zinc-500">
          Checklist items in{" "}
          <code className="rounded bg-black/40 px-1 font-mono text-xs">
            public.hackathon_tasks
          </code>{" "}
          (no auto-email or agent runners in V1). Use the breadcrumb to return
          to the Kanban.
        </p>
      </header>

      <HackathonTasksClient
        hackathonId={hackathon.id}
        hackathonName={hackathon.name}
        tasks={tasks}
        canMutate={canMutate}
        loadError={loadError}
        agentRuns={agentRuns}
        agentRunsError={agentRunsError}
      />
    </div>
  );
}
