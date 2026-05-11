"use client";

import { useCallback, useState } from "react";

import {
  supabaseHackathonFilterSql,
  supabaseSubmissionsForHackathonSql,
} from "@/lib/links";

const btnClass =
  "rounded-md border border-white/15 bg-white/[0.06] px-2 py-1 text-[10px] font-medium uppercase tracking-wider text-zinc-400 transition hover:border-white/25 hover:bg-white/10 hover:text-zinc-200";

type Props = {
  hackId: string;
};

export function CopySqlButtons({ hackId }: Props) {
  const [last, setLast] = useState<"hack" | "submissions" | null>(null);

  const copy = useCallback(
    async (kind: "hack" | "submissions") => {
      const text =
        kind === "hack"
          ? supabaseHackathonFilterSql(hackId)
          : supabaseSubmissionsForHackathonSql(hackId);
      try {
        await navigator.clipboard.writeText(text);
        setLast(kind);
        setTimeout(() => setLast(null), 2000);
      } catch {
        setLast(null);
      }
    },
    [hackId],
  );

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <button type="button" className={btnClass} onClick={() => copy("hack")}>
        {last === "hack" ? "Copied SQL" : "Copy · hack row SQL"}
      </button>
      <button
        type="button"
        className={btnClass}
        onClick={() => copy("submissions")}
      >
        {last === "submissions" ? "Copied SQL" : "Copy · submissions SQL"}
      </button>
    </div>
  );
}
