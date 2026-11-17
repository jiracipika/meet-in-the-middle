import { corsJson, corsPreflight } from "@/lib/cors";
import { ALL_VENUE_TAGS, DEFAULT_VENUE_CAT, VENUE_CATEGORIES, catForTag, type VenueCat, type VenueTagSets } from "@/lib/venueCats";
import type { Venue } from "@/lib/types";
import OpeningHours from "opening_hours";

/**
 * Venue lookup around a point — the "Find a spot" backend.
 *
 * Browsing (cat only): Overpass primary with the category's tag sets, Photon
 * POI fallback when every mirror is down. Name search (q): Photon primary
 * (case-insensitive, fuzzy, location-biased — exactly right for "that ramen
 * place"), with an Overpass per-letter-character-class fallback. Enriches
 * results with the browse category and an open/closed evaluation of OSM
 * opening_hours when the tags are available.
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
const MIRROR_TIMEOUT_MS = 10_000;

type CacheEntry = { ts: number; body: unknown };
const cache = new Map<string, CacheEntry>();

const TAG_KEYS = ["amenity", "leisure", "tourism"] as const;
type TagKey = (typeof TAG_KEYS)[number];

type OsmTags = Partial<Record<TagKey | "name" | "cuisine" | "opening_hours", string>>;

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

/** Turns a raw Overpass element into a Venue (with category + openNow when tags allow). */
function fromOsmElement(el: unknown, lat: number, lon: number): Venue | null {
  const e = el as {
    type?: string;
    id?: number;
    lat?: number;
    lon?: number;
    center?: { lat: number; lon: number };
    tags?: OsmTags;
  };
  const vLat = e.lat ?? e.center?.lat;
  const vLon = e.lon ?? e.center?.lon;
  const name = e.tags?.name;
  if (vLat === undefined || vLon === undefined || !name || !e.id || !e.type) {
    return null;
  }
  const tags = e.tags ?? {};
  const tagKey = TAG_KEYS.find(key => tags[key]);
  const value = tagKey ? tags[tagKey] : undefined;
  return {
    id: `${e.type}/${e.id}`,
    name,
    lat: vLat,
    lon: vLon,
    amenity: value ?? "place",
    cuisine: tags.cuisine?.split(";")[0],
    distanceKm: haversineKm(lat, lon, vLat, vLon),
    category: tagKey && value ? catForTag(tagKey, value) : undefined,
    openNow: evaluateOpen(tags.opening_hours, vLat, vLon),
  };
}

function evaluateOpen(hours: string | undefined, lat: number, lon: number): boolean | undefined {
  if (!hours) return undefined;
  try {
    // Venue coords make sunrise/sunset-style hours meaningful.
    const oh = new OpeningHours(hours, { lat: String(lat), lon: String(lon) });
    if (oh.getUnknown(new Date())) return undefined;
    return oh.getState(new Date());
  } catch {
    return undefined;
  }
}

function buildQuery(lat: number, lon: number, radius: number, tags: VenueTagSets, nameClasses: string | null): string {
  const clauses = TAG_KEYS.map(key => {
    const values = tags[key];
    if (!values?.length) return null;
    const nameFilter = nameClasses ? `[name~"${nameClasses}"]` : "";
    return `nwr(around:${radius},${lat},${lon})[${key}~"^(${values.join("|")})$"]${nameFilter};`;
  }).filter((c): c is string => c !== null);
  return `[out:json][timeout:20];(${clauses.join("")});out center tags 80;`;
}

async function tryOverpass(
  query: string,
  lat: number,
  lon: number,
  attempts: Array<{ mirror: string; outcome: string }>,
): Promise<Venue[] | null> {
  // All mirrors in parallel (they are independent services); first healthy
  // one in preference order wins. Worst case ~MIRROR_TIMEOUT_MS total.
  const settled = await Promise.allSettled(
    MIRRORS.map(async (mirror): Promise<Venue[]> => {
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
        throw new Error(`http_${res.status}`);
      }
      const json: unknown = await res.json();
      const elements = (json as { elements?: unknown[] }).elements ?? [];
      const venues: Venue[] = [];
      for (const el of elements) {
        const v = fromOsmElement(el, lat, lon);
        if (v) venues.push(v);
      }
      return venues;
    }),
  );

  for (let i = 0; i < MIRRORS.length; i++) {
    const r = settled[i];
    if (r.status === "fulfilled") return r.value;
    const reason =
      r.reason instanceof Error ? r.reason.message : "fetch_failed";
    attempts.push({ mirror: MIRRORS[i], outcome: reason });
  }
  return null;
}

/**
 * Fallback: Photon POI search per category tag. Photon (like Overpass,
 * OSM-based) runs on separate infrastructure and supports amenity-tag filters
 * with a location bias; we filter by true distance afterwards.
 */
async function tryPhotonByTags(
  lat: number,
  lon: number,
  radius: number,
  cat: VenueCat,
): Promise<Venue[] | null> {
  const { [cat]: category } = VENUE_CATEGORIES;
  const searches: Array<[string, TagKey, string]> = [];
  for (const key of TAG_KEYS) {
    for (const value of category[key] ?? []) searches.push([value, key, value.replaceAll("_", " ")]);
  }
  const byId = new Map<string, Venue>();
  for (const [tag, key, term] of searches) {
    try {
      const url = new URL("https://photon.komoot.io/api/");
      url.searchParams.set("q", term);
      url.searchParams.set("lat", String(lat));
      url.searchParams.set("lon", String(lon));
      url.searchParams.set("limit", "15");
      url.searchParams.set("osm_tag", `${key}:${tag}`);
      const res = await fetch(url, {
        headers: { "User-Agent": UA, Accept: "application/json" },
        signal: AbortSignal.timeout(8_000),
        cache: "no-store",
      });
      if (!res.ok) continue;
      collectPhotonFeatures(await res.json(), { lat, lon, radius, byId, fallbackTag: { key, value: tag } });
    } catch {
      // this tag failed; keep whatever we collected
    }
  }
  const venues = [...byId.values()];
  return venues.length > 0 ? venues : null;
}

/**
 * Primary name search: free-text Photon with a location bias. Filters out
 * non-POI hits (streets, suburbs, addresses) so results stay pickable.
 */
async function tryPhotonByName(
  lat: number,
  lon: number,
  radius: number,
  q: string,
): Promise<Venue[] | null> {
  try {
    const url = new URL("https://photon.komoot.io/api/");
    url.searchParams.set("q", q);
    url.searchParams.set("lat", String(lat));
    url.searchParams.set("lon", String(lon));
    url.searchParams.set("limit", "25");
    const res = await fetch(url, {
      headers: { "User-Agent": UA, Accept: "application/json" },
      signal: AbortSignal.timeout(8_000),
      cache: "no-store",
    });
    if (!res.ok) return null;
    const byId = new Map<string, Venue>();
    collectPhotonFeatures(await res.json(), { lat, lon, radius, byId });
    const venues = [...byId.values()];
    return venues.length > 0 ? venues : null;
  } catch {
    return null;
  }
}

type PhotonCollectArgs = {
  lat: number;
  lon: number;
  radius: number;
  byId: Map<string, Venue>;
  /** used by the per-tag fallback when features carry no osm_key/osm_value */
  fallbackTag?: { key: TagKey; value: string };
};

const PHOTON_POI_KEYS = new Set<TagKey | "shop" | "historic">(["amenity", "leisure", "tourism", "shop", "historic"]);

function collectPhotonFeatures(json: unknown, { lat, lon, radius, byId, fallbackTag }: PhotonCollectArgs) {
  const features = (json as { features?: unknown[] }).features ?? [];
  for (const f of features) {
    const feature = f as {
      properties?: { osm_id?: number; osm_type?: string; osm_key?: string; osm_value?: string; name?: string };
      geometry?: { coordinates?: [number, number] };
    };
    const coords = feature.geometry?.coordinates;
    const name = feature.properties?.name;
    const osmId = feature.properties?.osm_id;
    const osmType = feature.properties?.osm_type;
    const osmKey = feature.properties?.osm_key as TagKey | "shop" | "historic" | undefined;
    const osmValue = feature.properties?.osm_value;
    if (!coords || !name || !osmId || !osmType) continue;
    const key = PHOTON_POI_KEYS.has(osmKey as TagKey) ? (osmKey as TagKey) : null;
    const value = key && osmValue ? osmValue : fallbackTag?.value;
    const usedKey = key ?? fallbackTag?.key;
    if (!usedKey || !value) continue; // street/suburb/address hits: not pickable places
    const [flon, flat] = coords;
    if (!Number.isFinite(flat) || !Number.isFinite(flon)) continue;
    const distanceKm = haversineKm(lat, lon, flat, flon);
    if (distanceKm > radius / 1000 + 0.5) continue; // keep it local
    const id = `${osmType}/${osmId}`;
    if (byId.has(id)) continue;
    byId.set(id, {
      id,
      name,
      lat: flat,
      lon: flon,
      amenity: value,
      distanceKm,
      category: catForTag(usedKey as TagKey, value),
    });
  }
}

/** Overpass is case-sensitive regex only — build per-letter character classes ("ramen" -> [rR][aA]...). */
export function nameClassesFor(q: string): string | null {
  const cleaned = q.replace(/[^\p{L}\p{N} ]/gu, "").trim();
  if (cleaned.replace(/ /g, "").length < 2) return null;
  return cleaned
    .split(/ +/)
    .map(word =>
      word
        .split("")
        .map(ch => (/[\p{L}\p{N}]/u.test(ch) ? `[${ch.toLowerCase()}${ch.toUpperCase()}]` : ""))
        .join(""),
    )
    .join(".*");
}

/** Query sanitization shared by browse and search: keep it a plain name fragment. */
export function sanitizeQuery(raw: string): string {
  return raw.replace(/\s+/g, " ").replace(/[^\p{L}\p{N} '\-.]/gu, "").trim().slice(0, 60);
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const latRaw = url.searchParams.get("lat");
  const lonRaw = url.searchParams.get("lon");
  const lat = Number(latRaw);
  const lon = Number(lonRaw);
  const catRaw = url.searchParams.get("cat");
  const qRaw = sanitizeQuery(url.searchParams.get("q") ?? "");
  if (
    catRaw !== null &&
    (!Object.hasOwn(VENUE_CATEGORIES, catRaw))
  ) {
    return corsJson(request, { error: "bad_category" }, { status: 400 });
  }
  const cat: VenueCat = (catRaw as VenueCat | null) ?? DEFAULT_VENUE_CAT;
  const radius = Math.min(
    5000,
    Math.max(300, Number(url.searchParams.get("radius")) || VENUE_CATEGORIES[cat].radius),
  );
  if (
    !latRaw?.trim() ||
    !lonRaw?.trim() ||
    !Number.isFinite(lat) ||
    !Number.isFinite(lon) ||
    Math.abs(lat) > 90 ||
    Math.abs(lon) > 180
  ) {
    return corsJson(request, { error: "bad_params" }, { status: 400 });
  }
  const searching = qRaw.length >= 2;

  const key = `${lat.toFixed(5)},${lon.toFixed(5)},${radius},${cat}${searching ? `,q:${qRaw.toLowerCase()}` : ""}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.ts < TTL_MS) {
    return corsJson(request, hit.body);
  }

  const attempts: Array<{ mirror: string; outcome: string }> = [];
  let venues: Venue[] | null;
  let source: string;
  if (searching) {
    venues = await tryPhotonByName(lat, lon, radius, qRaw);
    source = "photon-search";
    if (venues === null) {
      const classes = nameClassesFor(qRaw);
      venues = classes ? await tryOverpass(buildQuery(lat, lon, radius, ALL_VENUE_TAGS, classes), lat, lon, attempts) : null;
      source = "overpass-name-fallback";
    }
  } else {
    venues = await tryOverpass(buildQuery(lat, lon, radius, VENUE_CATEGORIES[cat], null), lat, lon, attempts);
    source = "overpass";
    if (venues === null) {
      venues = await tryPhotonByTags(lat, lon, radius, cat);
      source = "photon-fallback";
    }
  }

  if (venues === null) {
    return corsJson(
      request,
      { error: "venue_sources_unavailable", attempts },
      { status: 502 },
    );
  }

  venues.sort((a, b) => a.distanceKm - b.distanceKm);
  const body = { venues: venues.slice(0, 24), source };
  cachePut(key, body);
  return corsJson(request, body);
}

export function OPTIONS(request: Request) {
  return corsPreflight(request);
}
