import { NextResponse } from "next/server";

/**
 * Venue lookup around a point via Overpass (OpenStreetMap). The public
 * Overpass instances are busy, so we try mirrors in order.
 */

const MIRRORS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
  "https://overpass.private.coffee/api/interpreter",
];

const UA =
  "meet-in-the-middle/1.0 (https://github.com/jiracipika/meet-in-the-middle; Vercel serverless)";
const TTL_MS = 15 * 60_000;
const MAX_ENTRIES = 120;

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

  const query = `[out:json][timeout:25];nwr(around:${radius},${lat},${lon})[amenity~"^(cafe|restaurant|bar|fast_food|food_court|ice_cream)$"];out center tags 80;`;

  let lastError = "overpass_unavailable";
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
        signal: AbortSignal.timeout(22_000),
        cache: "no-store",
      });
      if (!res.ok) {
        lastError = `overpass_${res.status}`;
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
      venues.sort((a, b) => a.distanceKm - b.distanceKm);
      const body = { venues: venues.slice(0, 24), mirror };
      if (cache.size >= MAX_ENTRIES) {
        const oldest = cache.keys().next().value;
        if (oldest !== undefined) cache.delete(oldest);
      }
      cache.set(key, { ts: Date.now(), body });
      return NextResponse.json(body);
    } catch {
      // try the next mirror
    }
  }
  return NextResponse.json({ error: lastError }, { status: 502 });
}
