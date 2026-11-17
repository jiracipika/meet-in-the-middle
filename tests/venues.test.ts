import { test } from 'node:test';
import assert from 'node:assert/strict';

/** Handler-level tests for /api/venues: stub the upstream fetch, keep the cache keys unique per test. */

function overpassElements(elements: unknown[]) {
  return new Response(JSON.stringify({ elements }), { status: 200, headers: { 'Content-Type': 'application/json' } });
}

test('venues route rejects unknown categories before contacting providers', async () => {
  const { GET } = await import('../src/app/api/venues/route');
  const res = await GET(new Request('http://localhost/api/venues?lat=1&lon=1&cat=nightclub'));
  assert.equal(res.status, 400);
  assert.equal((await res.json()).error, 'bad_category');
});

test('venues route browses with category tag sets and per-category radius', async () => {
  const previousFetch = globalThis.fetch;
  let overpassBody = '';
  globalThis.fetch = (async (_input: RequestInfo | URL, init?: RequestInit) => {
    overpassBody = new URLSearchParams(String(init?.body ?? '')).get('data') ?? '';
    return overpassElements([]);
  }) as typeof fetch;
  try {
    const { GET } = await import('../src/app/api/venues/route');
    const res = await GET(new Request('http://localhost/api/venues?lat=52.51&lon=13.4&cat=outdoors'));
    assert.equal(res.status, 200);
    assert.ok(overpassBody.includes('leisure~"^(park|garden|playground)$"'), overpassBody);
    assert.ok(overpassBody.includes('around:3000'), overpassBody);
    assert.ok(!overpassBody.includes('amenity~'), overpassBody);
  } finally { globalThis.fetch = previousFetch; }
});

test('venues route name search prefers Photon, filters streets and labels categories', async () => {
  const previousFetch = globalThis.fetch;
  const calls: string[] = [];
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    const url = String(input);
    calls.push(url);
    if (url.includes('photon')) {
      return new Response(JSON.stringify({ features: [
        { properties: { osm_id: 1, osm_type: 'N', osm_key: 'amenity', osm_value: 'restaurant', name: 'Ramen Bar' }, geometry: { coordinates: [13.41, 52.512] } },
        { properties: { osm_id: 2, osm_type: 'W', osm_key: 'highway', name: 'Berliner Straße' }, geometry: { coordinates: [13.41, 52.513] } },
      ] }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }
    return overpassElements([]);
  }) as typeof fetch;
  try {
    const { GET } = await import('../src/app/api/venues/route');
    const res = await GET(new Request('http://localhost/api/venues?lat=52.51&lon=13.4&q=ramen'));
    const body = await res.json() as { source: string; venues: { name: string; category: string }[] };
    assert.equal(res.status, 200);
    assert.equal(body.source, 'photon-search');
    assert.ok(calls.some(c => c.includes('photon') && c.includes('q=ramen')));
    assert.deepEqual(body.venues.map(v => v.name), ['Ramen Bar']); // the street hit is filtered out
    assert.equal(body.venues[0].category, 'food');
  } finally { globalThis.fetch = previousFetch; }
});

test('venues route falls back to Overpass letter classes when Photon search is empty', async () => {
  const previousFetch = globalThis.fetch;
  let overpassBody = '';
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    if (url.includes('photon')) {
      return new Response(JSON.stringify({ features: [] }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }
    overpassBody = new URLSearchParams(String(init?.body ?? '')).get('data') ?? '';
    return overpassElements([]);
  }) as typeof fetch;
  try {
    const { GET } = await import('../src/app/api/venues/route');
    const res = await GET(new Request('http://localhost/api/venues?lat=52.51&lon=13.4&q=Ra+Men!'));
    assert.equal(res.status, 200);
    assert.ok(overpassBody.includes('[name~"[rR][aA].*[mM][eE][nN]"]'), overpassBody);
  } finally { globalThis.fetch = previousFetch; }
});

test('venues route evaluates opening_hours and keeps unparseable ones unknown', async () => {
  const previousFetch = globalThis.fetch;
  globalThis.fetch = (async () =>
    overpassElements([
      { type: 'node', id: 11, lat: 52.512, lon: 13.401, tags: { name: 'Always Open Café', amenity: 'cafe', opening_hours: '24/7' } },
      { type: 'node', id: 12, lat: 52.512, lon: 13.402, tags: { name: 'Odd Hours Bar', amenity: 'bar', opening_hours: 'definitely not hours' } },
      { type: 'node', id: 13, lat: 52.512, lon: 13.403, tags: { name: 'No Hours Park', leisure: 'park' } },
    ])
  ) as typeof fetch;
  try {
    const { GET } = await import('../src/app/api/venues/route');
    const res = await GET(new Request('http://localhost/api/venues?lat=52.512&lon=13.40&cat=food&radius=800'));
    const body = await res.json() as { venues: { name: string; openNow?: boolean; category?: string }[] };
    const byName = Object.fromEntries(body.venues.map(v => [v.name, v]));
    assert.equal(byName['Always Open Café'].openNow, true);
    assert.equal(byName['Odd Hours Bar'].openNow, undefined); // unparseable -> unknown, not wrong
    assert.equal(byName['No Hours Park'].openNow, undefined); // no opening_hours tag
    assert.equal(byName['No Hours Park'].category, 'outdoors'); // leisure tag still categorizes
  } finally { globalThis.fetch = previousFetch; }
});

test('query helpers sanitize input and build per-letter classes', async () => {
  const { sanitizeQuery, nameClassesFor } = await import('../src/app/api/venues/route');
  assert.equal(sanitizeQuery('  Ramen   "Bar" (best)! '), 'Ramen Bar best');
  assert.equal(sanitizeQuery('café-nord'), 'café-nord');
  assert.equal(nameClassesFor('Ramen Bar!'), '[rR][aA][mM][eE][nN].*[bB][aA][rR]');
  assert.equal(nameClassesFor('a'), null); // too short to search
});
