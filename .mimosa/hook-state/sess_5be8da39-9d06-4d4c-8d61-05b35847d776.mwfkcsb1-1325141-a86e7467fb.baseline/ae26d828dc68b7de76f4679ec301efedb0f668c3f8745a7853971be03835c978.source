"use client";

import type { CSSProperties } from "react";
import { motion } from "motion/react";
import { CrosshairIcon, ScaleIcon, SphereIcon } from "@/components/icons";
import { MODE_HINTS, MODE_LABELS, type Mode } from "@/lib/types";

const MODES: Array<{ id: Mode; icon: typeof ScaleIcon }> = [
  { id: "median", icon: ScaleIcon },
  { id: "minmax", icon: SphereIcon },
  { id: "centroid", icon: CrosshairIcon },
];

/** Shorter pill labels that fit small phone screens. */
const MODE_LABELS_SHORT: Record<Mode, string> = {
  median: "Fairest",
  minmax: "Max trip",
  centroid: "Avg",
};

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
      className="mitm-beam mitm-glass flex gap-1 rounded-full p-1 shadow-[0_8px_24px_#00000066]"
      style={{ "--beam-color": "#FFD166" } as CSSProperties}
    >
      {MODES.map(({ id: m, icon: Icon }) => {
        const active = mode === m;
        return (
          <button
            key={m}
            role="tab"
            aria-selected={active}
            title={MODE_HINTS[m]}
            onClick={() => onChange(m)}
            className={`relative flex min-h-[36px] items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold whitespace-nowrap transition-colors ${
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
            <span className="relative z-10 flex items-center gap-1.5">
              <Icon className="h-3.5 w-3.5" />
              <span className="sm:hidden">{MODE_LABELS_SHORT[m]}</span>
              <span className="hidden sm:inline">{MODE_LABELS[m]}</span>
            </span>
          </button>
        );
      })}
    </div>
  );
}
