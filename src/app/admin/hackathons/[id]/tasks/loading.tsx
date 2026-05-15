export default function HackathonTasksLoading() {
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-4 py-10 sm:px-6 lg:px-8">
      <div className="mb-8 animate-pulse space-y-3">
        <div className="h-3 w-40 rounded bg-zinc-800" />
        <div className="h-8 w-2/3 max-w-md rounded bg-zinc-800" />
        <div className="h-4 w-full max-w-xl rounded bg-zinc-800/80" />
      </div>
      <div className="space-y-4">
        <div className="h-10 w-full rounded-xl border border-white/[0.06] bg-zinc-900/40" />
        <div className="h-48 w-full rounded-xl border border-white/[0.06] bg-zinc-900/40" />
        <div className="h-48 w-full rounded-xl border border-white/[0.06] bg-zinc-900/40" />
      </div>
    </div>
  );
}
