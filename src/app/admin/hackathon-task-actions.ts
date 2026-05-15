"use server";

/**
 * Task CRUD for hackathon operational checklists.
 * `public.agent_runs` is a DB stub for future draft/approval flows; V1 has no server actions or runners wired to it.
 */

import { revalidatePath } from "next/cache";

import {
  createServerSupabaseClient,
  hasServiceRoleKey,
} from "@/lib/supabase/server";
import type {
  HackathonTaskStatus,
  HackathonTaskType,
} from "@/types/database";

const TASK_TYPES: HackathonTaskType[] = [
  "venue",
  "catering",
  "luma_copy",
  "code",
  "judges",
  "partners",
  "social",
  "other",
];

const TASK_STATUSES: HackathonTaskStatus[] = [
  "todo",
  "in_progress",
  "done",
  "blocked",
];

type ActionResult = { ok: boolean; error: string | null };

function parseTaskType(raw: string): HackathonTaskType {
  return TASK_TYPES.includes(raw as HackathonTaskType)
    ? (raw as HackathonTaskType)
    : "other";
}

function parseTaskStatus(raw: string): HackathonTaskStatus {
  return TASK_STATUSES.includes(raw as HackathonTaskStatus)
    ? (raw as HackathonTaskStatus)
    : "todo";
}

function requireServiceSupabase():
  | { err: string }
  | {
      supabase: NonNullable<ReturnType<typeof createServerSupabaseClient>>;
    } {
  if (!hasServiceRoleKey()) {
    return {
      err: "SUPABASE_SERVICE_ROLE_KEY is required for task writes (same as Kanban status updates).",
    };
  }
  const supabase = createServerSupabaseClient();
  if (!supabase) {
    return { err: "Could not create Supabase client." };
  }
  return { supabase };
}

function revalidateTaskViews(hackathonId: string) {
  revalidatePath(`/admin/hackathons/${hackathonId}/tasks`);
  revalidatePath("/app/master");
}

const DEFAULT_CHECKLIST: { title: string; task_type: HackathonTaskType }[] = [
  { title: "Venue booked and logistics confirmed", task_type: "venue" },
  { title: "Catering / dietary plan", task_type: "catering" },
  { title: "Luma copy and event page finalized", task_type: "luma_copy" },
  { title: "Code of conduct, repos, and starter kit", task_type: "code" },
  { title: "Judges confirmed and briefed", task_type: "judges" },
  { title: "Partners and sponsor deliverables", task_type: "partners" },
  { title: "Social and outreach calendar", task_type: "social" },
  { title: "Comms run-of-show and day-of announcements", task_type: "other" },
];

async function nextSortOrder(
  supabase: NonNullable<ReturnType<typeof createServerSupabaseClient>>,
  hackathonId: string,
): Promise<number> {
  const { data: rows, error } = await supabase
    .from("hackathon_tasks")
    .select("sort_order")
    .eq("hackathon_id", hackathonId)
    .order("sort_order", { ascending: false })
    .order("id", { ascending: false })
    .limit(1);
  if (error) {
    console.error("[nextSortOrder]", error.message, error);
    return 0;
  }
  const raw = rows?.[0]?.sort_order;
  const max = typeof raw === "number" ? raw : Number(raw);
  return Number.isFinite(max) ? max + 1 : 0;
}

export async function createHackathonTaskAction(
  hackathonId: string,
  input: {
    title: string;
    task_type?: string;
    status?: string;
    notes?: string | null;
    due_at?: string | null;
  },
): Promise<ActionResult> {
  const hid = hackathonId?.trim();
  const title = input.title?.trim() ?? "";
  if (!hid || !title) {
    return { ok: false, error: "Hackathon id and title are required." };
  }
  const gate = requireServiceSupabase();
  if ("err" in gate) {
    return { ok: false, error: gate.err };
  }
  const { supabase } = gate;

  const sort_order = await nextSortOrder(supabase, hid);
  const { error } = await supabase.from("hackathon_tasks").insert({
    hackathon_id: hid,
    title,
    task_type: parseTaskType(input.task_type ?? "other"),
    status: parseTaskStatus(input.status ?? "todo"),
    sort_order,
    notes: input.notes?.trim() ? input.notes.trim() : null,
    due_at: input.due_at?.trim() ? input.due_at.trim() : null,
  });

  if (error) {
    console.error("[createHackathonTaskAction]", error.message, error);
    return { ok: false, error: error.message };
  }
  revalidateTaskViews(hid);
  return { ok: true, error: null };
}

export async function updateHackathonTaskAction(
  hackathonId: string,
  taskId: string,
  input: {
    title: string;
    task_type: string;
    status: string;
    notes: string | null;
    due_at: string | null;
  },
): Promise<ActionResult> {
  const hid = hackathonId?.trim();
  const tid = taskId?.trim();
  const title = input.title?.trim() ?? "";
  if (!hid || !tid || !title) {
    return { ok: false, error: "Hackathon id, task id, and title are required." };
  }
  const gate = requireServiceSupabase();
  if ("err" in gate) {
    return { ok: false, error: gate.err };
  }
  const { supabase } = gate;

  const { error } = await supabase
    .from("hackathon_tasks")
    .update({
      title,
      task_type: parseTaskType(input.task_type),
      status: parseTaskStatus(input.status),
      notes: input.notes?.trim() ? input.notes.trim() : null,
      due_at: input.due_at?.trim() ? input.due_at.trim() : null,
    })
    .eq("id", tid)
    .eq("hackathon_id", hid);

  if (error) {
    console.error("[updateHackathonTaskAction]", error.message, error);
    return { ok: false, error: error.message };
  }
  revalidateTaskViews(hid);
  return { ok: true, error: null };
}

export async function deleteHackathonTaskAction(
  hackathonId: string,
  taskId: string,
): Promise<ActionResult> {
  const hid = hackathonId?.trim();
  const tid = taskId?.trim();
  if (!hid || !tid) {
    return { ok: false, error: "Missing ids." };
  }
  const gate = requireServiceSupabase();
  if ("err" in gate) {
    return { ok: false, error: gate.err };
  }
  const { supabase } = gate;

  const { error } = await supabase
    .from("hackathon_tasks")
    .delete()
    .eq("id", tid)
    .eq("hackathon_id", hid);

  if (error) {
    console.error("[deleteHackathonTaskAction]", error.message, error);
    return { ok: false, error: error.message };
  }
  revalidateTaskViews(hid);
  return { ok: true, error: null };
}

export async function moveHackathonTaskAction(
  hackathonId: string,
  taskId: string,
  direction: "up" | "down",
): Promise<ActionResult> {
  const hid = hackathonId?.trim();
  const tid = taskId?.trim();
  if (!hid || !tid) {
    return { ok: false, error: "Missing ids." };
  }
  const gate = requireServiceSupabase();
  if ("err" in gate) {
    return { ok: false, error: gate.err };
  }
  const { supabase } = gate;

  const { data: rows, error: listErr } = await supabase
    .from("hackathon_tasks")
    .select("id,sort_order")
    .eq("hackathon_id", hid)
    .order("sort_order", { ascending: true })
    .order("id", { ascending: true });

  if (listErr || !rows?.length) {
    return { ok: false, error: listErr?.message ?? "No tasks to reorder." };
  }

  const ordered = rows as { id: string; sort_order: number }[];
  const idx = ordered.findIndex((r) => r.id === tid);
  if (idx < 0) {
    return { ok: false, error: "Task not found." };
  }
  const swapWith = direction === "up" ? idx - 1 : idx + 1;
  if (swapWith < 0 || swapWith >= ordered.length) {
    return { ok: true, error: null };
  }

  const a = ordered[idx];
  const b = ordered[swapWith];
  const { error: e1 } = await supabase
    .from("hackathon_tasks")
    .update({ sort_order: b.sort_order })
    .eq("id", a.id)
    .eq("hackathon_id", hid);
  if (e1) {
    return { ok: false, error: e1.message };
  }
  const { error: e2 } = await supabase
    .from("hackathon_tasks")
    .update({ sort_order: a.sort_order })
    .eq("id", b.id)
    .eq("hackathon_id", hid);
  if (e2) {
    return { ok: false, error: e2.message };
  }

  revalidateTaskViews(hid);
  return { ok: true, error: null };
}

export async function seedDefaultHackathonTasksAction(
  hackathonId: string,
): Promise<ActionResult> {
  const hid = hackathonId?.trim();
  if (!hid) {
    return { ok: false, error: "Missing hackathon id." };
  }
  const gate = requireServiceSupabase();
  if ("err" in gate) {
    return { ok: false, error: gate.err };
  }
  const { supabase } = gate;

  const base = await nextSortOrder(supabase, hid);
  const inserts = DEFAULT_CHECKLIST.map((row, i) => ({
    hackathon_id: hid,
    title: row.title,
    task_type: row.task_type,
    status: "todo" as const,
    sort_order: base + i,
  }));

  const { error } = await supabase.from("hackathon_tasks").insert(inserts);
  if (error) {
    console.error("[seedDefaultHackathonTasksAction]", error.message, error);
    return { ok: false, error: error.message };
  }
  revalidateTaskViews(hid);
  return { ok: true, error: null };
}
