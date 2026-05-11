export type HackathonStatus = "live" | "scheduled" | "completed";

export type HackathonRow = {
  id: string;
  name: string;
  status: HackathonStatus;
  start_date: string | null;
  end_date: string | null;
  starts_at: string;
  ends_at: string;
  theme_slug: string | null;
  slug: string;
  vercel_project_slug: string | null;
  luma_event_id: string | null;
  luma_url: string | null;
  luma_event_title: string | null;
  luma_timezone: string | null;
  luma_location: string | null;
  luma_description: string | null;
  luma_raw_payload: unknown | null;
  firebase_config_ref: string | null;
  created_at: string;
  updated_at: string;
};
