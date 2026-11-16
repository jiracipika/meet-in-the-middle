"use client";
import { CoffeeIcon, XIcon } from "./icons";
import { fmtKm } from "@/lib/format";
import type { Venue } from "@/lib/types";
export type VenueState = "idle" | "loading" | "error" | "done";
export default function VenueBar({ state, venues, activeId, disabled, onFind, onPick, onClose }: {
  state: VenueState; venues: Venue[]; activeId: string | null; disabled: boolean;
  onFind: () => void; onPick: (v: Venue) => void; onClose: () => void;
}) {
  return <div className="venue-widget"><button className="button venue-trigger" disabled={disabled || state === "loading"} onClick={onFind} aria-label="Cafes and food nearby"><CoffeeIcon />{state === "loading" ? "Finding nearby places…" : state === "error" ? "Retry nearby places" : "Cafes & food nearby"}</button>
    {state !== "idle" && <div className="venue-results"><div className="venue-heading"><h3>Somewhere to catch up</h3><button className="icon-button" aria-label="Close venue results" onClick={onClose}><XIcon /></button></div>
      {state === "loading" && <p role="status">Looking around your meeting spot. This can take a moment.</p>}
      {state === "error" && <p role="alert">Nearby places are unavailable right now. Please retry in a moment.</p>}
      {state === "done" && (venues.length ? <ul>{venues.map(v => <li key={v.id}><button onClick={() => onPick(v)} aria-pressed={activeId === v.id}><CoffeeIcon /><span><strong>{v.name}</strong><small>{v.amenity.replaceAll("_", " ")}{v.cuisine ? ` · ${v.cuisine}` : ""}</small></span><span>{fmtKm(v.distanceKm)} km</span></button></li>)}</ul> : <p>No places found nearby. Move the meeting pin and try again.</p>)}
    </div>}
  </div>;
}
