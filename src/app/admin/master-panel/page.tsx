import { permanentRedirect } from "next/navigation";

/**
 * Legacy URL: Kanban lived here alongside Create hackathon. Canonical master UI +
 * portal config is under `/app/master` (cookie session via same `ADMIN_SECRET`).
 */
export default function MasterPanelLegacyRedirectPage() {
  permanentRedirect("/app/master");
}
