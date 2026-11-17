"use client";
import type { ReactNode } from "react";
import { ActivityIcon, CoffeeIcon, MartiniIcon, SearchIcon, TicketIcon, TreeIcon, XIcon } from "./icons";
import { fmtKm } from "@/lib/format";
import { VENUE_CAT_IDS, VENUE_CATEGORIES, type VenueCat } from "@/lib/venueCats";
import type { Venue } from "@/lib/types";

export type VenueState = "idle" | "loading" | "error" | "done";

const CAT_ICONS: Record<VenueCat, ReactNode> = {
  food: <CoffeeIcon />,
  drinks: <MartiniIcon />,
  outdoors: <TreeIcon />,
  culture: <TicketIcon />,
  active: <ActivityIcon />,
};

export function venueIcon(v: Venue): ReactNode {
  return v.category ? CAT_ICONS[v.category] : <CoffeeIcon />;
}

export default function VenueBar({ state, venues, activeId, disabled, cat, query, onCatPick, onQueryChange, onFind, onPick, onClose }: {
  state: VenueState; venues: Venue[]; activeId: string | null; disabled: boolean;
  cat: VenueCat; query: string;
  onCatPick: (cat: VenueCat) => void; onQueryChange: (q: string) => void;
  onFind: () => void; onPick: (v: Venue) => void; onClose: () => void;
}) {
  return <div className="venue-widget">
    <button className="button venue-trigger" disabled={disabled || state === "loading"} onClick={onFind}
      aria-label={state === "error" ? "Retry finding spots" : "Find a spot"}>
      <SearchIcon />{state === "loading" ? "Finding nearby places…" : state === "error" ? "Retry finding spots" : "Find a spot"}
    </button>
    {state !== "idle" && <div className="venue-results"><div className="venue-heading"><h3>Find a spot</h3><button className="icon-button" aria-label="Close venue results" onClick={onClose}><XIcon /></button></div>
      <div className="venue-controls">
        <div className="venue-search"><SearchIcon aria-hidden /><input type="search" aria-label="Search places by name near the spot" autoComplete="off"
          maxLength={60} placeholder="Search a place by name…" value={query} onChange={e => onQueryChange(e.target.value)} /></div>
        <div className="venue-chips" role="group" aria-label="Place categories">
          {VENUE_CAT_IDS.map(id => <button key={id} className="venue-chip" aria-pressed={cat === id} disabled={state === "loading"}
            onClick={() => onCatPick(id)}><span aria-hidden>{CAT_ICONS[id]}</span>{VENUE_CATEGORIES[id].label}</button>)}
        </div>
      </div>
      {state === "loading" && <p role="status">Looking around your meeting spot. This can take a moment.</p>}
      {state === "error" && <p role="alert">Nearby places are unavailable right now. Please retry in a moment.</p>}
      {state === "done" && (venues.length ? <ul>{venues.map(v => <li key={v.id}><button onClick={() => onPick(v)} aria-pressed={activeId === v.id}>
        <span className="venue-icon" aria-hidden>{venueIcon(v)}</span>
        <span><strong>{v.name}</strong><small>{v.amenity.replaceAll("_", " ")}{v.cuisine ? ` · ${v.cuisine}` : ""}</small></span>
        <span className="venue-meta">{v.openNow === undefined ? null : <em className={v.openNow ? "open-now" : "closed-now"}>{v.openNow ? "Open" : "Closed"}</em>}{fmtKm(v.distanceKm)} km</span>
      </button></li>)}</ul> : <p>No places found{query ? " for that search" : " nearby"}. Try another word or move the meeting pin.</p>)}
    </div>}
  </div>;
}
