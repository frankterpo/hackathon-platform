export type HackathonStatus = "live" | "scheduled" | "completed";

export type HackathonRow = {
  id: string;
  name: string;
  status: HackathonStatus;
  start_date: string | null;
  end_date: string | null;
  theme_slug: string | null;
  vercel_project_slug: string | null;
  luma_event_id: string | null;
  firebase_config_ref: string | null;
  created_at: string;
  updated_at: string;
};
