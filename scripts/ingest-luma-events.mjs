#!/usr/bin/env node

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { createClient } from "@supabase/supabase-js";

import { parseDotenvLines } from "./lib/parse-dotenv-lines.mjs";

const DEFAULT_EVENT_URLS = [
  "https://luma.com/1ufgfhvv",
  "https://luma.com/2ohizf10",
  "https://luma.com/b6jccpfu",
];

const EVENT_ALIASES = new Map([
  // Same Cursor AdTech London Hackathon: b6jccpfu is the canonical event in Cursor calendar.
  ["wl7a90xe", "b6jccpfu"],
]);

const USER_AGENT =
  "Mozilla/5.0 (compatible; hackathon-platform-luma-ingest/1.0; +https://github.com)";

loadDotenvFile(".env");
loadDotenvFile(".env.local");

const eventUrls =
  process.argv.slice(2).length > 0 ? process.argv.slice(2) : DEFAULT_EVENT_URLS;
const supabaseUrl =
  envTrim("SUPABASE_URL") ?? envTrim("NEXT_PUBLIC_SUPABASE_URL");
const serviceRoleKey = envTrim("SUPABASE_SERVICE_ROLE_KEY");

if (!supabaseUrl || !serviceRoleKey) {
  fail(
    "Missing Supabase env. Set SUPABASE_URL or NEXT_PUBLIC_SUPABASE_URL, plus SUPABASE_SERVICE_ROLE_KEY.",
  );
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const results = [];
for (const rawUrl of eventUrls) {
  const url = normalizeLumaUrl(rawUrl);
  const slug = lumaSlugFromUrl(url);
  const canonicalSlug = EVENT_ALIASES.get(slug) ?? slug;
  if (canonicalSlug !== slug) {
    console.log(`alias ${slug} → ${canonicalSlug}; skipping duplicate Luma event ${url}`);
    continue;
  }
  const page = await fetchLumaPage(url);
  const event = extractEventData(url, page);
  const payload = toHackathonPayload(event);

  const { data: existing, error: existingError } = await supabase
    .from("hackathons")
    .select("id,vercel_project_slug,firebase_config_ref")
    .or(
      [
        `luma_url.eq.${escapePostgrestValue(payload.luma_url)}`,
        `luma_event_id.eq.${escapePostgrestValue(payload.luma_event_id)}`,
        `theme_slug.eq.${escapePostgrestValue(payload.theme_slug)}`,
      ].join(","),
    )
    .limit(1)
    .maybeSingle();

  if (existingError) {
    fail(`Supabase lookup failed for ${url}: ${existingError.message}`);
  }

  const writePayload = {
    ...payload,
    vercel_project_slug:
      existing?.vercel_project_slug ?? payload.vercel_project_slug,
    firebase_config_ref:
      existing?.firebase_config_ref ?? payload.firebase_config_ref,
  };

  const query = existing?.id
    ? supabase.from("hackathons").update(writePayload).eq("id", existing.id)
    : supabase.from("hackathons").insert(writePayload);

  const { data, error } = await query
    .select("id,name,status,theme_slug,luma_event_id,luma_url")
    .single();

  if (error) {
    fail(`Supabase upsert failed for ${url}: ${error.message}`);
  }

  results.push(data);
}

for (const row of results) {
  console.log(
    `upserted ${row.status.padEnd(9)} ${row.theme_slug.padEnd(34)} ${row.name} (${row.luma_event_id})`,
  );
}

console.log(`done: ${results.length} Luma event(s) ingested`);

function loadDotenvFile(name) {
  const path = resolve(process.cwd(), name);
  try {
    const content = readFileSync(path, "utf8");
    for (const [key, value] of parseDotenvLines(content)) {
      process.env[key] ??= value;
    }
  } catch (error) {
    if (error?.code !== "ENOENT") {
      throw error;
    }
  }
}

function envTrim(name) {
  const value = process.env[name];
  if (typeof value !== "string") {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function normalizeLumaUrl(raw) {
  let parsed;
  try {
    parsed = new URL(raw);
  } catch {
    parsed = new URL(`https://luma.com/${raw}`);
  }

  const host = parsed.hostname.replace(/^www\./, "");
  if (host !== "luma.com" && host !== "lu.ma") {
    fail(`Not a Luma URL: ${raw}`);
  }

  const slug = parsed.pathname.split("/").filter(Boolean)[0];
  if (!slug) {
    fail(`Luma URL is missing an event slug: ${raw}`);
  }

  return `https://luma.com/${slug}`;
}

function lumaSlugFromUrl(url) {
  return new URL(url).pathname.split("/").filter(Boolean)[0];
}

async function fetchLumaPage(url) {
  const headers = {
    accept: "text/html,application/xhtml+xml",
    "user-agent": USER_AGENT,
  };

  const token = envTrim("LUMA_AUTH_TOKEN");
  const cookie = envTrim("LUMA_COOKIE");
  if (token) {
    headers.authorization = token.startsWith("Bearer ")
      ? token
      : `Bearer ${token}`;
  }
  if (cookie) {
    headers.cookie = cookie;
  }

  const response = await fetch(url, { headers, redirect: "follow" });
  if (!response.ok) {
    fail(`Luma page fetch failed for ${url}: HTTP ${response.status}`);
  }
  return response.text();
}

function extractEventData(url, html) {
  const json = html.match(
    /<script[^>]+id=["']__NEXT_DATA__["'][^>]*type=["']application\/json["'][^>]*>(?<json>.*?)<\/script>/s,
  )?.groups?.json;

  if (!json) {
    fail(`Could not find __NEXT_DATA__ on ${url}`);
  }

  const nextData = JSON.parse(decodeHtmlEntities(json));
  const data = nextData?.props?.pageProps?.initialData?.data;
  const event = data?.event;
  if (!event?.api_id || !event?.name || !event?.url) {
    fail(`Luma payload for ${url} did not include event.api_id/name/url`);
  }

  return {
    slug: event.url,
    url: `https://luma.com/${event.url}`,
    eventApiId: event.api_id,
    title: event.name,
    startAt: event.start_at ?? data?.start_at ?? null,
    endAt: event.end_at ?? null,
    timezone: event.timezone ?? data?.calendar?.timezone ?? null,
    location: formatLocation(event),
    description: plainTextFromDescription(data?.description_mirror),
    raw: sanitizeRawPayload({
      event,
      calendar: data?.calendar,
      ticket_info: data?.ticket_info,
      registration_availability: data?.registration_availability,
      guest_count: data?.guest_count,
    }),
  };
}

function toHackathonPayload(event) {
  return {
    name: event.title,
    status: statusFromDates(event.startAt, event.endAt),
    start_date: event.startAt,
    end_date: event.endAt,
    starts_at: event.startAt ?? new Date().toISOString(),
    ends_at: event.endAt ?? event.startAt ?? new Date().toISOString(),
    theme_slug: stableThemeSlug(event.slug, event.title),
    slug: stableThemeSlug(event.slug, event.title),
    vercel_project_slug: null,
    luma_event_id: event.eventApiId,
    luma_url: event.url,
    luma_event_title: event.title,
    luma_timezone: event.timezone,
    luma_location: event.location,
    luma_description: event.description,
    luma_raw_payload: event.raw,
    firebase_config_ref: null,
  };
}

function statusFromDates(startAt, endAt) {
  const now = Date.now();
  const start = startAt ? Date.parse(startAt) : Number.NaN;
  const end = endAt ? Date.parse(endAt) : Number.NaN;

  if (Number.isFinite(start) && start > now) {
    return "scheduled";
  }
  if (Number.isFinite(end) && end < now) {
    return "completed";
  }
  if (
    Number.isFinite(start) &&
    Number.isFinite(end) &&
    start <= now &&
    end >= now
  ) {
    return "live";
  }
  return "scheduled";
}

function stableThemeSlug(slug, title) {
  const titleSlug = String(title)
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-")
    .slice(0, 48);

  return `${slug}-${titleSlug || "luma-event"}`.slice(0, 64);
}

function escapePostgrestValue(value) {
  return String(value).replace(/([,()])/g, "\\$1");
}

function formatLocation(event) {
  const geo = event.geo_address_info;
  if (typeof geo?.full_address === "string" && geo.full_address.trim()) {
    return geo.full_address.trim();
  }
  if (typeof geo?.address === "string" && geo.address.trim()) {
    return geo.address.trim();
  }
  if (
    typeof event.virtual_info?.url === "string" &&
    event.virtual_info.url.trim()
  ) {
    return event.virtual_info.url.trim();
  }
  if (event.location_type) {
    return event.location_type;
  }
  return null;
}

function plainTextFromDescription(descriptionMirror) {
  const value = flattenDescription(descriptionMirror)
    .replace(/\s+/g, " ")
    .trim();
  return value.length > 0 ? value : null;
}

function flattenDescription(node) {
  if (!node) {
    return "";
  }
  if (typeof node === "string") {
    return node;
  }
  if (Array.isArray(node)) {
    return node.map(flattenDescription).join(" ");
  }
  if (typeof node === "object") {
    return [node.text, node.content, node.children]
      .map(flattenDescription)
      .filter(Boolean)
      .join(" ");
  }
  return "";
}

function sanitizeRawPayload(value) {
  return JSON.parse(
    JSON.stringify(value, (key, nested) => {
      if (/token|cookie|secret|auth|email|phone/i.test(key)) {
        return undefined;
      }
      return nested;
    }),
  );
}

function decodeHtmlEntities(value) {
  return value
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#x27;/g, "'")
    .replace(/&#39;/g, "'");
}

function fail(message) {
  console.error(message);
  process.exit(1);
}
