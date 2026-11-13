"use client";

import { AnimatePresence, motion } from "motion/react";
import { fmtKm } from "@/lib/format";
import type { Venue } from "@/lib/types";

export type VenueState = "idle" | "loading" | "error" | "done";

const ICONS: Record<string, string> = {
  cafe: "☕",
  restaurant: "🍽️",
  bar: "🍸",
  fast_food: "🍔",
  food_court: "🍜",
  ice_cream: "🍦",
};

export default function VenueBar({
  state,
  venues,
  activeId,
  disabled,
  onFind,
  onPick,
  onClose,
}: {
  state: VenueState;
  venues: Venue[];
  activeId: string | null;
  disabled: boolean;
  onFind: () => void;
  onPick: (v: Venue) => void;
  onClose: () => void;
}) {
  return (
    <div className="pointer-events-none absolute right-3 top-3 z-[1000] flex w-[min(320px,calc(100%-24px))] flex-col items-end gap-2">
      <div className="pointer-events-auto flex items-center gap-2">
        {state === "done" && (
          <button
            onClick={onClose}
            aria-label="Close venue results"
            className="grid h-8 w-8 place-items-center rounded-full border border-[#3A4266] bg-[#141826] text-xs text-[#9AA3C7] shadow-[0_8px_24px_#00000066] transition-colors hover:text-[#E7EAF6]"
          >
            ✕
          </button>
        )}
        <button
          onClick={onFind}
          disabled={disabled || state === "loading"}
          title={
            disabled
              ? "Add at least two addresses first"
              : "Find cafes and restaurants around the spot (OpenStreetMap)"
          }
          className="rounded-full border border-[#FFD166] bg-[#141826] px-4 py-2 text-xs font-bold text-[#FFD166] shadow-[0_8px_24px_#00000066] transition-all hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {state === "loading" ? (
            <span className="inline-flex items-center gap-2">
              <span className="mitm-spinner" /> Searching…
            </span>
          ) : (
            "☕ Cafes & food nearby"
          )}
        </button>
      </div>

      <AnimatePresence>
        {state === "error" && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="pointer-events-auto w-full rounded-2xl border border-[#FF6B9D] bg-[#141826] p-3 text-xs text-[#FF6B9D] shadow-[0_16px_44px_#00000088]"
          >
            Venue search is busy right now — give it a moment and retry.
          </motion.div>
        )}
        {state === "done" && (
          <motion.ul
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="mitm-scroll pointer-events-auto max-h-[42vh] w-full overflow-y-auto rounded-2xl border border-[#2A3150] bg-[#141826] py-1 shadow-[0_16px_44px_#00000088]"
          >
            {venues.length === 0 && (
              <li className="px-3 py-3 text-xs text-[#9AA3C7]">
                Nothing found nearby — try dragging the spot somewhere else.
              </li>
            )}
            {venues.map((v) => {
              const active = v.id === activeId;
              return (
                <li key={v.id}>
                  <button
                    onClick={() => onPick(v)}
                    className={`flex w-full items-center gap-2 px-3 py-2 text-left transition-colors hover:bg-[#1C2138] ${
                      active ? "bg-[#1C2138]" : ""
                    }`}
                  >
                    <span aria-hidden className="shrink-0 text-base">
                      {ICONS[v.amenity] ?? "📍"}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-xs font-bold">
                        {v.name}
                      </span>
                      <span className="block truncate text-[10px] text-[#9AA3C7]">
                        {v.amenity.replace("_", " ")}
                        {v.cuisine ? ` · ${v.cuisine.replace("_", " ")}` : ""}
                      </span>
                    </span>
                    <span className="shrink-0 text-[10px] tabular-nums text-[#9AA3C7]">
                      {fmtKm(v.distanceKm)} km
                    </span>
                    {active && (
                      <span aria-hidden className="shrink-0 text-[10px] text-[#FFD166]">
                        ●
                      </span>
                    )}
                  </button>
                </li>
              );
            })}
          </motion.ul>
        )}
      </AnimatePresence>
    </div>
  );
}
