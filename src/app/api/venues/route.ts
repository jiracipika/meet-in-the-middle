import { NextResponse } from "next/server";

/**
 * Venue lookup around a point. Primary source: Overpass (OpenStreetMap) with
 * mirror fallback. If every mirror is down (the public instances do get
 * saturated), fall back to Photon POI search so the feature still works.
 */

export const maxDuration = 60;

const MIRRORS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
  "https://maps.mail.ru/osm/tools/overpass/api/interpreter",
  "https://overpass.private.coffee/api/interpreter",
];

const UA =
  "meet-in-the-middle/1.0 (https://github.com/jiracipika/meet-in-the-middle; Vercel serverless)";
const TTL_MS = 15 * 60_000;
const MAX_ENTRIES = 120;
const MIRROR_TIMEOUT_MS = 12_000;

type CacheEntry = { ts: number; body: unknown };
const cache = new Map<string, CacheEntry>();

type Venue = {
  id: string;
  name: string;
  lat: number;
  lon: number;
  amenity: string;
  cuisine?: string;
  distanceKm: number;
};

function haversineKm(
  aLat: number,
  aLon: number,
  bLat: number,
  bLon: number,
): number {
  const R = 6371;
  const dLat = ((bLat - aLat) * Math.PI) / 180;
  const dLon = ((bLon - aLon) * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((aLat * Math.PI) / 180) *
      Math.cos((bLat * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

function cachePut(key: string, body: unknown) {
  if (cache.size >= MAX_ENTRIES) {
    const oldest = cache.keys().next().value;
    if (oldest !== undefined) cache.delete(oldest);
  }
  cache.set(key, { ts: Date.now(), body });
}

async function tryOverpass(
  lat: number,
  lon: number,
  radius: number,
  attempts: Array<{ mirror: string; outcome: string }>,
): Promise<Venue[] | null> {
  const query = `[out:json][timeout:25];nwr(around:${radius},${lat},${lon})[amenity~"^(cafe|restaurant|bar|fast_food|food_court|ice_cream)$"];out center tags 80;`;
  for (const mirror of MIRRORS) {
    try {
      const res = await fetch(mirror, {
        method: "POST",
        headers: {
          "User-Agent": UA,
          "Content-Type": "application/x-www-form-urlencoded",
          Accept: "application/json",
        },
        body: new URLSearchParams({ data: query }).toString(),
        signal: AbortSignal.timeout(MIRROR_TIMEOUT_MS),
        cache: "no-store",
      });
      if (!res.ok) {
        attempts.push({ mirror, outcome: `http_${res.status}` });
        continue;
      }
      const json: unknown = await res.json();
      const elements = (json as { elements?: unknown[] }).elements ?? [];
      const venues: Venue[] = [];
      for (const el of elements) {
        const e = el as {
          type?: string;
          id?: number;
          lat?: number;
          lon?: number;
          center?: { lat: number; lon: number };
          tags?: Record<string, string>;
        };
        const vLat = e.lat ?? e.center?.lat;
        const vLon = e.lon ?? e.center?.lon;
        const name = e.tags?.name;
        const amenity = e.tags?.amenity ?? "";
        if (
          vLat === undefined ||
          vLon === undefined ||
          !name ||
          !e.id ||
          !e.type
        ) {
          continue;
        }
        venues.push({
          id: `${e.type}/${e.id}`,
          name,
          lat: vLat,
          lon: vLon,
          amenity,
          cuisine: e.tags?.cuisine?.split(";")[0],
          distanceKm: haversineKm(lat, lon, vLat, vLon),
        });
      }
      return venues;
    } catch (e) {
      attempts.push({
        mirror,
        outcome: e instanceof Error ? e.name : "fetch_failed",
      });
      // try the next mirror
    }
  }
  return null;
}

/**
 * Fallback: Photon POI search. Photon (like Overpass, OSM-based) runs on
 * separate infrastructure and supports amenity-tag filters with a location
 * bias; we filter by true distance afterwards.
 */
async function tryPhoton(
  lat: number,
  lon: number,
  radius: number,
): Promise<Venue[] | null> {
  const tags: Array<[string, string]> = [
    ["cafe", "cafe"],
    ["restaurant", "restaurant"],
    ["bar", "bar"],
    ["fast food", "fast_food"],
    ["ice cream", "ice_cream"],
  ];
  const byId = new Map<string, Venue>();
  for (const [term, tag] of tags) {
    try {
      const url = new URL("https://photon.komoot.io/api/");
      url.searchParams.set("q", term);
      url.searchParams.set("lat", String(lat));
      url.searchParams.set("lon", String(lon));
      url.searchParams.set("limit", "15");
      url.searchParams.set("osm_tag", `amenity:${tag}`);
      const res = await fetch(url, {
        headers: { "User-Agent": UA, Accept: "application/json" },
        signal: AbortSignal.timeout(8_000),
        cache: "no-store",
      });
      if (!res.ok) continue;
      const json: unknown = await res.json();
      const features = (json as { features?: unknown[] }).features ?? [];
      for (const f of features) {
        const feature = f as {
          properties?: {
            osm_id?: number;
            osm_type?: string;
            name?: string;
            osm_value?: string;
          };
          geometry?: { coordinates?: [number, number] };
        };
        const coords = feature.geometry?.coordinates;
        const name = feature.properties?.name;
        const osmId = feature.properties?.osm_id;
        const osmType = feature.properties?.osm_type;
        if (!coords || !name || !osmId || !osmType) continue;
        const [flon, flat] = coords;
        if (!Number.isFinite(flat) || !Number.isFinite(flon)) continue;
        const distanceKm = haversineKm(lat, lon, flat, flon);
        if (distanceKm > radius / 1000 + 0.3) continue; // keep it local
        const id = `${osmType}/${osmId}`;
        if (byId.has(id)) continue;
        byId.set(id, {
          id,
          name,
          lat: flat,
          lon: flon,
          amenity: feature.properties?.osm_value ?? tag,
          distanceKm,
        });
      }
    } catch {
      // this tag failed; keep whatever we collected
    }
  }
  const venues = [...byId.values()];
  return venues.length > 0 ? venues : null;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const lat = Number(url.searchParams.get("lat"));
  const lon = Number(url.searchParams.get("lon"));
  const radius = Math.min(
    5000,
    Math.max(300, Number(url.searchParams.get("radius")) || 1500),
  );
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
    return NextResponse.json({ error: "bad_params" }, { status: 400 });
  }

  const key = `${lat.toFixed(2)},${lon.toFixed(2)},${radius}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.ts < TTL_MS) {
    return NextResponse.json(hit.body);
  }

  const attempts: Array<{ mirror: string; outcome: string }> = [];
  let venues = await tryOverpass(lat, lon, radius, attempts);
  let source = "overpass";
  if (venues === null) {
    venues = await tryPhoton(lat, lon, radius);
    source = "photon-fallback";
  }

  if (venues === null) {
    return NextResponse.json(
      { error: "venue_sources_unavailable", attempts },
      { status: 502 },
    );
  }

  venues.sort((a, b) => a.distanceKm - b.distanceKm);
  const body = { venues: venues.slice(0, 24), source };
  cachePut(key, body);
  return NextResponse.json(body);
}
