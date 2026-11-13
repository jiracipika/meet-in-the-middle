"use client";

import { motion } from "motion/react";
import { MODE_HINTS, MODE_LABELS, type Mode } from "@/lib/types";

const MODES: Mode[] = ["median", "minmax", "centroid"];

export default function ModeToggle({
  mode,
  onChange,
}: {
  mode: Mode;
  onChange: (m: Mode) => void;
}) {
  return (
    <div
      role="tablist"
      aria-label="Meeting point mode"
      className="flex gap-1 rounded-full border border-[#2A3150] bg-[#141826] p-1 shadow-[0_8px_24px_#00000066]"
    >
      {MODES.map((m) => {
        const active = mode === m;
        return (
          <button
            key={m}
            role="tab"
            aria-selected={active}
            title={MODE_HINTS[m]}
            onClick={() => onChange(m)}
            className={`relative rounded-full px-3 py-1.5 text-xs font-bold whitespace-nowrap transition-colors ${
              active ? "text-[#0B0D17]" : "text-[#9AA3C7] hover:text-[#E7EAF6]"
            }`}
          >
            {active && (
              <motion.span
                layoutId="mode-pill"
                className="absolute inset-0 rounded-full bg-[#FFD166]"
                transition={{ type: "spring", stiffness: 420, damping: 34 }}
              />
            )}
            <span className="relative z-10">{MODE_LABELS[m]}</span>
          </button>
        );
      })}
    </div>
  );
}
