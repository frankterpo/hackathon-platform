import type {
  HackathonTaskStatus,
  HackathonTaskType,
} from "@/types/database";

export const HACKATHON_TASK_TYPE_OPTIONS: {
  value: HackathonTaskType;
  label: string;
}[] = [
  { value: "venue", label: "Venue & logistics" },
  { value: "catering", label: "Catering & dietary" },
  { value: "luma_copy", label: "Luma / event page copy" },
  { value: "code", label: "Code of conduct, repos, starter kit" },
  { value: "judges", label: "Judges & briefing" },
  { value: "partners", label: "Partners & sponsor deliverables" },
  { value: "social", label: "Social & outreach" },
  { value: "other", label: "Other operational" },
];

export const HACKATHON_TASK_STATUS_OPTIONS: {
  value: HackathonTaskStatus;
  label: string;
}[] = [
  { value: "todo", label: "To do — not started" },
  { value: "in_progress", label: "In progress — actively working" },
  { value: "done", label: "Done — shipped or verified" },
  { value: "blocked", label: "Blocked — needs a decision or dependency" },
];
