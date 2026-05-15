import { NextResponse, type NextRequest } from "next/server";

/**
 * Hack-page domain rewrite.
 *
 * Set HACK_PAGE_DOMAIN_MAP in the env to a JSON object mapping host names to
 * hackathon ids, e.g.:
 *   {
 *     "cursor-thrads-london-2026.vercel.app": "<thrads_hackathon_uuid>",
 *     "thrads-hack.example.com": "<thrads_hackathon_uuid>"
 *   }
 *
 * For matched hosts the root path "/" rewrites to "/app/<hackathonId>" and
 * "/credits", "/submit", "/judge" rewrite to "/app/<hackathonId>/<portal>" so
 * the themed Vercel project serves the platform routes without ever exposing
 * the hack id in the URL.
 */
function loadHostMap(): Record<string, string> {
  const raw = process.env.HACK_PAGE_DOMAIN_MAP?.trim();
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object") return parsed as Record<string, string>;
  } catch {
    // ignore
  }
  return {};
}

const PORTAL_SHORTCUTS = new Set(["/credits", "/submit", "/judge"]);

export function middleware(request: NextRequest) {
  const hostMap = loadHostMap();
  if (Object.keys(hostMap).length === 0) return NextResponse.next();

  const host =
    request.headers.get("x-forwarded-host") ?? request.headers.get("host") ?? "";
  const hackathonId = hostMap[host.toLowerCase()];
  if (!hackathonId) return NextResponse.next();

  const { pathname, search } = request.nextUrl;

  if (pathname === "/" || pathname === "") {
    const url = request.nextUrl.clone();
    url.pathname = `/app/${hackathonId}`;
    return NextResponse.rewrite(url);
  }
  if (PORTAL_SHORTCUTS.has(pathname)) {
    const url = request.nextUrl.clone();
    url.pathname = `/app/${hackathonId}${pathname}`;
    return NextResponse.rewrite(url);
  }
  // Already-prefixed paths (e.g. /app/<id>/...) and /admin pass through.
  void search;
  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Run on everything except static assets and Next internals so we can
     * rewrite "/" and "/credits" etc. on themed domains.
     */
    "/((?!_next/|.*\\.(?:png|jpg|jpeg|gif|svg|ico|webp|css|js|map|txt|woff2?)$).*)",
  ],
};
