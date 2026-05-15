/** Map Supabase submissions_rows CSV columns → DB payload (structured fields only). */

export function deriveRepoKeyFromUrl(url) {
  const m = /github\.com\/([^/?#]+\/[^/?#]+)/i.exec(String(url || ""));
  return m ? m[1].toLowerCase() : "";
}

export function normalizeRepoUrl(url) {
  if (!url || typeof url !== "string") return "";
  let u = url.trim().toLowerCase();
  if (!u) return "";
  if (u.endsWith("/")) u = u.slice(0, -1);
  return u;
}

function trimOrNull(v) {
  if (v == null) return null;
  const s = String(v).trim();
  return s.length ? s : null;
}

function parseIntOrNull(v) {
  if (v == null || v === "") return null;
  const s = String(v).trim();
  if (!/^-?\d+$/.test(s)) return null;
  const n = Number.parseInt(s, 10);
  return Number.isFinite(n) ? n : null;
}

function parseBoolOrNull(v) {
  if (v == null || v === "") return null;
  const s = String(v).trim().toLowerCase();
  if (["t", "true", "1", "yes"].includes(s)) return true;
  if (["f", "false", "0", "no"].includes(s)) return false;
  return null;
}

function parseTsOrNull(v) {
  const s = trimOrNull(v);
  if (!s) return null;
  const d = Date.parse(s);
  return Number.isFinite(d) ? new Date(d).toISOString() : null;
}

function parseTriBoolInt(v) {
  const b = parseBoolOrNull(v);
  if (b === null) return null;
  return b ? 1 : 0;
}

/**
 * Parse `body` text produced by `import-hackathon-csv-recovery.mjs` (and compatible exports):
 * sections separated by a blank line; single-line "Track:", "Demo:", "Team:";
 * multi-line "Description:" → description column; "AI notes:", optional "Notes:" → participant_notes only.
 * Portal submissions often use plain description text only (no labels); the backfill script may copy that into `description` when no labeled blocks match.
 *
 * @param {string | null | undefined} body
 * @returns {{
 *   chosen_track: string | null,
 *   demo_url: string | null,
 *   team_members: string | null,
 *   description: string | null,
 *   participant_notes: string | null,
 *   _meta: { hadAnyLabeledBlock: boolean },
 * }}
 */
export function parseStructuredSubmissionBody(body) {
  /** @type {{ chosen_track: string | null; demo_url: string | null; team_members: string | null; description: string | null; participant_notes: string | null; _meta: { hadAnyLabeledBlock: boolean } }} */
  const empty = {
    chosen_track: null,
    demo_url: null,
    team_members: null,
    description: null,
    participant_notes: null,
    _meta: { hadAnyLabeledBlock: false },
  };
  if (body == null || typeof body !== "string") return empty;
  const trimmed = body.trim();
  if (!trimmed) return empty;

  const blocks = trimmed
    .split(/\n\n+/)
    .map((b) => b.trim())
    .filter(Boolean);

  let chosen_track = null;
  let demo_url = null;
  let team_members = null;
  let explicitNotes = null;
  /** @type {string[]} */
  const descChunks = [];
  /** @type {string[]} */
  const aiChunks = [];
  let hadAnyLabeledBlock = false;

  const singleValue = (label, block) => {
    const prefix = `${label}:`;
    if (!block.startsWith(prefix)) return null;
    hadAnyLabeledBlock = true;
    const rest = block.slice(prefix.length).trim();
    return rest || null;
  };

  const multilineValue = (label, block) => {
    const prefix = `${label}:`;
    if (!block.startsWith(prefix)) return null;
    hadAnyLabeledBlock = true;
    let rest = block.slice(prefix.length);
    rest = rest.replace(/^\s*\n+/, "").trimEnd();
    return rest.length ? rest : null;
  };

  for (const block of blocks) {
    const t = singleValue("Track", block);
    if (t != null) {
      chosen_track = t;
      continue;
    }
    const d = singleValue("Demo", block);
    if (d != null) {
      demo_url = d;
      continue;
    }
    const tm = singleValue("Team", block);
    if (tm != null) {
      team_members = tm;
      continue;
    }
    const desc = multilineValue("Description", block);
    if (desc != null) {
      descChunks.push(desc);
      continue;
    }
    const ai = multilineValue("AI notes", block);
    if (ai != null) {
      aiChunks.push(ai);
      continue;
    }
    const notes = multilineValue("Notes", block);
    if (notes != null) {
      explicitNotes = notes;
      continue;
    }
  }

  const description =
    descChunks.length > 0 ? descChunks.join("\n\n") : null;

  /** @type {(string | null)[]} */
  const noteParts = [];
  if (explicitNotes) noteParts.push(explicitNotes);
  if (aiChunks.length) noteParts.push(aiChunks.join("\n\n"));
  const participant_notes = noteParts.length ? noteParts.join("\n\n") : null;

  return {
    chosen_track,
    demo_url,
    team_members,
    description,
    participant_notes,
    _meta: { hadAnyLabeledBlock },
  };
}

/**
 * @param {Record<string, string>} row CSV DictReader row
 * @returns {Record<string, unknown>}
 */
export function structuredFieldsFromCsvRow(row) {
  return {
    demo_url: trimOrNull(row.demo_url),
    chosen_track: trimOrNull(row.chosen_track),
    team_members: trimOrNull(row.team_members),
    description: trimOrNull(row.description),
    participant_notes: trimOrNull(row.notes),
    export_repo_id: trimOrNull(row.repo_id),

    analysis_status: trimOrNull(row.analysis_status),
    analyzed_at: parseTsOrNull(row.analyzed_at),
    analysis_error: trimOrNull(row.analysis_error),

    ai_text: trimOrNull(row.ai_text),
    ai_model: trimOrNull(row.ai_model),
    ai_generated_at: parseTsOrNull(row.ai_generated_at),
    ai_error: trimOrNull(row.ai_error),

    total_commits: parseIntOrNull(row.total_commits),
    total_commits_before_t0: parseIntOrNull(row.total_commits_before_t0),
    total_commits_during_event: parseIntOrNull(row.total_commits_during_event),
    total_commits_after_t1: parseIntOrNull(row.total_commits_after_t1),
    total_loc_added: parseIntOrNull(row.total_loc_added),
    total_loc_deleted: parseIntOrNull(row.total_loc_deleted),

    has_commits_before_t0: parseTriBoolInt(row.has_commits_before_t0),
    has_bulk_commits: parseTriBoolInt(row.has_bulk_commits),
    has_large_initial_commit_after_t0: parseTriBoolInt(
      row.has_large_initial_commit_after_t0,
    ),
    has_merge_commits: parseTriBoolInt(row.has_merge_commits),

    default_branch: trimOrNull(row.default_branch),
    project_description: trimOrNull(row.project_description),
    uses_white_circle: parseBoolOrNull(row.uses_white_circle),
  };
}
