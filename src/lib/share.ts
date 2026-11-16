import { MAX_PEOPLE, type ShareState, type SharedPerson } from "./types";

/** Unicode-safe base64url of the JSON state, for URL-hash sharing. */
export function encodeState(state: ShareState): string {
  const bytes = new TextEncoder().encode(JSON.stringify(state));
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function record(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
function coordinates(value: Record<string, unknown>): boolean {
  return typeof value.lat === "number" && Number.isFinite(value.lat) && Math.abs(value.lat) <= 90 &&
    typeof value.lon === "number" && Number.isFinite(value.lon) && Math.abs(value.lon) <= 180;
}
export function decodeState(hash: string): ShareState | null {
  try {
    if (hash.length > 16000) return null;
    const bin = atob(hash.replace(/-/g, "+").replace(/_/g, "/"));
    const parsed: unknown = JSON.parse(new TextDecoder().decode(Uint8Array.from(bin, c => c.charCodeAt(0))));
    if (!record(parsed) || !Array.isArray(parsed.p)) return null;
    const people: SharedPerson[] = [];
    for (const p of parsed.p.slice(0, MAX_PEOPLE)) {
      if (!record(p) || !coordinates(p)) continue;
      people.push({ lat: p.lat as number, lon: p.lon as number,
        n: typeof p.n === "string" ? p.n.slice(0, 24) : undefined,
        label: typeof p.label === "string" ? p.label.slice(0, 240) : undefined,
        w: typeof p.w === "number" && Number.isFinite(p.w) ? Math.max(.5, Math.min(2, p.w)) : 1 });
    }
    if (!people.length) return null;
    const state: ShareState = { p: people };
    if (parsed.m === "median" || parsed.m === "minmax" || parsed.m === "centroid") state.m = parsed.m;
    const v = parsed.v;
    if (record(v) && coordinates(v) && typeof v.name === "string") {
      state.v = { name: v.name.slice(0, 240), lat: v.lat as number, lon: v.lon as number,
        amenity: typeof v.amenity === "string" ? v.amenity.slice(0, 80) : undefined };
    }
    return state;
  } catch { return null; }
}
