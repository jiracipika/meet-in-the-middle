import { NextResponse } from "next/server";

/**
 * CORS for the packaged Capacitor apps. The native WebViews run on their own
 * scheme/host origins (no Next server), so the apps call these APIs on the
 * deployed site cross-origin. Only the known app origins are allowed; the
 * normal site usage is same-origin and unaffected.
 */

const ALLOWED_ORIGINS = new Set([
  "capacitor://localhost",
  "ionic://localhost",
  "https://meetinthemiddlefair.vercel.app",
  "https://meet-in-the-middle-fair.vercel.app",
]);

// Local development / exported-bundle preview: any localhost port is fine
// (read-only GETs, no credentials involved).
const LOCAL_ORIGIN = /^https?:\/\/localhost(:\d+)?$/;

function allowedOrigin(request: Request): string | null {
  const origin = request.headers.get("origin");
  if (!origin) return null;
  return ALLOWED_ORIGINS.has(origin) || LOCAL_ORIGIN.test(origin) ? origin : null;
}

export function corsJson(request: Request, body: unknown, init?: ResponseInit): NextResponse {
  const res = NextResponse.json(body, init);
  const origin = allowedOrigin(request);
  if (origin) {
    res.headers.set("Access-Control-Allow-Origin", origin);
    res.headers.set("Vary", "Origin");
  }
  return res;
}

export function corsPreflight(request: Request): NextResponse {
  const res = new NextResponse(null, { status: 204 });
  const origin = allowedOrigin(request);
  if (origin) {
    res.headers.set("Access-Control-Allow-Origin", origin);
    res.headers.set("Access-Control-Allow-Methods", "GET, OPTIONS");
    res.headers.set("Vary", "Origin");
  }
  return res;
}
