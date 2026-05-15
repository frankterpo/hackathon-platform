import Link from "next/link";

import { HackathonBoard } from "@/components/HackathonBoard";
import { loadHackathonsForBoard } from "@/lib/supabase/server";

/** Always read Supabase on the request — never bake an empty board at build time. */
export const dynamic = "force-dynamic";

export default async function Home() {
  // Full `hackathons` rows — no `hideHackathonFromMasterOverview` / no Firebase gate (see master page).
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
      <div className="mb-6 flex justify-end">
        <Link
          href="/app/master"
          className="rounded-lg border border-white/10 px-3 py-1.5 text-xs font-medium uppercase tracking-wider text-zinc-400 transition hover:border-white/20 hover:text-zinc-200"
        >
          Master app
        </Link>
      </div>
      <HackathonBoard
        hackathons={hackathons}
        supabaseProjectRef={ref}
        setupRequired={!supabaseEnvReady}
        envDiagnostics={envDiagnostics}
        queryError={queryError}
        usedDevMock={usedDevMock}
      />
    </div>
  );
}
