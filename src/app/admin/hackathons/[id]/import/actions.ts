"use server";

import { revalidatePath } from "next/cache";

import { createServerSupabaseClient } from "@/lib/supabase/server";

export type ImportState = {
  ok: boolean;
  message: string;
  inserted: number;
};

type CsvRow = Record<string, string>;

const ALLOWED_TARGETS = new Set([
  "attendees",
  "credits",
  "judges",
]);

function parseCsv(input: string): CsvRow[] {
  const rows: string[][] = [];
  let cur: string[] = [];
  let cell = "";
  let inQuotes = false;
  for (let i = 0; i < input.length; i++) {
    const ch = input[i];
    if (inQuotes) {
      if (ch === '"' && input[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        cell += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === ",") {
        cur.push(cell);
        cell = "";
      } else if (ch === "\n" || ch === "\r") {
        if (cell.length > 0 || cur.length > 0) {
          cur.push(cell);
          rows.push(cur);
        }
        cell = "";
        cur = [];
        if (ch === "\r" && input[i + 1] === "\n") i++;
      } else {
        cell += ch;
      }
    }
  }
  if (cell.length > 0 || cur.length > 0) {
    cur.push(cell);
    rows.push(cur);
  }
  if (rows.length < 2) return [];
  const header = rows[0].map((h) => h.trim().toLowerCase());
  return rows.slice(1).map((r) => {
    const o: CsvRow = {};
    header.forEach((h, idx) => {
      o[h] = (r[idx] ?? "").trim();
    });
    return o;
  });
}

function expectedAdminSecret(): string | null {
  const v = process.env.ADMIN_SECRET?.trim();
  return v && v.length > 0 ? v : null;
}

export async function importCsvAction(
  hackathonId: string,
  formData: FormData,
): Promise<ImportState> {
  const trimmed = (hackathonId ?? "").trim();
  if (!trimmed) return { ok: false, message: "Missing hackathon id.", inserted: 0 };

  const adminSecret = (formData.get("adminSecret") ?? "").toString();
  const expected = expectedAdminSecret();
  if (!expected) {
    return {
      ok: false,
      message: "ADMIN_SECRET is not set on the server.",
      inserted: 0,
    };
  }
  if (adminSecret !== expected) {
    return { ok: false, message: "Admin secret mismatch.", inserted: 0 };
  }

  const target = (formData.get("target") ?? "").toString();
  if (!ALLOWED_TARGETS.has(target)) {
    return {
      ok: false,
      message: "Target must be attendees | credits | judges.",
      inserted: 0,
    };
  }

  const csv = (formData.get("csv") ?? "").toString();
  if (!csv.trim()) {
    return { ok: false, message: "Paste a CSV with headers first.", inserted: 0 };
  }

  const rows = parseCsv(csv);
  if (rows.length === 0) {
    return { ok: false, message: "No data rows parsed.", inserted: 0 };
  }

  const supabase = createServerSupabaseClient();
  if (!supabase) {
    return { ok: false, message: "Supabase not configured.", inserted: 0 };
  }

  if (target === "attendees") {
    const payload = rows
      .map((r) => {
        const email = (r.email ?? "").toLowerCase();
        if (!email.includes("@")) return null;
        return {
          hackathon_id: trimmed,
          email,
          first_name: r.first_name || r.firstname || null,
          last_name: r.last_name || r.lastname || null,
          source: r.source || "manual",
          rsvp_at: r.rsvp_at || null,
          checked_in_at: r.checked_in_at || null,
        };
      })
      .filter((x): x is NonNullable<typeof x> => x !== null);
    if (payload.length === 0) {
      return { ok: false, message: "No valid email rows.", inserted: 0 };
    }
    const { error } = await supabase
      .from("hackathon_attendees")
      .upsert(payload, { onConflict: "hackathon_id,email" });
    if (error) return { ok: false, message: error.message, inserted: 0 };
    revalidatePath(`/admin/hackathons/${trimmed}/import`);
    return { ok: true, message: "Attendees upserted.", inserted: payload.length };
  }

  if (target === "credits") {
    const payload = rows
      .map((r) => {
        const email = (r.email ?? "").toLowerCase();
        if (!email.includes("@")) return null;
        const amountRaw = r.amount_usd ?? r.amount ?? "";
        const amount = amountRaw ? Number(amountRaw) : null;
        return {
          hackathon_id: trimmed,
          email,
          first_name: r.first_name || r.firstname || null,
          last_name: r.last_name || r.lastname || null,
          amount_usd: amount && Number.isFinite(amount) ? amount : null,
          external_ref: r.external_ref || r.url || r.code || null,
          firebase_doc_path: r.firebase_doc_path || null,
          source: r.source || "manual",
        };
      })
      .filter((x): x is NonNullable<typeof x> => x !== null);
    if (payload.length === 0) {
      return { ok: false, message: "No valid email rows.", inserted: 0 };
    }
    const { error } = await supabase
      .from("credit_allocations")
      .upsert(payload, { onConflict: "hackathon_id,email" });
    if (error) return { ok: false, message: error.message, inserted: 0 };
    revalidatePath(`/admin/hackathons/${trimmed}/import`);
    return { ok: true, message: "Credit allocations upserted.", inserted: payload.length };
  }

  // judges
  const payload = rows
    .map((r) => {
      const email = (r.email ?? "").toLowerCase();
      if (!email.includes("@")) return null;
      return {
        hackathon_id: trimmed,
        email,
        display_name: r.display_name || r.name || null,
      };
    })
    .filter((x): x is NonNullable<typeof x> => x !== null);
  if (payload.length === 0) {
    return { ok: false, message: "No valid email rows.", inserted: 0 };
  }
  const { error } = await supabase
    .from("hackathon_judges")
    .upsert(payload, { onConflict: "hackathon_id,email" });
  if (error) return { ok: false, message: error.message, inserted: 0 };
  revalidatePath(`/admin/hackathons/${trimmed}/import`);
  return { ok: true, message: "Judges upserted.", inserted: payload.length };
}
