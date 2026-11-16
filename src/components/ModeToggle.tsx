"use client";
import { MODE_HINTS, type Mode } from "@/lib/types";
import { CrosshairIcon, ScaleIcon, SphereIcon } from "./icons";
const modes = [{ id: "median", label: "Least total travel", icon: ScaleIcon }, { id: "minmax", label: "Shortest longest trip", icon: SphereIcon }, { id: "centroid", label: "Geographic center", icon: CrosshairIcon }] as const;
export default function ModeToggle({ mode, onChange }: { mode: Mode; onChange: (m: Mode) => void }) {
  return <fieldset className="mode-options"><legend className="sr-only">Meeting point mode</legend>{modes.map(({ id, label, icon: Icon }) => <label key={id} className={mode === id ? "selected" : ""}>
    <input type="radio" name="meeting-mode" value={id} checked={mode === id} onChange={() => onChange(id)} /><Icon /><span>{label}</span><i />
  </label>)}<p className="mode-hint">{MODE_HINTS[mode]}</p></fieldset>;
}
