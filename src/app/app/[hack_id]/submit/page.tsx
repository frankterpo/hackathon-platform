import Link from "next/link";
import { notFound } from "next/navigation";

import { MagicLinkForm } from "@/components/MagicLinkForm";
import { requireHackathon } from "@/lib/portals/access";
import { gateSubmit, gateMessage } from "@/lib/portals/portal-checks";
import { getAuthUser } from "@/lib/supabase/auth";
import { createServerSupabaseClient } from "@/lib/supabase/server";

import { SubmitClient } from "./SubmitClient";

export const dynamic = "force-dynamic";

type Params = { hack_id: string };

type ExistingSubmission = {
  id: string;
  title: string;
  team_name: string | null;
  repo_url: string | null;
  created_at: string;
};

export default async function SubmitPortalPage({
  params,
}: {
  params: Promise<Params>;
}) {
  const { hack_id } = await params;
  const { hackathon, error } = await requireHackathon(hack_id);
  if (error) {
    return (
      <div className="rounded-lg border border-rose-500/40 bg-rose-500/5 p-4 text-sm text-rose-200">
        {error}
      </div>
    );
  }
  if (!hackathon) notFound();

  const gate = await gateSubmit(hackathon.id);
  if (!gate.ok) {
    return (
      <Shell hackathon={hackathon}>
        <div className="rounded-xl border border-violet-400/30 bg-violet-400/5 p-5 text-sm text-violet-200">
          {gateMessage(gate.reason)}
        </div>
      </Shell>
    );
  }

  const next = `/app/${hackathon.id}/submit`;
  const { email } = await getAuthUser();

  if (!email) {
    return (
      <Shell hackathon={hackathon}>
        <MagicLinkForm
          next={next}
          intro="Sign in with your email to submit a project. The submission gets tagged to this hackathon automatically."
        />
      </Shell>
    );
  }

  let existing: ExistingSubmission[] = [];
  const supabase = createServerSupabaseClient();
  if (supabase) {
    const { data } = await supabase
      .from("submissions")
      .select("id,title,team_name,repo_url,created_at")
      .eq("hackathon_id", hackathon.id)
      .eq("submitter_email", email)
      .order("created_at", { ascending: false })
      .limit(5);
    existing = (data as ExistingSubmission[]) ?? [];
  }

  return (
    <Shell hackathon={hackathon}>
      <p className="text-sm text-zinc-400">
        Signed in as <span className="text-zinc-100">{email}</span>.
      </p>
      <SubmitClient hackathonId={hackathon.id} />
      {existing.length > 0 ? (
        <section className="flex flex-col gap-2">
          <h2 className="text-xs uppercase tracking-[0.2em] text-zinc-500">
            Your previous submissions
          </h2>
          <ul className="flex flex-col gap-2">
            {existing.map((s) => (
              <li
                key={s.id}
                className="rounded-lg border border-white/5 bg-zinc-900/40 p-3 text-sm text-zinc-200"
              >
                <div className="font-medium">{s.title}</div>
                <div className="text-xs text-zinc-500">
                  {s.team_name ? `${s.team_name} · ` : ""}
                  {s.repo_url ? (
                    <a
                      href={s.repo_url}
                      target="_blank"
                      rel="noreferrer"
                      className="underline hover:text-zinc-300"
                    >
                      {s.repo_url}
                    </a>
                  ) : (
                    "no repo url"
                  )}{" "}
                  · {new Date(s.created_at).toLocaleString()}
                </div>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </Shell>
  );
}

function Shell({
  hackathon,
  children,
}: {
  hackathon: { id: string; name: string };
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-1">
        <p className="text-xs uppercase tracking-[0.2em] text-violet-300/80">
          Submission portal
        </p>
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-100">
          {hackathon.name}
        </h1>
        <Link
          href={`/app/${hackathon.id}`}
          className="mt-1 text-xs text-zinc-500 hover:text-zinc-300"
        >
          ← Back to hack page
        </Link>
      </header>
      {children}
    </div>
  );
}
