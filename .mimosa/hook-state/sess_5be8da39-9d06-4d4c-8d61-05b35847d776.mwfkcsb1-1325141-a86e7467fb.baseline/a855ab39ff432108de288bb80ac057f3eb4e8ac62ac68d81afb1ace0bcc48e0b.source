import type { LatLng, Mode } from "./types";

/**
 * All spherical math here works on 3D unit vectors so it stays correct for any
 * spread of addresses (city-scale or intercontinental).
 */

type Vec3 = [number, number, number];

export type WeightedPoint = LatLng & { weight: number };

const EARTH_RADIUS_KM = 6371;
const DEG = Math.PI / 180;

export function haversineKm(a: LatLng, b: LatLng): number {
  const dLat = (b.lat - a.lat) * DEG;
  const dLon = (b.lon - a.lon) * DEG;
  const sinLat = Math.sin(dLat / 2);
  const sinLon = Math.sin(dLon / 2);
  const h =
    sinLat * sinLat +
    Math.cos(a.lat * DEG) * Math.cos(b.lat * DEG) * sinLon * sinLon;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(h)));
}

function toVec(p: LatLng): Vec3 {
  const lat = p.lat * DEG;
  const lon = p.lon * DEG;
  return [
    Math.cos(lat) * Math.cos(lon),
    Math.cos(lat) * Math.sin(lon),
    Math.sin(lat),
  ];
}

function normalize(v: Vec3): Vec3 {
  const len = Math.hypot(v[0], v[1], v[2]) || 1;
  return [v[0] / len, v[1] / len, v[2] / len];
}

function toLatLng(v: Vec3): LatLng {
  const [x, y, z] = normalize(v);
  return {
    lat: Math.asin(Math.max(-1, Math.min(1, z))) / DEG,
    lon: Math.atan2(y, x) / DEG,
  };
}

function dist3(a: Vec3, b: Vec3): number {
  return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
}

function dot3(a: Vec3, b: Vec3): number {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}

function cross3(a: Vec3, b: Vec3): Vec3 {
  return [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0],
  ];
}

/** Weighted spherical centroid: normalize(sum(w_i * p_i)). */
export function weightedCentroid(points: WeightedPoint[]): LatLng {
  const acc: Vec3 = [0, 0, 0];
  for (const p of points) {
    const v = toVec(p);
    acc[0] += v[0] * p.weight;
    acc[1] += v[1] * p.weight;
    acc[2] += v[2] * p.weight;
  }
  return toLatLng(acc);
}

/**
 * Weighted geometric median via Weiszfeld iteration in 3D chord space,
 * re-projected onto the sphere after every step. Minimizes (approximately,
 * for spherical geometry) sum(w_i * great-circle distance). This is the
 * "fairest" point: nobody's travel is sacrificed more than necessary.
 */
export function geometricMedian(points: WeightedPoint[]): LatLng {
  if (points.length === 1) return { lat: points[0].lat, lon: points[0].lon };
  let x = weightedCentroid(points);
  const vecs = points.map((p) => toVec(p));
  for (let iter = 0; iter < 200; iter++) {
    const xv = toVec(x);
    const num: Vec3 = [0, 0, 0];
    let den = 0;
    let coincides = false;
    for (let i = 0; i < points.length; i++) {
      const d = dist3(xv, vecs[i]);
      if (d < 1e-9) {
        coincides = true; // median sits exactly on a data point
        break;
      }
      const k = points[i].weight / d;
      num[0] += k * vecs[i][0];
      num[1] += k * vecs[i][1];
      num[2] += k * vecs[i][2];
      den += k;
    }
    if (coincides || den === 0) break;
    const next = toLatLng([num[0] / den, num[1] / den, num[2] / den]);
    const moved = haversineKm(next, x);
    x = next;
    if (moved < 1e-7) break;
  }
  return x;
}

/** Gaussian elimination with partial pivoting for 3x3 systems. */
function solve3(m: number[][], v: number[]): Vec3 | null {
  const a = m.map((row, i) => [...row, v[i]]);
  for (let col = 0; col < 3; col++) {
    let piv = col;
    for (let r = col + 1; r < 3; r++) {
      if (Math.abs(a[r][col]) > Math.abs(a[piv][col])) piv = r;
    }
    if (Math.abs(a[piv][col]) < 1e-12) return null;
    [a[col], a[piv]] = [a[piv], a[col]];
    for (let r = 0; r < 3; r++) {
      if (r === col) continue;
      const f = a[r][col] / a[col][col];
      for (let c = col; c < 4; c++) a[r][c] -= f * a[col][c];
    }
  }
  return [
    a[0][3] / a[0][0],
    a[1][3] / a[1][1],
    a[2][3] / a[2][2],
  ];
}

/**
 * Minimal sphere through 2, 3 or 4 given points (null if degenerate).
 * Equidistance gives, for each pair (p0, pi):
 *   d·O = d·p0 + |d|²/2   with d = pi - p0
 */
function sphereFrom(pts: Vec3[]): { c: Vec3; r: number } | null {
  const n = pts.length;
  if (n === 1) return { c: [...pts[0]] as Vec3, r: 0 };
  if (n === 2) {
    const c: Vec3 = [
      (pts[0][0] + pts[1][0]) / 2,
      (pts[0][1] + pts[1][1]) / 2,
      (pts[0][2] + pts[1][2]) / 2,
    ];
    return { c, r: dist3(c, pts[0]) };
  }
  const p0 = pts[0];
  const rows: { d: Vec3; rhs: number }[] = [];
  for (let i = 1; i < Math.min(n, 4); i++) {
    const d: Vec3 = [
      pts[i][0] - p0[0],
      pts[i][1] - p0[1],
      pts[i][2] - p0[2],
    ];
    rows.push({ d, rhs: dot3(d, p0) + dot3(d, d) / 2 });
  }
  if (rows.length === 2) {
    // triangle: add the plane constraint n·O = n·p0
    const nrm = cross3(rows[0].d, rows[1].d);
    rows.push({ d: nrm, rhs: dot3(nrm, p0) });
  }
  const sol = solve3(
    rows.map((r) => [r.d[0], r.d[1], r.d[2]]),
    rows.map((r) => r.rhs),
  );
  if (!sol) return null;
  const c: Vec3 = [sol[0], sol[1], sol[2]];
  const r = dist3(c, p0);
  if (!Number.isFinite(r) || r < 0) return null;
  return { c, r };
}

/**
 * Center of the smallest sphere enclosing all points (3D chord space),
 * projected back onto the sphere. With at most 6 points we brute-force all
 * subsets of size 1..4 (the boundary of a minimal sphere has at most 4 points),
 * which is exact. Used for the "min max trip" mode: the spot that keeps the
 * longest single trip as short as possible.
 */
export function minMaxCenter(points: WeightedPoint[]): LatLng {
  if (points.length === 1) return { lat: points[0].lat, lon: points[0].lon };
  const vecs = points.map((p) => toVec(p));
  const candidates: Array<{ c: Vec3; r: number }> = [];
  const n = vecs.length;
  for (let mask = 1; mask < 1 << n; mask++) {
    const subset: Vec3[] = [];
    for (let i = 0; i < n; i++) if (mask & (1 << i)) subset.push(vecs[i]);
    if (subset.length > 4) continue;
    const s = sphereFrom(subset);
    if (s) candidates.push(s);
  }
  // all points sit on the unit sphere, so it is always a valid candidate
  candidates.push({ c: [0, 0, 0], r: 1 });

  let best: { c: Vec3; r: number } | null = null;
  for (const cand of candidates) {
    if (!vecs.every((p) => dist3(p, cand.c) <= cand.r + 1e-7)) continue;
    if (best === null || cand.r < best.r) best = cand;
  }
  if (best === null) return weightedCentroid(points);
  if (Math.hypot(best.c[0], best.c[1], best.c[2]) < 1e-6) {
    // minimal sphere is the globe itself (huge spread): center is undefined on
    // the surface, fall back to the centroid as a sensible surface point
    return weightedCentroid(points);
  }
  return toLatLng(best.c);
}

export function computeMeeting(points: WeightedPoint[], mode: Mode): LatLng {
  if (points.length === 0) throw new Error("computeMeeting needs points");
  switch (mode) {
    case "median":
      return geometricMedian(points);
    case "minmax":
      return minMaxCenter(points);
    case "centroid":
      return weightedCentroid(points);
  }
}

/**
 * Rough door-to-door travel estimates from straight-line distance.
 * Route factors are crude but honest enough for comparing options.
 */
export function estimateTravel(km: number) {
  const driveMin = Math.round(((km * 1.3) / 34) * 60);
  const transitMin = Math.round(((km * 1.25) / 22) * 60);
  const bikeMin = Math.round(((km * 1.2) / 16) * 60);
  const walkMin = Math.round(((km * 1.2) / 4.8) * 60);
  return { driveMin, transitMin, bikeMin, walkMin };
}

/**
 * Balance score 0-100: 100 means everyone travels the same distance.
 * Spread measured relative to the mean trip.
 */
export function fairnessScore(distancesKm: number[]): number {
  if (distancesKm.length < 2) return 100;
  const mean = distancesKm.reduce((s, d) => s + d, 0) / distancesKm.length;
  if (mean < 1e-6) return 100;
  const spread = Math.max(...distancesKm) - Math.min(...distancesKm);
  return Math.max(0, Math.min(100, Math.round(100 * (1 - spread / mean))));
}

/** Sensible fly-to zoom from how far the farthest person is. */
export function meetingZoom(maxDistKm: number): number {
  if (maxDistKm < 1) return 15;
  if (maxDistKm < 3) return 14;
  if (maxDistKm < 8) return 13;
  if (maxDistKm < 20) return 12;
  if (maxDistKm < 60) return 10;
  if (maxDistKm < 200) return 8;
  if (maxDistKm < 800) return 5;
  return 3;
}
