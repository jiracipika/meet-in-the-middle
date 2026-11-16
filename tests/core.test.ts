import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeMeeting, fairnessScore, haversineKm } from '../src/lib/geo';
import { decodeState, encodeState } from '../src/lib/share';
import { parseCoords } from '../src/components/PersonCard';

test('meeting modes preserve midpoint, colocated and antimeridian behavior', () => {
  for (const mode of ['median', 'minmax', 'centroid'] as const) {
    const center = computeMeeting([{ lat: 0, lon: -1, weight: 1 }, { lat: 0, lon: 1, weight: 1 }], mode);
    assert.ok(haversineKm(center, { lat: 0, lon: 0 }) < 0.001);
    const same = computeMeeting([{ lat: 43.65, lon: -79.38, weight: 1 }, { lat: 43.65, lon: -79.38, weight: 1 }], mode);
    assert.ok(haversineKm(same, { lat: 43.65, lon: -79.38 }) < 0.001);
    const across = computeMeeting([{ lat: 0, lon: 179, weight: 1 }, { lat: 0, lon: -179, weight: 1 }], mode);
    assert.ok(Math.abs(across.lon) > 179);
  }
  assert.equal(fairnessScore([0, 0]), 100);
  assert.equal(fairnessScore([10, 10]), 100);
});
test('priorities influence weighted modes but not min-max', () => {
  const equal = [{lat:0,lon:0,weight:1},{lat:0,lon:10,weight:1}];
  const weighted = [{lat:0,lon:0,weight:2},{lat:0,lon:10,weight:1}];
  assert.ok(computeMeeting(weighted, 'median').lon < computeMeeting(equal, 'median').lon);
  assert.ok(computeMeeting(weighted, 'centroid').lon < computeMeeting(equal, 'centroid').lon);
  assert.deepEqual(computeMeeting(weighted, 'minmax'), computeMeeting(equal, 'minmax'));
});
test('shared links round-trip Unicode and ignore malformed records safely', () => {
  const state = {p:[{n:'Zoë 🌿',label:'Montréal',lat:45.5,lon:-73.6,w:1.5}],m:'centroid' as const,v:{name:'Café',lat:45.51,lon:-73.61}};
  assert.deepEqual(decodeState(encodeState(state)), {...state,v:{...state.v,amenity:undefined}});
  const bad = btoa(JSON.stringify({p:[null,{}, {lat:95,lon:0}, {lat:0,lon:0,n:[],label:{},w:'x'}],m:'oops',v:{lat:2,lon:3,name:[]}}));
  assert.deepEqual(decodeState(bad), {p:[{lat:0,lon:0,n:undefined,label:undefined,w:1}]});
  assert.equal(decodeState('not a valid link!'),null);
  assert.equal(decodeState('a'.repeat(17000)),null);
});
test('coordinate parsing validates ranges and supports signed values', () => {
  assert.equal(parseCoords('91, 0'), null);
  assert.equal(parseCoords('0, -181'), null);
  assert.equal(parseCoords('Toronto'), null);
  assert.equal(parseCoords('+43.65; -79.38')?.lon,-79.38);
});
