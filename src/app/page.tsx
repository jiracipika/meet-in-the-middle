"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import Map from "@/components/Map";
import PersonCard from "@/components/PersonCard";
import ModeToggle from "@/components/ModeToggle";
import StatsPanel, { type PersonTrip, type Stats } from "@/components/StatsPanel";
import VenueBar, { type VenueState } from "@/components/VenueBar";
import BottomSheet from "@/components/BottomSheet";
import Background from "@/components/Background";
import { ChevronUpIcon, ShareIcon } from "@/components/icons";
import {
  computeMeeting,
  estimateTravel,
  fairnessScore,
  haversineKm,
} from "@/lib/geo";
import { fmtKm } from "@/lib/format";
import { PERSON_COLORS, nextFreeColor } from "@/lib/palette";
import { decodeState, encodeState } from "@/lib/share";
import {
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
    venues: Venue[];
    state: VenueState;
  } | null>(null);
  const [copied, setCopied] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);

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
    if (!override || override.sticky) return override;
    if (meeting && haversineKm(override.pinnedAt, meeting) > 1.5) return null;
    return override;
  }, [override, meeting]);

  const venueInfo = useMemo((): {
    venues: Venue[];
    state: VenueState;
  } => {
    if (!venueSearch) return { venues: [], state: "idle" };
    if (meeting && haversineKm(venueSearch.origin, meeting) > 2) {
      return { venues: [], state: "idle" };
    }
    return venueSearch;
  }, [venueSearch, meeting]);

  const spot: LatLng | null = activeOverride ?? meeting;

  const spotDisplay = useMemo(() => {
    if (!spot) return null;
    return {
      lat: spot.lat,
      lon: spot.lon,
      label: activeOverride ? activeOverride.label : "Fairest spot",
      sub: activeOverride
        ? `${activeOverride.amenity ? activeOverride.amenity.replace("_", " ") + " · " : ""}chosen spot`
        : "calculated meeting point",
    };
  }, [spot, activeOverride]);

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

  // When a spot first becomes available (demo loaded, address added), snap the
  // mobile sheet closed so the map reveal is visible. Deferred to a timeout so
  // it reads as an external-state callback, not a render-phase update.
  const prevLocatedRef = useRef(0);
  useEffect(() => {
    const grew = located >= 2 && located > prevLocatedRef.current;
    prevLocatedRef.current = located;
    if (grew && sheetOpen) {
      const t = setTimeout(() => setSheetOpen(false), 0);
      return () => clearTimeout(t);
    }
  }, [located, sheetOpen]);

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
    setSheetOpen(false);
  }, []);

  const findVenues = useCallback(async () => {
    if (!meeting) return;
    setVenueSearch({ origin: meeting, venues: [], state: "loading" });
    try {
      const res = await fetch(
        `/api/venues?lat=${meeting.lat.toFixed(5)}&lon=${meeting.lon.toFixed(5)}`,
      );
      if (!res.ok) throw new Error("venues_failed");
      const json: { venues?: Venue[] } = await res.json();
      setVenueSearch({ origin: meeting, venues: json.venues ?? [], state: "done" });
    } catch {
      setVenueSearch({ origin: meeting, venues: [], state: "error" });
    }
  }, [meeting]);

  const pickVenue = useCallback(
    (v: Venue) => {
      setOverride({
        label: v.name,
        lat: v.lat,
        lon: v.lon,
        amenity: v.amenity,
        pinnedAt: meeting ?? { lat: v.lat, lon: v.lon },
      });
      setSheetOpen(false);
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
    const hash = encodeState(state);
    const url = `${window.location.origin}${window.location.pathname}#${hash}`;
    window.history.replaceState(null, "", `#${hash}`);
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // clipboard blocked: the URL is still updated in the address bar
    }
  }

  /* ---------- mobile sheet summary (peek bar) ---------- */

  const sheetSummary = (
    <div className="flex h-full w-full items-center gap-2">
      <span
        aria-hidden
        className={`h-2.5 w-2.5 shrink-0 rounded-full ${spot ? "mitm-spot-dot" : "bg-[#3A4266]"}`}
      />
      <span className="min-w-0 flex-1 truncate text-sm font-bold">
        {spot && spotDisplay
          ? spotDisplay.label
          : "Add people & addresses"}
      </span>
      {spot && stats ? (
        <>
          <span
            title="Balance score"
            className="shrink-0 rounded-full bg-[#FFD166] px-2 py-0.5 text-[11px] font-extrabold text-[#0B0D17] tabular-nums"
          >
            {stats.fairness}
          </span>
          <span className="shrink-0 rounded-full border border-[#2A3150] px-2 py-0.5 text-[11px] font-bold text-[#9AA3C7] tabular-nums">
            {fmtKm(stats.totalKm)} km
          </span>
        </>
      ) : (
        <span className="shrink-0 rounded-full border border-[#2A3150] px-2 py-0.5 text-[11px] font-bold text-[#9AA3C7] tabular-nums">
          {located}/{people.length} located
        </span>
      )}
      <ChevronUpIcon
        className={`h-4 w-4 shrink-0 text-[#9AA3C7] transition-transform ${
          sheetOpen ? "rotate-180" : ""
        }`}
      />
    </div>
  );

  const personCards = (idPrefix: string) => (
    <AnimatePresence mode="popLayout" initial={false}>
      {people.map((p) => (
        <PersonCard
          key={`${idPrefix}-${p.id}`}
          person={p}
          canRemove={people.length > 1}
          bias={meeting}
          onChange={(patch) => updatePerson(p.id, patch)}
          onRemove={() => removePerson(p.id)}
          onHover={setHoveredId}
        />
      ))}
    </AnimatePresence>
  );

  const addAndHint = (idSuffix: string) => (
    <>
      <button
        onClick={addPerson}
        disabled={people.length >= MAX_PEOPLE}
        className="rounded-2xl border border-dashed border-[#3A4266] py-3 text-sm font-bold text-[#9AA3C7] transition-colors hover:border-[#FFD166] hover:text-[#FFD166] disabled:cursor-not-allowed disabled:opacity-40"
      >
        {people.length >= MAX_PEOPLE
          ? `Max ${MAX_PEOPLE} people`
          : "+ Add someone"}
      </button>
      <p className="text-center text-[11px] text-[#5A6288]">
        {located}/{people.length} located
        {needMore
          ? " · add at least 2 addresses"
          : " · tweak the pull sliders and watch the spot move"}
        {idSuffix === "sheet" ? " · drag the gold spot to fine-tune" : ""}
      </p>
    </>
  );

  return (
    <div className="relative flex h-dvh flex-col overflow-hidden">
      <Background />

      <header
        className="relative z-20 flex items-center justify-between gap-2 border-b border-[#1E2338] bg-[#0E1120] px-3 sm:gap-3 md:px-6"
        style={{
          paddingTop: "max(10px, env(safe-area-inset-top))",
          paddingBottom: "max(10px, env(safe-area-inset-bottom))",
        }}
      >
        <div className="flex min-w-0 items-center gap-3">
          <span
            aria-hidden
            className="mitm-gradient-text text-sm font-black tracking-tight sm:text-xl md:text-2xl"
          >
            MEET IN THE MIDDLE
          </span>
          <span className="hidden truncate text-xs text-[#9AA3C7] md:block">
            the fairest spot for everyone
          </span>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <AnimatePresence>
            {needMore && (
              <motion.button
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={loadDemo}
                className="min-h-[38px] rounded-full border border-[#3A4266] px-3 text-xs font-bold text-[#B9C3EA] transition-colors hover:border-[#4CC9F0] hover:text-[#4CC9F0]"
              >
                Try Berlin demo
              </motion.button>
            )}
          </AnimatePresence>
          <button
            onClick={share}
            aria-label="Share link"
            className="flex min-h-[38px] items-center gap-1.5 rounded-full bg-[#FFD166] px-3.5 text-xs font-extrabold text-[#0B0D17] transition-all hover:brightness-110 active:scale-95"
          >
            <ShareIcon className="h-4 w-4" aria-hidden />
            <span>{copied ? "Copied ✓" : "Share"}</span>
          </button>
        </div>
      </header>

      <main className="relative z-10 flex min-h-0 flex-1 flex-col lg:flex-row">
        {/* Desktop sidebar */}
        <aside className="mitm-scroll hidden w-[400px] flex-none flex-col gap-3 overflow-y-auto border-r border-[#1E2338] bg-[#0E1120] p-4 lg:flex">
          {personCards("aside")}
          {addAndHint("aside")}
        </aside>

        <section className="relative min-h-0 flex-1">
          <Map
            people={mapPeople}
            spot={spotDisplay}
            highlightedId={hoveredId}
            maxDistKm={maxDistKm}
            onSpotDrag={onSpotDrag}
          />

          {/* Desktop overlays */}
          <div className="absolute left-3 top-3 z-[1000] hidden lg:block">
            <ModeToggle mode={mode} onChange={setMode} />
          </div>
          <div className="absolute right-3 top-3 z-[1000] hidden lg:flex">
            <VenueBar
              state={venueInfo.state}
              venues={venueInfo.venues}
              activeId={
                activeOverride &&
                venueInfo.venues.some((v) => v.name === activeOverride.label)
                  ? (venueInfo.venues.find(
                      (v) => v.name === activeOverride.label,
                    )?.id ?? null)
                  : null
              }
              disabled={needMore}
              onFind={findVenues}
              onPick={pickVenue}
              onClose={() => setVenueSearch(null)}
            />
          </div>

          {/* Mobile overlays (stacked under the mode pills) */}
          <div className="absolute left-3 top-3 z-[1000] flex flex-col items-start gap-2 lg:hidden">
            <ModeToggle mode={mode} onChange={setMode} />
            <VenueBar
              align="left"
              compact
              state={venueInfo.state}
              venues={venueInfo.venues}
              activeId={
                activeOverride &&
                venueInfo.venues.some((v) => v.name === activeOverride.label)
                  ? (venueInfo.venues.find(
                      (v) => v.name === activeOverride.label,
                    )?.id ?? null)
                  : null
              }
              disabled={needMore}
              onFind={findVenues}
              onPick={pickVenue}
              onClose={() => setVenueSearch(null)}
            />
          </div>

          {/* Desktop stats overlay */}
          {spot && stats && (
            <div className="absolute bottom-3 left-3 z-[1000] hidden w-[min(360px,calc(100%-24px))] lg:block">
              <StatsPanel
                trips={trips}
                stats={stats}
                spot={{ lat: spot.lat, lon: spot.lon, label: spotDisplay!.label }}
                overrideActive={activeOverride !== null}
                onReset={activeOverride ? () => setOverride(null) : null}
              />
            </div>
          )}

          {needMore && (
            <div className="pointer-events-none absolute inset-0 z-[900] grid place-items-center p-4 pb-28 lg:pb-4">
              <div className="pointer-events-auto max-w-xs rounded-2xl border border-[#2A3150] bg-[#141826] px-6 py-5 text-center shadow-[0_20px_60px_#000000aa]">
                <p className="text-base font-extrabold">
                  Find your fairest meeting spot
                </p>
                <p className="mt-1 text-xs leading-relaxed text-[#9AA3C7]">
                  {located === 0
                    ? "Add each person's address — up to 6 people, anywhere on Earth."
                    : "One more address and the spot appears."}
                </p>
                <button
                  onClick={loadDemo}
                  className="mt-3 min-h-[38px] rounded-full border border-[#4CC9F0] px-4 text-xs font-bold text-[#4CC9F0] transition-all hover:bg-[#4CC9F0] hover:text-[#0B0D17]"
                >
                  Try a Berlin demo
                </button>
              </div>
            </div>
          )}
        </section>
      </main>

      {/* Mobile bottom sheet (people + stats) */}
      <BottomSheet
        expanded={sheetOpen}
        onToggle={setSheetOpen}
        summary={sheetSummary}
      >
        <div className="flex flex-col gap-3">
          {spot && stats ? (
            <StatsPanel
              trips={trips}
              stats={stats}
              spot={{ lat: spot.lat, lon: spot.lon, label: spotDisplay!.label }}
              overrideActive={activeOverride !== null}
              onReset={activeOverride ? () => setOverride(null) : null}
              scroll={false}
            />
          ) : (
            <p className="rounded-2xl border border-[#252B44] bg-[#141826] p-3 text-xs leading-relaxed text-[#9AA3C7]">
              Add at least two addresses — the meeting spot, travel distances and
              balance score appear here.
            </p>
          )}
          {personCards("sheet")}
          {addAndHint("sheet")}
        </div>
      </BottomSheet>
    </div>
  );
}
