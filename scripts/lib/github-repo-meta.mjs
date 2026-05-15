/**
 * GitHub REST helpers: metadata, readme, commit count (REST Link header).
 * Uses Authorization Bearer token; respects Retry-After on 403/429.
 */

const DEFAULT_API_VERSION = "2022-11-28";

/**
 * @param {string} linkHeader
 * @returns {number | null} last page number from rel="last"
 */
export function parseLinkLastPage(linkHeader) {
  if (!linkHeader) return null;
  for (const part of linkHeader.split(",")) {
    const m = /<([^>]+)>;\s*rel="last"/i.exec(part.trim());
    if (!m) continue;
    const u = new URL(m[1]);
    const p = u.searchParams.get("page");
    if (!p) return null;
    const n = Number.parseInt(p, 10);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

/**
 * @param {number} ms
 */
function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

/**
 * @param {Response} res
 */
function githubRetryAfterMs(res) {
  const ra = res.headers.get("retry-after");
  if (ra) {
    const n = Number.parseInt(ra, 10);
    if (Number.isFinite(n)) return n * 1000;
  }
  return 2000;
}

/**
 * @param {string} url
 * @param {string} token
 * @param {{ signal?: AbortSignal }} opts
 */
export async function githubFetchJson(url, token, opts = {}) {
  const { signal } = opts;
  /** @type {Record<string,string>} */
  const headers = {
    Authorization: `Bearer ${token}`,
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": DEFAULT_API_VERSION,
  };
  for (let attempt = 0; attempt < 6; attempt++) {
    const res = await fetch(url, { headers, signal });
    const remaining = res.headers.get("x-ratelimit-remaining");
    if (remaining === "0" && res.status === 403) {
      const reset = res.headers.get("x-ratelimit-reset");
      const now = Math.floor(Date.now() / 1000);
      const waitSec = reset ? Math.max(1, Number.parseInt(reset, 10) - now) : 60;
      await sleep(Math.min(waitSec * 1000, 120_000));
      continue;
    }
    if (res.status === 429 || (res.status === 403 && attempt < 5)) {
      await sleep(githubRetryAfterMs(res));
      continue;
    }
    if (!res.ok) {
      const t = await res.text().catch(() => "");
      const err = new Error(`GitHub ${res.status} ${url}: ${t.slice(0, 200)}`);
      /** @type {any} */ (err).status = res.status;
      throw err;
    }
    if (res.status === 204) return null;
    return /** @type {Record<string, unknown>} */ (await res.json());
  }
  throw new Error(`GitHub: gave up retrying ${url}`);
}

/**
 * Returns Response (not JSON) so callers can read Link headers.
 * @param {string} url
 * @param {string} token
 * @param {{ signal?: AbortSignal }} opts
 */
export async function githubFetchRaw(url, token, opts = {}) {
  const { signal } = opts;
  /** @type {Record<string,string>} */
  const headers = {
    Authorization: `Bearer ${token}`,
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": DEFAULT_API_VERSION,
  };
  for (let attempt = 0; attempt < 6; attempt++) {
    const res = await fetch(url, { headers, signal });
    if (res.status === 429 || (res.status === 403 && attempt < 5)) {
      await sleep(githubRetryAfterMs(res));
      continue;
    }
    return res;
  }
  throw new Error(`GitHub: gave up retrying ${url}`);
}

/**
 * @param {string} owner
 * @param {string} repo
 * @param {string} token
 * @param {AbortSignal} [signal]
 * @returns {Promise<{ default_branch?: string; description?: string | null } | null>}
 */
export async function fetchRepoCore(owner, repo, token, signal) {
  const url = `https://api.github.com/repos/${owner}/${repo}`;
  try {
    return await githubFetchJson(url, token, { signal });
  } catch (e) {
    /** @type {any} */ (e).phase = "repo";
    throw e;
  }
}

/**
 * @param {string} owner
 * @param {string} repo
 * @param {string} token
 * @param {AbortSignal} [signal]
 * @returns {Promise<string | null>} UTF-8 readme or null if missing
 */
export async function fetchReadmeUtf8(owner, repo, token, signal) {
  const url = `https://api.github.com/repos/${owner}/${repo}/readme`;
  try {
    const j = await githubFetchJson(url, token, { signal });
    const enc = j?.encoding;
    const content = j?.content;
    if (enc !== "base64" || typeof content !== "string") return null;
    return Buffer.from(content.replace(/\n/g, ""), "base64").toString("utf8");
  } catch (e) {
    const st = /** @type {any} */ (e).status;
    if (st === 404) return null;
    throw e;
  }
}

/**
 * Default-branch commit count via `GET /commits?per_page=1` Link rel=last.
 * @param {string} owner
 * @param {string} repo
 * @param {string} token
 * @param {AbortSignal} [signal]
 * @returns {Promise<number | null>}
 */
export async function fetchDefaultBranchCommitCount(
  owner,
  repo,
  token,
  signal,
) {
  const url = `https://api.github.com/repos/${owner}/${repo}/commits?per_page=1`;
  const res = await githubFetchRaw(url, token, { signal });
  if (!res.ok) {
    if (res.status === 404) return null;
    const t = await res.text().catch(() => "");
    throw new Error(`GitHub commits ${res.status}: ${t.slice(0, 200)}`);
  }
  const link = res.headers.get("link");
  const last = parseLinkLastPage(link);
  if (last != null) return last;
  const arr = await res.json();
  return Array.isArray(arr) ? arr.length : null;
}

/**
 * Lifetime additions/deletions from `GET /repos/{owner}/{repo}/stats/code_frequency`
 * (weekly `[unix_week, additions, deletions]` rows).
 * GitHub often returns **202** while computing — retries with backoff.
 *
 * @param {string} owner
 * @param {string} repo
 * @param {string} token
 * @param {AbortSignal} [signal]
 * @returns {Promise<{ additions: number, deletions: number } | null>}
 */
export async function fetchCodeFrequencyTotals(owner, repo, token, signal) {
  const url = `https://api.github.com/repos/${owner}/${repo}/stats/code_frequency`;
  /** @type {Record<string,string>} */
  const headers = {
    Authorization: `Bearer ${token}`,
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": DEFAULT_API_VERSION,
  };
  for (let attempt = 0; attempt < 12; attempt++) {
    const res = await fetch(url, { headers, signal });
    if (res.status === 202) {
      await sleep(Math.min(3000 + attempt * 700, 25_000));
      continue;
    }
    if (res.status === 429 || (res.status === 403 && attempt < 10)) {
      await sleep(githubRetryAfterMs(res));
      continue;
    }
    if (!res.ok) {
      if (res.status === 404) return null;
      const t = await res.text().catch(() => "");
      throw new Error(`GitHub code_frequency ${res.status}: ${t.slice(0, 200)}`);
    }
    const data = /** @type {unknown} */ (await res.json());
    if (!Array.isArray(data)) return null;
    let additions = 0;
    let deletions = 0;
    for (const row of data) {
      if (Array.isArray(row) && row.length >= 3) {
        additions += Number(row[1]) || 0;
        deletions += Number(row[2]) || 0;
      }
    }
    return { additions, deletions };
  }
  return null;
}
