export function vercelProjectUrl(slug: string | null): string {
  const team = process.env.NEXT_PUBLIC_VERCEL_TEAM;
  if (team && slug) {
    return `https://vercel.com/${team}/${slug}`;
  }
  return "https://vercel.com/dashboard";
}

export function vercelDeploymentGuess(slug: string | null): string {
  if (!slug) {
    return "#";
  }
  return `https://${slug}.vercel.app`;
}

export function lumaEventUrl(eventId: string | null): string {
  if (!eventId) {
    return "#";
  }
  return `https://lu.ma/${eventId}`;
}

export function firebaseConsoleUrl(configRef: string | null): string {
  if (!configRef) {
    return "https://console.firebase.google.com/";
  }
  return `https://console.firebase.google.com/project/${configRef}`;
}

export function supabaseDashboardUrl(projectRef: string | null): string {
  if (!projectRef) {
    return "https://supabase.com/dashboard";
  }
  return `https://supabase.com/dashboard/project/${projectRef}`;
}
