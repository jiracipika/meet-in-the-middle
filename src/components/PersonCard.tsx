"use client";

import { useEffect, useRef, useState } from "react";
import { motion } from "motion/react";
import type { Person, Place } from "@/lib/types";

const COORD_RE = /^\s*(-?\d{1,2}(?:\.\d+)?)\s*[,;]\s*(-?\d{1,3}(?:\.\d+)?)\s*$/;

export function parseCoords(q: string): Place | null {
  const m = q.match(COORD_RE);
  if (!m) return null;
  const lat = Number(m[1]);
  const lon = Number(m[2]);
  if (Math.abs(lat) > 90 || Math.abs(lon) > 180) return null;
  return { label: `${lat.toFixed(5)}, ${lon.toFixed(5)}`, lat, lon };
}

export default function PersonCard({
  person,
  canRemove,
  bias,
  onChange,
  onRemove,
  onHover,
}: {
  person: Person;
  canRemove: boolean;
  bias: { lat: number; lon: number } | null;
  onChange: (patch: Partial<Person>) => void;
  onRemove: () => void;
  onHover: (id: string | null) => void;
}) {
  const [query, setQuery] = useState(person.place?.label ?? "");
  const [focused, setFocused] = useState(false);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<Place[]>([]);
  const [active, setActive] = useState(0);
  const abortRef = useRef<AbortController | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  // close the dropdown when clicking elsewhere
  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  // debounced geocode (skipped when the query is a coordinate pair)
  useEffect(() => {
    const q = query.trim();
    const timer = setTimeout(async () => {
      if (!focused || q.length < 3 || parseCoords(q)) {
        setItems([]);
        setLoading(false);
        return;
      }
      abortRef.current?.abort();
      const ac = new AbortController();
      abortRef.current = ac;
      setLoading(true);
      try {
        const biasQ = bias
          ? `&lat=${bias.lat.toFixed(3)}&lon=${bias.lon.toFixed(3)}`
          : "";
        const res = await fetch(
          `/api/geocode?q=${encodeURIComponent(q)}${biasQ}`,
          { signal: ac.signal },
        );
        if (!res.ok) return;
        const json: { results?: Place[] } = await res.json();
        if (ac.signal.aborted) return;
        setItems((json.results ?? []).slice(0, 6));
        setActive(0);
        setOpen(true);
      } catch {
        // aborted or network hiccup: keep the dropdown closed
      } finally {
        if (!ac.signal.aborted) setLoading(false);
      }
    }, 280);
    return () => clearTimeout(timer);
  }, [query, focused, bias]);

  const coordPlace = focused ? parseCoords(query.trim()) : null;
  const display: Place[] = coordPlace ? [coordPlace] : items;

  function applyPlace(place: Place) {
    onChange({ place });
    setQuery(place.label);
    setOpen(false);
    setFocused(false);
    setItems([]);
  }

  function onInput(v: string) {
    setQuery(v);
    if (person.place) onChange({ place: null });
    setOpen(true);
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Escape") {
      setOpen(false);
      return;
    }
    if (display.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((a) => (a + 1) % display.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => (a - 1 + display.length) % display.length);
    } else if (e.key === "Enter") {
      e.preventDefault();
      applyPlace(display[active]);
    }
  }

  const initial = (person.name.trim()[0] ?? "?").toUpperCase();

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ type: "spring", stiffness: 320, damping: 28 }}
      onMouseEnter={() => onHover(person.id)}
      onMouseLeave={() => onHover(null)}
      className="rounded-2xl border border-[#252B44] bg-[#141826] p-3 shadow-[0_10px_30px_#00000055]"
    >
      <div className="flex items-center gap-2">
        <span
          aria-hidden
          className="grid h-6 w-6 shrink-0 place-items-center rounded-full text-[11px] font-extrabold text-[#0B0D17]"
          style={{ background: person.color }}
        >
          {initial}
        </span>
        <input
          aria-label={`${person.name}'s name`}
          value={person.name}
          maxLength={24}
          onChange={(e) => onChange({ name: e.target.value })}
          className="min-w-0 flex-1 bg-transparent text-sm font-bold outline-none"
          placeholder="Name"
        />
        {canRemove && (
          <button
            onClick={onRemove}
            aria-label={`Remove ${person.name}`}
            title="Remove"
            className="grid h-6 w-6 shrink-0 place-items-center rounded-full text-[#9AA3C7] transition-colors hover:bg-[#232A44] hover:text-[#FF6B9D]"
          >
            ✕
          </button>
        )}
      </div>

      <div ref={wrapRef} className="relative mt-2">
        <input
          aria-label={`${person.name}'s address`}
          value={query}
          onChange={(e) => onInput(e.target.value)}
          onFocus={() => setFocused(true)}
          onKeyDown={onKeyDown}
          placeholder={`Address for ${person.name} — or paste "lat, lon"`}
          className={`w-full rounded-xl border bg-[#0E1120] px-3 py-2 text-sm outline-none transition-colors placeholder:text-[#5A6288] ${
            person.place ? "border-[#2A3150]" : "border-[#3A4266]"
          }`}
          style={person.place ? undefined : { borderColor: person.color }}
        />
        {loading && (
          <span
            aria-hidden
            className="absolute right-3 top-1/2 -translate-y-1/2 text-xs"
          >
            <span className="mitm-spinner" />
          </span>
        )}
        {open && display.length > 0 && (
          <ul
            role="listbox"
            className="mitm-scroll absolute z-30 mt-1 max-h-60 w-full overflow-y-auto rounded-xl border border-[#2A3150] bg-[#161B2E] py-1 shadow-[0_16px_40px_#000000aa]"
          >
            {display.map((s, i) => (
              <li key={`${s.label}-${i}`}>
                <button
                  role="option"
                  aria-selected={i === active}
                  onMouseEnter={() => setActive(i)}
                  onClick={() => applyPlace(s)}
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm"
                >
                  <span
                    aria-hidden
                    className="h-1.5 w-1.5 shrink-0 rounded-full"
                    style={{ background: i === active ? person.color : "#3A4266" }}
                  />
                  <span className="truncate">{s.label}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="mt-2 flex items-center gap-2">
        <span
          className={`min-w-0 flex-1 truncate text-[11px] ${
            person.place ? "text-[#9AA3C7]" : "text-[#5A6288]"
          }`}
        >
          {person.place
            ? `${person.place.lat.toFixed(4)}, ${person.place.lon.toFixed(4)}`
            : "Not located yet"}
        </span>
      </div>

      <label
        title="Higher pull moves the spot toward this person (e.g. no car, tight schedule)"
        className={`mt-1 flex items-center gap-2 text-[11px] font-semibold text-[#9AA3C7] ${
          person.place ? "" : "pointer-events-none opacity-40"
        }`}
      >
        <span className="whitespace-nowrap">pull</span>
        <input
          type="range"
          min={0.5}
          max={2}
          step={0.05}
          value={person.weight}
          disabled={!person.place}
          onChange={(e) => onChange({ weight: Number(e.target.value) })}
          className="mitm-range flex-1"
          style={{ color: person.color }}
        />
        <span className="w-9 text-right tabular-nums">
          ×{person.weight.toFixed(2)}
        </span>
      </label>
    </motion.div>
  );
}
