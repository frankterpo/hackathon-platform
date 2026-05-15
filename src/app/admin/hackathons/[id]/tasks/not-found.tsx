import Link from "next/link";

export default function HackathonTasksNotFound() {
  return (
    <div className="mx-auto flex w-full max-w-lg flex-1 flex-col items-center justify-center px-4 py-16 text-center">
      <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-zinc-500">
        Admin · operational tasks
      </p>
      <h1 className="mt-3 text-xl font-semibold text-zinc-100">Hackathon not found</h1>
      <p className="mt-2 text-sm text-zinc-500">
        This id is missing or you do not have access. Return to the master app to pick a
        hackathon.
      </p>
      <Link
        href="/app/master"
        className="mt-8 inline-flex items-center justify-center rounded-lg border border-cyan-500/35 bg-cyan-500/10 px-4 py-2.5 text-sm font-medium text-cyan-100 transition hover:border-cyan-400/45 hover:bg-cyan-500/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500/40 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0a0a0a]"
      >
        ← Back to master app
      </Link>
    </div>
  );
}
