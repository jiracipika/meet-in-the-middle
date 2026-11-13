"use client";

import { AnimatePresence, motion } from "motion/react";
import { CoffeeIcon, UtensilsIcon, XIcon } from "@/components/icons";
import { fmtKm } from "@/lib/format";
import type { Venue } from "@/lib/types";

export type VenueState = "idle" | "loading" | "error" | "done";

const AMENITY_ICONS: Record<string, "coffee" | "food"> = {
  cafe: "coffee",
  restaurant: "food",
  bar: "food",
  fast_food: "food",
  food_court: "food",
  ice_cream: "food",
};

export default function VenueBar({
  state,
  venues,
  activeId,
  disabled,
  onFind,
  onPick,
  onClose,
  align = "right",
  compact = false,
}: {
  state: VenueState;
  venues: Venue[];
  activeId: string | null;
  disabled: boolean;
  onFind: () => void;
  onPick: (v: Venue) => void;
  onClose: () => void;
  /** which edge the results panel hugs (positioning stays with the parent) */
  align?: "left" | "right";
  /** icon-only round trigger for small screens */
  compact?: boolean;
}) {
  const resultsAlign = align === "right" ? "items-end" : "items-start";

  return (
    <div className={`flex flex-col gap-2 ${resultsAlign}`}>
      <div className="flex items-center gap-2">
        {state === "done" && (
          <button
            onClick={onClose}
            aria-label="Close venue results"
            className={`grid shrink-0 place-items-center rounded-full border border-[#3A4266] bg-[#141826] text-[#9AA3C7] shadow-[0_8px_24px_#00000066] transition-colors hover:text-[#E7EAF6] ${
              compact ? "h-11 w-11" : "h-8 w-8 text-xs"
            }`}
          >
            <XIcon className={compact ? "h-4 w-4" : "h-3 w-3"} />
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
          aria-label="Cafes and food nearby"
          className={
            compact
              ? "grid h-11 w-11 place-items-center rounded-full border border-[#FFD166] bg-[#141826] text-[#FFD166] shadow-[0_8px_24px_#00000066] transition-all hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40"
              : "flex min-h-[38px] items-center gap-2 rounded-full border border-[#FFD166] bg-[#141826] px-4 text-xs font-bold text-[#FFD166] shadow-[0_8px_24px_#00000066] transition-all hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40"
          }
        >
          {state === "loading" ? (
            <span className="mitm-spinner" aria-hidden />
          ) : (
            <CoffeeIcon className={compact ? "h-5 w-5" : "h-4 w-4"} aria-hidden />
          )}
          {!compact && <span>Cafes &amp; food nearby</span>}
        </button>
      </div>

      <AnimatePresence>
        {state === "error" && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="w-[min(320px,calc(100vw-24px))] rounded-2xl border border-[#FF6B9D] bg-[#141826] p-3 text-xs text-[#FF6B9D] shadow-[0_16px_44px_#00000088]"
          >
            Venue search is busy right now — give it a moment and retry.
          </motion.div>
        )}
        {state === "done" && (
          <motion.ul
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="mitm-scroll max-h-[42vh] w-[min(320px,calc(100vw-24px))] overflow-y-auto rounded-2xl border border-[#2A3150] bg-[#141826] py-1 shadow-[0_16px_44px_#00000088]"
          >
            {venues.length === 0 && (
              <li className="px-3 py-3 text-xs text-[#9AA3C7]">
                Nothing found nearby — try dragging the spot somewhere else.
              </li>
            )}
            {venues.map((v) => {
              const active = v.id === activeId;
              const icon = AMENITY_ICONS[v.amenity] === "coffee" ? (
                <CoffeeIcon className="h-4 w-4" />
              ) : (
                <UtensilsIcon className="h-4 w-4" />
              );
              return (
                <li key={v.id}>
                  <button
                    onClick={() => onPick(v)}
                    className={`flex min-h-[44px] w-full items-center gap-2 px-3 py-2 text-left transition-colors hover:bg-[#1C2138] ${
                      active ? "bg-[#1C2138]" : ""
                    }`}
                  >
                    <span
                      aria-hidden
                      className="shrink-0 text-[#B9C3EA]"
                    >
                      {icon}
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
