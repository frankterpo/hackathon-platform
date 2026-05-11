/** Production/preview URL for the linked Vercel project slug. */
export function vercelLiveDeploymentUrl(slug: string | null): string | null {
  if (!slug?.trim()) {
    return null;
  }
  return `https://${slug.trim()}.vercel.app`;
}

/** Vercel team dashboard for the project (set NEXT_PUBLIC_VERCEL_TEAM). */
export function vercelTeamProjectUrl(slug: string | null): string | null {
  const team = process.env.NEXT_PUBLIC_VERCEL_TEAM?.trim();
  if (!team || !slug?.trim()) {
    return null;
  }
  return `https://vercel.com/${team}/${slug.trim()}`;
}

/** Fall back when team slug is unknown — user should set NEXT_PUBLIC_VERCEL_TEAM. */
export function vercelDashboardFallbackUrl(): string {
  return "https://vercel.com/dashboard";
}

export function vercelProjectUrl(slug: string | null): string {
  return vercelTeamProjectUrl(slug) ?? vercelDashboardFallbackUrl();
}

/** @deprecated Prefer {@link vercelLiveDeploymentUrl} */
export function vercelDeploymentGuess(slug: string | null): string {
  return vercelLiveDeploymentUrl(slug) ?? "#";
}

export function lumaEventUrl(eventRef: string | null): string {
  if (!eventRef?.trim()) {
    return "#";
  }
  const ref = eventRef.trim();
  if (ref.startsWith("http://") || ref.startsWith("https://")) {
    return ref;
  }
  return `https://luma.com/${ref}`;
}

/** Host dashboard — open your hosted events (manual sync to this board). */
export function lumaHostDashboardUrl(eventApiId: string | null): string {
  if (eventApiId?.trim()) {
    return `https://luma.com/event/manage/${eventApiId.trim()}`;
  }
  return "https://luma.com/dashboard/events";
}

export function firebaseConsoleUrl(configRef: string | null): string {
  if (!configRef?.trim()) {
    return "#";
  }
  const p = configRef.trim();
  return `https://console.firebase.google.com/u/0/project/${p}/overview`;
}

export function supabaseProjectHomeUrl(projectRef: string | null): string {
  if (!projectRef?.trim()) {
    return "https://supabase.com/dashboard";
  }
  return `https://supabase.com/dashboard/project/${projectRef.trim()}`;
}

export function supabaseDatabaseTablesUrl(projectRef: string | null): string {
  if (!projectRef?.trim()) {
    return "https://supabase.com/dashboard";
  }
  const r = projectRef.trim();
  return `https://supabase.com/dashboard/project/${r}/database/tables`;
}

/** Opens SQL editor (run filter / joins yourself). Studio does not accept arbitrary SQL via URL. */
export function supabaseSqlEditorUrl(projectRef: string | null): string {
  if (!projectRef?.trim()) {
    return "https://supabase.com/dashboard";
  }
  return `https://supabase.com/dashboard/project/${projectRef.trim()}/sql/new`;
}

export function supabaseHackathonFilterSql(hackId: string): string {
  const id = hackId.replace(/'/g, "''");
  return `select * from public.hackathons where id = '${id}'`;
}

export function supabaseSubmissionsForHackathonSql(
  hackathonId: string,
): string {
  const id = hackathonId.replace(/'/g, "''");
  return `select * from public.submissions where hackathon_id = '${id}' order by created_at desc`;
}

/** @deprecated Use {@link supabaseProjectHomeUrl} */
export function supabaseDashboardUrl(projectRef: string | null): string {
  return supabaseProjectHomeUrl(projectRef);
}
