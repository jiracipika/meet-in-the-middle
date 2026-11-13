# Meet in the Middle

Enter up to 6 addresses and find a meeting spot that is central **and fair** for
everyone — with a live map, per-person travel stats, a fairness score, and
nearby café/restaurant suggestions.

## How it picks the spot

Three modes, all computed client-side on the sphere (works from city-scale to
intercontinental):

| Mode | What it does |
| --- | --- |
| **Fairest** | Weighted geometric median (Weiszfeld iteration in 3D, re-projected to the sphere). Minimizes total travel — the classic "fair" meeting point. |
| **Min max trip** | Center of the smallest sphere enclosing everyone (exact brute-force over support subsets, at most 6 points), projected to the surface. Keeps the *longest* single trip as short as possible. |
| **Average** | Weighted spherical centroid. The center of gravity. |

Each person has a **pull** slider (0.5x – 2x weight). Higher pull moves the spot
toward that person — for the friend without a car or with a tight schedule.

Distances are straight-line (haversine); drive times are rough estimates
(route-factor heuristics). The gold meeting marker is **draggable** for
fine-tuning, and "Cafes & food nearby" lists OSM venues around the spot.

The whole session is shareable: **Share link** encodes people, weights, mode,
and chosen venue into the URL hash.

## Data sources (all keyless)

- Geocoding: [Photon](https://photon.komoot.io) (OpenStreetMap-based) via
  `/api/geocode` proxy with a short-lived cache. You can also paste raw
  `lat, lon` coordinates into an address field.
- Venues: [Overpass API](https://overpass-api.de) via `/api/venues` with
  3-mirror fallback and caching.
- Basemap: Esri World Dark Gray Canvas tiles.
- Built with Next.js 16, React 19, Leaflet, Tailwind CSS v4, Motion.

## Develop

```bash
npm install
npm run dev     # http://localhost:3000
npm run build && npm start
```

## Notes & limits

- Straight-line distances, not routing distances (that would need a
  routing API key).
- Public Photon/Overpass endpoints are rate-limited and occasionally busy;
  the venue search retries across mirrors and reports errors honestly.
- For intercontinental spreads the "min max trip" mode approximates (chord
  space) and falls back to the centroid when the minimal enclosing sphere is
  the globe itself.
