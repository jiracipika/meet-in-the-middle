"use client";

import { motion } from "motion/react";
import AnimatedNumber from "./AnimatedNumber";
import { fmtKm, fmtMin } from "@/lib/format";

export type PersonTrip = {
  id: string;
  name: string;
  color: string;
  km: number;
  driveMin: number;
};

export type Stats = {
  totalKm: number;
  avgKm: number;
  spreadKm: number;
  fairness: number;
  maxKm: number;
};

const RING_R = 36;
const RING_C = 2 * Math.PI * RING_R;

export default function StatsPanel({
  trips,
  stats,
  spot,
  overrideActive,
  onReset,
  scroll = true,
}: {
  trips: PersonTrip[];
  stats: Stats;
  spot: { lat: number; lon: number; label: string };
  overrideActive: boolean;
  onReset: (() => void) | null;
  /** enable the internal scroll clamping (desktop overlay); disable inside the sheet */
  scroll?: boolean;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: "spring", stiffness: 260, damping: 26 }}
      className={`mitm-beam mitm-glass rounded-2xl p-4 shadow-[0_16px_44px_#00000088] ${
        scroll ? "mitm-scroll max-h-[calc(100%-24px)] overflow-y-auto" : ""
      }`}
      style={{ "--beam-color": "#FFD166" } as React.CSSProperties}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="mitm-kicker text-[10px] text-[#FFD166]">The spot</p>
          <p className="mt-1 max-w-[170px] truncate text-sm font-extrabold">
            {spot.label}
          </p>
        </div>
        <a
          href={`https://www.google.com/maps/search/?api=1&query=${spot.lat},${spot.lon}`}
          target="_blank"
          rel="noreferrer"
          className="shrink-0 rounded-full border border-[#3A4266] bg-[#0E1120] px-3 py-1.5 text-[11px] font-bold text-[#B9C3EA] transition-colors hover:border-[#FFD166] hover:text-[#FFD166]"
        >
          Open in Maps ↗
        </a>
      </div>

      {overrideActive && onReset && (
        <button
          onClick={onReset}
          className="mt-2 w-full rounded-lg border border-[#3A4266] bg-[#0E1120] px-2 py-1 text-[11px] font-semibold text-[#9AA3C7] transition-colors hover:text-[#FFD166]"
        >
          Manually moved — reset to calculated spot ↺
        </button>
      )}

      <div className="mt-3 flex items-center gap-4">
        <svg
          width="92"
          height="92"
          viewBox="0 0 92 92"
          className="shrink-0"
          role="img"
          aria-label={`Balance score ${stats.fairness} of 100`}
        >
          <defs>
            <linearGradient id="mitm-ring-grad" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#FFD166" />
              <stop offset="55%" stopColor="#FF6B9D" />
              <stop offset="100%" stopColor="#4CC9F0" />
            </linearGradient>
          </defs>
          <circle
            cx="46"
            cy="46"
            r={RING_R}
            fill="none"
            stroke="#2A3150"
            strokeWidth="9"
          />
          <motion.circle
            cx="46"
            cy="46"
            r={RING_R}
            fill="none"
            stroke="url(#mitm-ring-grad)"
            strokeWidth="9"
            strokeLinecap="round"
            strokeDasharray={RING_C}
            initial={{ strokeDashoffset: RING_C }}
            animate={{ strokeDashoffset: RING_C * (1 - stats.fairness / 100) }}
            transition={{ type: "spring", stiffness: 70, damping: 18 }}
            transform="rotate(-90 46 46)"
            className="mitm-ring-glow"
          />
          <text
            x="46"
            y="45"
            textAnchor="middle"
            dominantBaseline="central"
            className="fill-[#E7EAF6] text-lg font-extrabold"
          >
            {stats.fairness}
          </text>
          <text
            x="46"
            y="62"
            textAnchor="middle"
            className="fill-[#9AA3C7] text-[8px] font-bold uppercase tracking-wider"
          >
            balance
          </text>
        </svg>

        <div className="grid flex-1 grid-cols-2 gap-x-3 gap-y-2 text-sm">
          <Metric label="total trip">
            <AnimatedNumber value={stats.totalKm} format={(v) => `${fmtKm(v)} km`} />
          </Metric>
          <Metric label="average">
            <AnimatedNumber value={stats.avgKm} format={(v) => `${fmtKm(v)} km`} />
          </Metric>
          <Metric label="spread">
            <AnimatedNumber value={stats.spreadKm} format={(v) => `${fmtKm(v)} km`} />
          </Metric>
          <Metric label="longest">
            <AnimatedNumber value={stats.maxKm} format={(v) => `${fmtKm(v)} km`} />
          </Metric>
        </div>
      </div>

      <ul className="mt-3 space-y-2">
        {trips.map((t) => (
          <li key={t.id} className="flex items-center gap-2">
            <span
              aria-hidden
              className="h-2 w-2 shrink-0 rounded-full"
              style={{ background: t.color }}
            />
            <span className="w-14 shrink-0 truncate text-xs font-bold">
              {t.name}
            </span>
            <div className="mitm-bar-shine h-2 flex-1 overflow-hidden rounded-full bg-[#232A44]">
              <motion.div
                className="h-full rounded-full"
                style={{ background: t.color }}
                initial={{ width: 0 }}
                animate={{ width: `${Math.max(4, (t.km / stats.maxKm) * 100)}%` }}
                transition={{ type: "spring", stiffness: 90, damping: 20 }}
              />
            </div>
            <span className="w-28 shrink-0 text-right text-[11px] tabular-nums text-[#9AA3C7]">
              {fmtKm(t.km)} km · ≈{fmtMin(t.driveMin)} drive
            </span>
          </li>
        ))}
      </ul>

      <p className="mt-2 text-[10px] leading-relaxed text-[#5A6288]">
        Straight-line distances; drive times are rough estimates. Drag the gold
        spot or pick a venue to fine-tune.
      </p>
    </motion.div>
  );
}

function Metric({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <p className="mitm-kicker text-[9px] text-[#5A6288]">{label}</p>
      <p className="mt-0.5 text-sm font-extrabold tabular-nums">{children}</p>
    </div>
  );
}
