import Link from "next/link";

import { CreateHackathonForm } from "@/components/CreateHackathonForm";
import { HackathonBoard } from "@/components/HackathonBoard";
import { loadHackathonsForBoard } from "@/lib/supabase/server";

/** Always read Supabase on the request — never bake an empty board at build time. */
export const dynamic = "force-dynamic";

export default async function MasterPanelAdminPage() {
  const {
    hackathons,
    queryError,
    usedDevMock,
    supabaseEnvReady,
    envDiagnostics,
  } = await loadHackathonsForBoard();
  const ref = process.env.NEXT_PUBLIC_SUPABASE_PROJECT_REF ?? null;

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col px-4 py-10 sm:px-6 lg:px-8">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-zinc-500 transition hover:text-zinc-300"
        >
          ← Home
        </Link>
      </div>
      <div className="mb-10">
        <CreateHackathonForm />
      </div>
      <HackathonBoard
        hackathons={hackathons}
        supabaseProjectRef={ref}
        setupRequired={!supabaseEnvReady}
        envDiagnostics={envDiagnostics}
        queryError={queryError}
        usedDevMock={usedDevMock}
        enableKanbanDrag
        eyebrow="Admin · master panel"
        title="Hackathon Kanban"
        description="Operational view of hackathons grouped by lifecycle. Rows come from Supabase `public.hackathons`; submissions and scores live in `public.submissions` and `public.judge_scores`."
      />
    </div>
  );
}
