import "server-only";

import {
  cert,
  getApps,
  initializeApp,
  type App,
} from "firebase-admin/app";
import { getFirestore, type Firestore } from "firebase-admin/firestore";

/**
 * One Firebase project PER hackathon. Credits are real liability — isolating
 * each hack's credit pool in its own project means a leaked key or bad query
 * can't bleed across hackathons.
 *
 * Env contract:
 *   FIREBASE_SA__<firebase_config_ref> = single-line service-account JSON
 *
 * `firebase_config_ref` is the Firebase project id stored on the
 * `hackathons` row (e.g. `cursor-thrads-london-2026`). The double underscore
 * is a separator that survives Vercel env var name validation.
 */

const APP_CACHE = new Map<string, App>();
const DB_CACHE = new Map<string, Firestore>();

function envKeyForProject(projectId: string): string {
  // Project ids may contain hyphens; env var names cannot. Replace with `_`.
  return `FIREBASE_SA__${projectId.replace(/-/g, "_")}`;
}

function readServiceAccount(projectId: string): unknown | null {
  // Try the project-specific env var first.
  const projectKey = envKeyForProject(projectId);
  const projectVal = process.env[projectKey]?.trim();
  if (projectVal) {
    try {
      return JSON.parse(projectVal);
    } catch (error) {
      console.error(`[firebase/admin] ${projectKey} is not valid JSON`, error);
      return null;
    }
  }
  // Legacy fallback: a single shared service account (only safe if you have
  // exactly one Firebase project). Honored so existing `.env` still works
  // until we cut over.
  const fallback = process.env.FIREBASE_SERVICE_ACCOUNT_JSON?.trim();
  if (fallback) {
    try {
      return JSON.parse(fallback);
    } catch (error) {
      console.error(
        "[firebase/admin] FIREBASE_SERVICE_ACCOUNT_JSON is not valid JSON",
        error,
      );
      return null;
    }
  }
  return null;
}

export function getFirebaseDbForProject(
  projectId: string | null | undefined,
): Firestore | null {
  const trimmed = (projectId ?? "").trim();
  if (!trimmed) return null;

  const cached = DB_CACHE.get(trimmed);
  if (cached) return cached;

  const sa = readServiceAccount(trimmed);
  if (!sa) return null;

  try {
    const existing = getApps().find((a) => a.name === trimmed);
    const app =
      existing ??
      initializeApp(
        {
          credential: cert(sa as Parameters<typeof cert>[0]),
          projectId: trimmed,
        },
        trimmed,
      );
    APP_CACHE.set(trimmed, app);
    const db = getFirestore(app);
    DB_CACHE.set(trimmed, db);
    return db;
  } catch (error) {
    console.error("[firebase/admin] init failed for", trimmed, error);
    return null;
  }
}

/**
 * Resolve a credit link for a participant from the hackathon's Firebase
 * project. Convention (override via env if your data is shaped differently):
 *   collection: FIREBASE_CREDITS_COLLECTION (default 'credit_links')
 *   doc id:     `${hackathonId}__${email}` OR pass an explicit docPath
 *   fields:     { url: string, code?: string }
 */
export async function resolveCreditLink(args: {
  firebaseProjectId: string | null | undefined;
  hackathonId: string;
  email: string;
  docPath?: string | null;
}): Promise<{ url: string | null; code: string | null; error: string | null }> {
  const db = getFirebaseDbForProject(args.firebaseProjectId);
  if (!db) {
    return {
      url: null,
      code: null,
      error: `Firebase admin not configured for project '${args.firebaseProjectId ?? ""}'.`,
    };
  }
  try {
    const ref = args.docPath
      ? db.doc(args.docPath)
      : db
          .collection(
            process.env.FIREBASE_CREDITS_COLLECTION?.trim() ?? "credit_links",
          )
          .doc(`${args.hackathonId}__${args.email.trim().toLowerCase()}`);
    const snap = await ref.get();
    if (!snap.exists) {
      return {
        url: null,
        code: null,
        error: "No credit doc for this participant.",
      };
    }
    const data = snap.data() ?? {};
    const url = typeof data.url === "string" ? data.url : null;
    const code = typeof data.code === "string" ? data.code : null;
    return { url, code, error: null };
  } catch (error) {
    return {
      url: null,
      code: null,
      error: (error as Error).message,
    };
  }
}
