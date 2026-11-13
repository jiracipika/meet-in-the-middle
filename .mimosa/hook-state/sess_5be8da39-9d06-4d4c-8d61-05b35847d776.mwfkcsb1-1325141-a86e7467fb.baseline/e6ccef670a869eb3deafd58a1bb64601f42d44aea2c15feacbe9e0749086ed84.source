import { NextResponse } from "next/server";

/**
 * Geocoding proxy around Photon (OSM-based, keyless, autocomplete-friendly).
 * Proxied server-side so we can set a proper User-Agent and cache results.
 */

const UA =
  "meet-in-the-middle/1.0 (https://github.com/jiracipika/meet-in-the-middle; Vercel serverless)";
const TTL_MS = 10 * 60_000;
const MAX_ENTRIES = 300;

type CacheEntry = { ts: number; body: unknown };
const cache = new Map<string, CacheEntry>();

function cacheGet(key: string): unknown | undefined {
  const hit = cache.get(key);
  if (!hit) return undefined;
  if (Date.now() - hit.ts > TTL_MS) {
    cache.delete(key);
    return undefined;
  }
  return hit.body;
}

function cacheSet(key: string, body: unknown) {
  if (cache.size >= MAX_ENTRIES) {
    const oldest = cache.keys().next().value;
    if (oldest !== undefined) cache.delete(oldest);
  }
  cache.set(key, { ts: Date.now(), body });
}

type PhotonProperties = {
  name?: string;
  housenumber?: string;
  street?: string;
  postcode?: string;
  city?: string;
  district?: string;
  state?: string;
  country?: string;
};

function buildLabel(p: PhotonProperties): string {
  const parts: string[] = [];
  if (p.name) parts.push(p.name);
  const street = [p.housenumber, p.street].filter(Boolean).join(" ");
  if (street && street !== p.name) parts.push(street);
  const city = [p.postcode, p.city ?? p.district].filter(Boolean).join(" ");
  if (city && city !== p.name) parts.push(city);
  if (p.state && p.state !== p.city) parts.push(p.state);
  if (p.country) parts.push(p.country);
  return parts.join(", ") || "Unnamed place";
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const q = (url.searchParams.get("q") ?? "").trim();
  const lat = url.searchParams.get("lat");
  const lon = url.searchParams.get("lon");
  if (q.length < 3) {
    return NextResponse.json({ results: [] });
  }

  const biasKey =
    lat && lon ? `${Number(lat).toFixed(1)},${Number(lon).toFixed(1)}` : "";
  const key = `${q.toLowerCase()}|${biasKey}`;
  const cached = cacheGet(key);
  if (cached !== undefined) {
    return NextResponse.json(cached);
  }

  const photon = new URL("https://photon.komoot.io/api/");
  photon.searchParams.set("q", q);
  photon.searchParams.set("limit", "7");
  if (lat && lon) {
    photon.searchParams.set("lat", lat);
    photon.searchParams.set("lon", lon);
  }

  try {
    const res = await fetch(photon, {
      headers: { "User-Agent": UA, Accept: "application/json" },
      signal: AbortSignal.timeout(9000),
      cache: "no-store",
    });
    if (!res.ok) {
      return NextResponse.json({ error: "geocode_upstream" }, { status: 502 });
    }
    const json: unknown = await res.json();
    const features = (json as { features?: unknown[] }).features ?? [];
    const results = features
      .map((f) => {
        const feature = f as {
          properties?: PhotonProperties;
          geometry?: { coordinates?: [number, number] };
        };
        const coords = feature.geometry?.coordinates;
        if (!coords || coords.length < 2) return null;
        const [flon, flat] = coords;
        if (!Number.isFinite(flat) || !Number.isFinite(flon)) return null;
        return {
          label: buildLabel(feature.properties ?? {}),
          lat: flat,
          lon: flon,
        };
      })
      .filter((r): r is { label: string; lat: number; lon: number } => r !== null)
      .slice(0, 6);

    const body = { results };
    cacheSet(key, body);
    return NextResponse.json(body);
  } catch {
    return NextResponse.json({ error: "geocode_failed" }, { status: 502 });
  }
}
