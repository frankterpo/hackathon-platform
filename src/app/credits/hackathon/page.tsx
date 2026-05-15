import { redirect } from "next/navigation";

/** Legacy entry URL kept for old links. New stable route is /app/master. */
export default function CreditsHackathonPage() {
  redirect("/app/master");
}
