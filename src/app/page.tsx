"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import ShareDialog from "@/components/ShareDialog";
import Map from "@/components/Map";
import PersonCard from "@/components/PersonCard";
import ModeToggle from "@/components/ModeToggle";
import StatsPanel, { type PersonTrip, type Stats } from "@/components/StatsPanel";
import VenueBar, { type VenueState } from "@/components/VenueBar";
import { DEFAULT_VENUE_CAT, type VenueCat } from "@/lib/venueCats";
import { CrosshairIcon, PlusIcon, ShareIcon, SpeakerIcon, SpeakerOffIcon } from "@/components/icons";
import {
  computeMeeting,
  estimateTravel,
  fairnessScore,
  haversineKm,
} from "@/lib/geo";
import {
  initAudio,
  loadMuted,
  persistMuted,
  playSpotChime,
} from "@/lib/sound";
import { PERSON_COLORS, nextFreeColor } from "@/lib/palette";
import { decodeState, encodeState } from "@/lib/share";
import { apiUrl } from "@/lib/api";
import { copyText, shareBase, shareUrl as nativeShareUrl } from "@/lib/native";
import {
  MODE_LABELS,
  DEFAULT_NAMES,
  MAX_PEOPLE,
  type LatLng,
  type MeetingOverride,
  type Mode,
  type Person,
  type ShareState,
  type Venue,
} from "@/lib/types";

let uid = 0;
const newId = () => `p${++uid}`;

function makePerson(name: string, color: string): Person {
  return { id: newId(), name, color, place: null, weight: 1 };
}

/** Four hand-picked Berlin neighborhoods for instant demoing. */
const DEMO: Array<[string, number, number]> = [
  ["Prenzlauer Berg, Berlin", 52.5394, 13.405],
  ["Kreuzberg, Berlin", 52.4996, 13.4032],
  ["Charlottenburg, Berlin", 52.505, 13.306],
  ["Lichtenberg, Berlin", 52.5158, 13.4985],
];

export default function Home() {
  const [people, setPeople] = useState<Person[]>(() => [
    makePerson(DEFAULT_NAMES[0], PERSON_COLORS[0]),
    makePerson(DEFAULT_NAMES[1], PERSON_COLORS[1]),
  ]);
  const [mode, setMode] = useState<Mode>("median");
  const [override, setOverride] = useState<MeetingOverride | null>(null);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [venueSearch, setVenueSearch] = useState<{
    origin: LatLng;
    cat: VenueCat;
    q: string;
    venues: Venue[];
    state: VenueState;
  } | null>(null);
  const [venueCat, setVenueCat] = useState<VenueCat>(DEFAULT_VENUE_CAT);
  const [venueQuery, setVenueQuery] = useState("");
  const [copied, setCopied] = useState(false);
  const [view, setView] = useState<"plan" | "map" | "results">("plan");
  const [shareUrl, setShareUrl] = useState("");
  const [notice, setNotice] = useState("");
  const venueRequest = useRef<AbortController | null>(null);
  const [fitVersion, setFitVersion] = useState(0);
  const [muted, setMuted] = useState(false);

  // Load the persisted sound preference after hydration (avoids mismatch),
  // and unlock Web Audio on the first user gesture.
  useEffect(() => {
    const t = setTimeout(() => setMuted(loadMuted()), 0);
    return () => clearTimeout(t);
  }, []);
  useEffect(() => {
    const init = () => initAudio();
    window.addEventListener("pointerdown", init);
    window.addEventListener("keydown", init);
    return () => {
      window.removeEventListener("pointerdown", init);
      window.removeEventListener("keydown", init);
    };
  }, []);

  // restore a shared link (deferred so hydration settles first)
  useEffect(() => {
    const hash = window.location.hash.replace(/^#/, "");
    if (!hash) return;
    const shared = decodeState(hash);
    if (!shared) return;
    const timer = setTimeout(() => {
      const restored: Person[] = shared.p
        .filter((sp) => Number.isFinite(sp.lat) && Number.isFinite(sp.lon))
        .slice(0, MAX_PEOPLE)
        .map((sp, i) => ({
          id: newId(),
          name: sp.n || DEFAULT_NAMES[i % DEFAULT_NAMES.length],
          color: PERSON_COLORS[i % PERSON_COLORS.length],
          place: { label: sp.label ?? `${sp.lat}, ${sp.lon}`, lat: sp.lat, lon: sp.lon },
          weight: typeof sp.w === "number" ? Math.min(2, Math.max(0.5, sp.w)) : 1,
        }));
      if (restored.length > 0) setPeople(restored);
      if (shared.m === "median" || shared.m === "minmax" || shared.m === "centroid") {
        setMode(shared.m);
      }
      if (
        shared.v &&
        Number.isFinite(shared.v.lat) &&
        Number.isFinite(shared.v.lon)
      ) {
        setOverride({
          label: shared.v.name,
          lat: shared.v.lat,
          lon: shared.v.lon,
          amenity: shared.v.amenity,
          pinnedAt: { lat: shared.v.lat, lon: shared.v.lon },
          sticky: true,
        });
      }
    }, 0);
    return () => clearTimeout(timer);
  }, []);

  /* ---------- derived ---------- */

  const placedPeople = useMemo(
    () =>
      people.filter(
        (p): p is Person & { place: NonNullable<Person["place"]> } =>
          p.place !== null,
      ),
    [people],
  );

  const points = useMemo(
    () =>
      placedPeople.map((p) => ({
        lat: p.place.lat,
        lon: p.place.lon,
        weight: p.weight,
      })),
    [placedPeople],
  );

  const meeting = useMemo(
    () => (points.length >= 2 ? computeMeeting(points, mode) : null),
    [points, mode],
  );

  // A pinned venue or drag is only kept while the calculated spot stays near
  // where it was pinned — pure derivation, no state syncing.
  const activeOverride = useMemo(() => {
    if (!meeting) return null;
    if (!override || override.sticky) return override;
    if (meeting && haversineKm(override.pinnedAt, meeting) > 1.5) return null;
    return override;
  }, [override, meeting]);

  const spot: LatLng | null = activeOverride ?? meeting;

  const venueInfo = useMemo((): {
    venues: Venue[];
    state: VenueState;
  } => {
    if (!venueSearch || !spot) return { venues: [], state: "idle" };
    if (haversineKm(venueSearch.origin, spot) > 0.1) {
      return { venues: [], state: "idle" };
    }
    return venueSearch;
  }, [venueSearch, spot]);

  /** The picked venue's row/dot: by id when pinned from results, by name when restored from a share link. */
  const activeVenueId = useMemo(() => {
    if (!activeOverride) return null;
    return activeOverride.venueId ?? venueInfo.venues.find(v => v.name === activeOverride.label)?.id ?? null;
  }, [activeOverride, venueInfo]);

  const spotDisplay = useMemo(() => {
    if (!spot) return null;
    return {
      lat: spot.lat,
      lon: spot.lon,
      label: activeOverride ? activeOverride.label : `${MODE_LABELS[mode]} spot`,
      sub: activeOverride
        ? `${activeOverride.amenity ? activeOverride.amenity.replace("_", " ") + " · " : ""}chosen spot`
        : "calculated meeting point",
    };
  }, [spot, activeOverride, mode]);

  const trips: PersonTrip[] = useMemo(() => {
    if (!spot) return [];
    return placedPeople.map((p) => {
      const km = haversineKm(spot, p.place);
      return {
        id: p.id,
        name: p.name,
        color: p.color,
        km,
        driveMin: estimateTravel(km).driveMin,
      };
    });
  }, [placedPeople, spot]);

  const stats: Stats | null = useMemo(() => {
    if (trips.length < 2) return null;
    const kms = trips.map((t) => t.km);
    const totalKm = kms.reduce((s, d) => s + d, 0);
    return {
      totalKm,
      avgKm: totalKm / kms.length,
      spreadKm: Math.max(...kms) - Math.min(...kms),
      maxKm: Math.max(...kms),
      fairness: fairnessScore(kms),
    };
  }, [trips]);

  const maxDistKm = useMemo(() => {
    if (!spot || placedPeople.length === 0) return 10;
    return Math.max(
      0.5,
      ...placedPeople.map((p) => haversineKm(spot, p.place)),
    );
  }, [spot, placedPeople]);

  const mapPeople = useMemo(
    () =>
      placedPeople.map((p) => ({
        id: p.id,
        name: p.name,
        color: p.color,
        lat: p.place.lat,
        lon: p.place.lon,
        label: p.place.label,
      })),
    [placedPeople],
  );

  const located = placedPeople.length;
  const needMore = located < 2;

  // Crisp chime when the meeting point appears or settles somewhere new —
  // debounced so slider drags don't machine-gun it, and only after it has
  // moved meaningfully (>50m).
  const lastSoundRef = useRef<LatLng | null>(null);
  const mutedRef = useRef(false);
  useEffect(() => {
    mutedRef.current = muted;
  }, [muted]);
  useEffect(() => {
    if (!meeting) {
      lastSoundRef.current = null;
      return;
    }
    const t = setTimeout(() => {
      const prev = lastSoundRef.current;
      const moved = prev ? haversineKm(prev, meeting) : Infinity;
      if (moved > 0.05 && !mutedRef.current) playSpotChime();
      lastSoundRef.current = meeting;
    }, 350);
    return () => clearTimeout(t);
  }, [meeting]);

  /* ---------- actions ---------- */

  const updatePerson = useCallback((id: string, patch: Partial<Person>) => {
    setPeople((ps) => ps.map((p) => (p.id === id ? { ...p, ...patch } : p)));
  }, []);

  const removePerson = useCallback((id: string) => {
    setPeople((ps) => (ps.length > 1 ? ps.filter((p) => p.id !== id) : ps));
  }, []);

  const addPerson = useCallback(() => {
    setPeople((ps) => {
      if (ps.length >= MAX_PEOPLE) return ps;
      const taken = ps.map((p) => p.color);
      const name =
        DEFAULT_NAMES.find((n) => !ps.some((p) => p.name === n)) ??
        `Friend ${ps.length + 1}`;
      return [...ps, makePerson(name, nextFreeColor(taken))];
    });
  }, []);

  const loadDemo = useCallback(() => {
    venueRequest.current?.abort();
    setPeople(
      DEMO.map(([label, lat, lon], i) => ({
        id: newId(),
        name: DEFAULT_NAMES[i],
        color: PERSON_COLORS[i],
        place: { label, lat, lon },
        weight: 1,
      })),
    );
    setOverride(null);
    setVenueSearch(null);
    setView("map");
  }, []);

  const findVenues = useCallback(async (cat: VenueCat = venueCat, q: string = venueQuery) => {
    if (!spot) return;
    venueRequest.current?.abort();
    const controller = new AbortController();
    venueRequest.current = controller;
    const origin = { ...spot };
    const params = new URLSearchParams({ lat: origin.lat.toFixed(5), lon: origin.lon.toFixed(5), cat });
    if (q.trim().length >= 2) params.set("q", q.trim());
    setVenueSearch({ origin, cat, q: q.trim(), venues: [], state: "loading" });
    try {
      const res = await fetch(apiUrl(`/api/venues?${params}`), {
        signal: AbortSignal.any([controller.signal, AbortSignal.timeout(55000)]),
      });
      if (!res.ok) throw new Error("venues_failed");
      const json: { venues?: Venue[] } = await res.json();
      if (!controller.signal.aborted) setVenueSearch({ origin, cat, q: q.trim(), venues: json.venues ?? [], state: "done" });
    } catch {
      if (!controller.signal.aborted) setVenueSearch({ origin, cat, q: q.trim(), venues: [], state: "error" });
    }
  }, [spot, venueCat, venueQuery]);

  // Typing or switching categories while the panel is open: refetch (debounced).
  const findVenuesRef = useRef(findVenues);
  useEffect(() => { findVenuesRef.current = findVenues; }, [findVenues]);
  useEffect(() => {
    if (!venueSearch || venueSearch.state === "idle") return;
    if (venueSearch.cat === venueCat && venueSearch.q === venueQuery.trim()) return;
    const t = setTimeout(() => findVenuesRef.current(venueCat, venueQuery), 400);
    return () => clearTimeout(t);
  }, [venueSearch, venueCat, venueQuery]);

  useEffect(() => () => venueRequest.current?.abort(), []);

  const pickVenue = useCallback(
    (v: Venue) => {
      setOverride({
        label: v.name,
        lat: v.lat,
        lon: v.lon,
        amenity: v.amenity,
        venueId: v.id,
        pinnedAt: meeting ?? { lat: v.lat, lon: v.lon },
      });
      setView("map");
    },
    [meeting],
  );

  const onSpotDrag = useCallback(
    (lat: number, lon: number) => {
      setOverride({
        label: "Your spot",
        lat,
        lon,
        pinnedAt: meeting ?? { lat, lon },
      });
    },
    [meeting],
  );

  async function share() {
    const state: ShareState = {
      p: placedPeople.map((p) => ({
        n: p.name,
        label: p.place.label,
        lat: p.place.lat,
        lon: p.place.lon,
        w: p.weight,
      })),
      m: mode,
      v: activeOverride
        ? {
            name: activeOverride.label,
            lat: activeOverride.lat,
            lon: activeOverride.lon,
            amenity: activeOverride.amenity,
          }
        : undefined,
    };
    setNotice("This link includes the names and locations you added.");
    const hash = encodeState(state);
    const url = `${shareBase()}#${hash}`;
    try { window.history.replaceState(null, "", `#${hash}`); } catch { /* app scheme: nothing to update */ }
    try {
      if (!(await nativeShareUrl(url))) {
        await copyText(url);
        setCopied(true);
        setTimeout(() => setCopied(false), 1800);
      }
    } catch {
      setShareUrl(url);
    }
  }

  const result = spot && stats && spotDisplay ? (
    <StatsPanel trips={trips} stats={stats} spot={{ ...spot, label: spotDisplay.label }}
      overrideActive={activeOverride !== null} onReset={activeOverride ? () => setOverride(null) : null} />
  ) : null;

  return (
    <div className="app-shell" data-view={view}>
      <header className="app-header">
        <Link className="brand" href="/" aria-label="Meet in the Middle home">
          <span className="brand-symbol" aria-hidden><span /><span /></span>
          <span>meet in the <strong>middle</strong><small>A little closer, together.</small></span>
        </Link>
        <div className="header-actions">
          <span className="header-note">Less planning. More catching up.</span>
          <button className="icon-button sound-button" onClick={() => { setMuted(!muted); persistMuted(!muted); }}
            aria-label={muted ? "Unmute sounds" : "Mute sounds"} aria-pressed={!muted}>
            {muted ? <SpeakerOffIcon /> : <SpeakerIcon />}
          </button>
          <button className="button primary" onClick={share} disabled={located < 2} aria-label="Share link">
            <ShareIcon /> {copied ? "Link copied" : "Share plan"}
          </button>
        </div>
      </header>

      <main className="workspace">
        <section className="planner" aria-label="Plan your meetup">
          <div className="planner-intro">
            <span className="eyebrow">GOOD COMPANY. FAIR JOURNEYS.</span>
            <h1>Your people.<br />Your meeting spot.</h1>
            <p>Start from different places.<br />Find somewhere to come together.</p>
          </div>
          <div className="section-heading"><h2>Who’s coming?</h2><span>{people.length} / {MAX_PEOPLE} people</span></div>
          <div className="people-list">
            {people.map((p, i) => <PersonCard key={p.id} person={p} index={i} canRemove={people.length > 2}
              bias={meeting} weightsEnabled={mode !== "minmax"}
              onChange={(patch) => updatePerson(p.id, patch)} onRemove={() => removePerson(p.id)} onHover={setHoveredId} />)}
          </div>
          <button className="button add-person" onClick={addPerson} disabled={people.length >= MAX_PEOPLE}>
            <PlusIcon /> {people.length >= MAX_PEOPLE ? "Your group is full" : "Add a friend"}
          </button>
          <div className="mode-section"><div className="section-heading"><h2>Find your middle</h2><span>03 ways to meet</span></div>
            <ModeToggle mode={mode} onChange={(next) => { setMode(next); setOverride(null); }} />
          </div>
          <div className="planner-status" role="status"><span className={needMore ? "status-dot" : "status-dot ready"} />
            {needMore ? `${located} of 2 starting points added` : `${located} people located · your spot is ready`}
          </div>
          <button className="button primary mobile-show-map" onClick={() => setView("map")} disabled={needMore}>See our meeting spot →</button>
          <div className="planner-footer"><span>No account. Just good company.</span><button onClick={loadDemo}>Try a demo ↗</button></div>
        </section>

        <section className="map-panel" aria-label="Meeting map">
          <Map people={mapPeople} spot={spotDisplay} highlightedId={hoveredId} maxDistKm={maxDistKm}
            onSpotDrag={onSpotDrag} fitVersion={fitVersion}
            venues={venueInfo.venues} activeVenueId={activeVenueId} onPickVenue={pickVenue} />
          <div className="map-topbar"><span className="map-badge"><i /> {needMore ? "A world of possibilities" : `${MODE_LABELS[mode]} meeting point`}</span>
            <button className="button map-fit" onClick={() => setFitVersion(v => v + 1)} disabled={!located}><CrosshairIcon /> Fit everyone</button>
          </div>
          {needMore && <div className="map-empty">
            <div className="empty-symbol" aria-hidden>↗ <span>↙</span></div>
            <span className="eyebrow">THE BEST PLANS START HERE</span>
            <h2>Meet halfway.<br />Make a whole day of it.</h2>
            <p>{located ? "One more starting point and we’ll find your middle." : "Add your starting points and we’ll connect the dots."}</p>
            <button className="button primary" onClick={loadDemo}>Explore a Berlin meetup <span>↗</span></button>
            <small>Up to 6 people · Anywhere in the world</small>
          </div>}
          {!needMore && <div className="map-venue"><VenueBar state={venueInfo.state} venues={venueInfo.venues}
            activeId={activeVenueId} disabled={needMore} cat={venueCat} query={venueQuery}
            onCatPick={c => { setVenueCat(c); findVenuesRef.current(c, venueQuery); }}
            onQueryChange={setVenueQuery}
            onFind={() => findVenues()} onPick={pickVenue}
            onClose={() => { venueRequest.current?.abort(); setVenueSearch(null); }} /></div>}
          <div className="map-caption">{needMore ? "A shared destination starts with you." : "Make it yours — drag the green meeting pin to fine-tune."}</div>
        </section>

        <section className="results-panel" aria-label="Your meeting results">
          {result ?? <div className="results-empty"><CrosshairIcon /><h2>Your spot is waiting</h2><p>Add at least two starting points to compare journeys and find your middle.</p><button className="button primary" onClick={() => setView("plan")}>Add starting points</button></div>}
        </section>
      </main>
      <nav className="mobile-nav" aria-label="Meetup views">
        {([['plan', '01', 'People'], ['map', '02', 'Map'], ['results', '03', 'Your spot']] as const).map(([id, n, label]) =>
          <button key={id} onClick={() => setView(id)} aria-current={view === id ? "page" : undefined}><span>{n}</span>{label}{id === "results" && !needMore && <i />}</button>)}
      </nav>
      <div className="sr-only" role="status">{copied ? "Plan link copied to clipboard." : notice}</div>
      {shareUrl && <ShareDialog url={shareUrl} onClose={() => setShareUrl("")} />}
    </div>
  );
}
