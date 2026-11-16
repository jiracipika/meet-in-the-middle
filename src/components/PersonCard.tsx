"use client";

import { useEffect, useId, useRef, useState } from "react";
import { CrosshairIcon, XIcon } from "./icons";
import { apiUrl } from "@/lib/api";
import { locate } from "@/lib/native";
import type { Person, Place } from "@/lib/types";

export function parseCoords(q: string): Place | null {
  const m = q.match(/^\s*([+-]?\d{1,2}(?:\.\d+)?)\s*[,;]\s*([+-]?\d{1,3}(?:\.\d+)?)\s*$/);
  if (!m) return null;
  const lat = Number(m[1]), lon = Number(m[2]);
  if (Math.abs(lat) > 90 || Math.abs(lon) > 180) return null;
  return { label: `${lat.toFixed(5)}, ${lon.toFixed(5)}`, lat, lon };
}

export default function PersonCard({ person, index, canRemove, bias, weightsEnabled, onChange, onRemove, onHover }: {
  person: Person; index: number; canRemove: boolean; bias: { lat: number; lon: number } | null;
  weightsEnabled: boolean; onChange: (patch: Partial<Person>) => void;
  onRemove: () => void; onHover: (id: string | null) => void;
}) {
  const [query, setQuery] = useState(person.place?.label ?? "");
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<Place[]>([]);
  const [active, setActive] = useState(0);
  const [error, setError] = useState("");
  const [searched, setSearched] = useState(false);
  const [locating, setLocating] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const locationVersion = useRef(0);
  const listId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const biasLat = bias?.lat, biasLon = bias?.lon;

  useEffect(() => () => { locationVersion.current++; abortRef.current?.abort(); }, []);
  useEffect(() => {
    const ac = new AbortController();
    abortRef.current = ac;
    const q = query.trim();
    if (!open || q.length < 3 || parseCoords(q) || person.place) return () => ac.abort();
    const timer = setTimeout(async () => {
      setLoading(true);
      setError("");
      try {
        const biasQ = biasLat !== undefined && biasLon !== undefined ? `&lat=${biasLat.toFixed(3)}&lon=${biasLon.toFixed(3)}` : "";
        const res = await fetch(apiUrl(`/api/geocode?q=${encodeURIComponent(q)}${biasQ}`), {
          signal: AbortSignal.any([ac.signal, AbortSignal.timeout(12000)]),
        });
        if (!res.ok) throw new Error("search_failed");
        const json: { results?: Place[] } = await res.json();
        if (ac.signal.aborted) return;
        setItems((json.results ?? []).slice(0, 6));
        setActive(0);
        setSearched(true);
      } catch {
        if (!ac.signal.aborted) setError("Address search is unavailable. Try again, or enter latitude, longitude.");
      } finally {
        if (!ac.signal.aborted) setLoading(false);
      }
    }, 300);
    return () => { clearTimeout(timer); ac.abort(); };
  }, [query, open, biasLat, biasLon, person.place]);

  const coord = parseCoords(query);
  const display = coord ? [coord] : items;
  const activeIndex = Math.min(active, Math.max(0, display.length - 1));
  function applyPlace(place: Place) {
    abortRef.current?.abort();
    locationVersion.current++;
    onChange({ place });
    setQuery(place.label); setOpen(false); setItems([]); setError(""); setLoading(false); setLocating(false);
  }
  function onInput(value: string) {
    abortRef.current?.abort();
    locationVersion.current++;
    setLocating(false); setQuery(value); setItems([]); setActive(0); setError(""); setSearched(false); setLoading(false); setOpen(true);
    if (person.place) onChange({ place: null });
  }
  async function findMe() {
    abortRef.current?.abort();
    setOpen(false); setLoading(false); setError("");
    const version = ++locationVersion.current;
    setLocating(true);
    try {
      const coords = await locate();
      if (version !== locationVersion.current) return;
      applyPlace({ lat: coords.latitude, lon: coords.longitude, label: `Current location (${coords.latitude.toFixed(4)}, ${coords.longitude.toFixed(4)})` });
    } catch (err) {
      if (version !== locationVersion.current) return;
      setLocating(false);
      const code = (err as { code?: number }).code;
      setError(
        err instanceof Error && err.message === "unsupported" ? "Location is not supported here. Enter an address instead."
          : code === 1 ? "Location permission is off. Allow it in your browser, or enter an address."
          : code === 3 ? "Location took too long. Try again or enter an address."
          : "We couldn’t locate you. Try again or enter an address.");
    }
  }

  return <article className="person-card" onMouseEnter={() => onHover(person.id)} onMouseLeave={() => onHover(null)}>
    <div className="person-heading"><span className="person-avatar" style={{ background: person.color }} aria-hidden>{index + 1}</span>
      <input className="person-name" aria-label={`${person.name}'s name`} value={person.name} maxLength={24} placeholder="Friend’s name" onChange={e => onChange({ name: e.target.value })} />
      {canRemove && <button className="icon-button remove-person" aria-label={`Remove ${person.name}`} onClick={onRemove}><XIcon /></button>}
      {!canRemove && <span className="person-tag">{index === 0 ? "YOU?" : "A FRIEND"}</span>}
    </div>
    <div className="address-wrap" onBlur={e => { if (!e.currentTarget.contains(e.relatedTarget)) setOpen(false); }}>
      <label className="sr-only" htmlFor={`${listId}-input`}>{person.name}&apos;s address</label>
      <input ref={inputRef} id={`${listId}-input`} role="combobox" aria-autocomplete="list" aria-expanded={open && display.length > 0}
        aria-controls={`${listId}-list`} aria-activedescendant={open && display.length ? `${listId}-${activeIndex}` : undefined}
        autoComplete="off" maxLength={240} placeholder="City, address, or coordinates" value={query}
        onChange={e => onInput(e.target.value)} onFocus={() => setOpen(true)}
        onKeyDown={e => {
          if (e.key === "Escape") { setOpen(false); return; }
          if (e.key === "ArrowDown" || e.key === "ArrowUp") {
            e.preventDefault(); setOpen(true);
            if (display.length) setActive((activeIndex + (e.key === "ArrowDown" ? 1 : -1) + display.length) % display.length);
          }
          if (e.key === "Enter" && open && display.length) { e.preventDefault(); applyPlace(display[activeIndex]); }
        }} />
      {open && display.length > 0 && <ul id={`${listId}-list`} role="listbox" aria-label="Matching locations" className="address-options">
        {display.map((place, i) => <li id={`${listId}-${i}`} key={`${place.label}-${i}`} role="option" aria-selected={activeIndex === i}
          onMouseDown={e => e.preventDefault()} onMouseEnter={() => setActive(i)} onClick={() => applyPlace(place)}>{place.label}</li>)}
      </ul>}
    </div>
    <div className="location-row"><span className={person.place ? "location-ready" : "muted"}>{loading ? "Searching…" : person.place ? "✓ Location added" : "Choose a starting point"}</span>
      <button className="find-me" onClick={findMe} disabled={locating} aria-label={`Find me for ${person.name}`}><CrosshairIcon />{locating ? "Locating…" : "Find me"}</button>
    </div>
    {error && <p className="field-error" role="alert">{error}</p>}
    {open && searched && !loading && !error && !display.length && <p className="field-help" role="status">No matches. Try a nearby city or paste coordinates.</p>}
    <details className="weight-details"><summary>Adjust travel priority <span>{weightsEnabled ? `${person.weight.toFixed(1)}×` : "Not used in this mode"}</span></summary>
      <p>{weightsEnabled ? "Give someone more pull if travelling is harder for them." : "Shortest longest trip treats everyone equally. Choose another mode to use priorities."}</p>
      <input type="range" aria-label={`Pull weight for ${person.name}`} min={0.5} max={2} step={0.05} value={person.weight}
        disabled={!person.place || !weightsEnabled} onChange={e => onChange({ weight: Number(e.target.value) })} />
      <div><span>Less pull</span><span>More pull</span></div>
    </details>
  </article>;
}
