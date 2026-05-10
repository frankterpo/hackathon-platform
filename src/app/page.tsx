import { HackathonBoard } from "@/components/HackathonBoard";
import { fetchHackathons, isSupabaseConfigured } from "@/lib/supabase/server";

export default async function Home() {
  const hackathons = await fetchHackathons();
  const ref =
    process.env.NEXT_PUBLIC_SUPABASE_PROJECT_REF ?? "wkzczywhgxzttyfzhgck";

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col px-4 py-10 sm:px-6 lg:px-8">
      <HackathonBoard
        hackathons={hackathons}
        supabaseProjectRef={ref}
        setupRequired={!isSupabaseConfigured()}
      />
    </div>
  );
}
