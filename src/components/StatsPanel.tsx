"use client";
import { fmtKm, fmtMin } from "@/lib/format";
export type PersonTrip = { id: string; name: string; color: string; km: number; driveMin: number };
export type Stats = { totalKm: number; avgKm: number; spreadKm: number; fairness: number; maxKm: number };
export default function StatsPanel({ trips, stats, spot, overrideActive, onReset }: {
  trips: PersonTrip[]; stats: Stats; spot: { lat: number; lon: number; label: string }; overrideActive: boolean; onReset: (() => void) | null;
}) {
  return <div className="stats-card">
    <div className="result-heading"><span className="eyebrow">X MARKS YOUR SPOT</span><span className="result-live">● Live</span></div>
    <h2>{spot.label}</h2><p className="result-coords">{spot.lat.toFixed(4)}° / {spot.lon.toFixed(4)}°</p>
    {overrideActive && onReset && <button className="reset-spot" onClick={onReset}>↶ Reset to calculated spot</button>}
    <div className="metrics"><div><strong>{fmtKm(stats.totalKm)}<small> km</small></strong><span>Total distance</span></div><div><strong>{fmtKm(stats.maxKm)}<small> km</small></strong><span>Longest journey</span></div></div>
    <div className="journey-heading"><h3>Everyone’s journey</h3><span>Est. drive</span></div>
    <ul className="journeys">{trips.map(t => <li key={t.id}><span className="trip-dot" style={{ background: t.color }} /><span className="trip-name">{t.name || "Friend"}</span>
      <div className="trip-bar"><span style={{ background: t.color, width: `${stats.maxKm > 0 ? Math.max(3, t.km / stats.maxKm * 100) : 0}%` }} /></div>
      <span className="trip-distance">{fmtKm(t.km)} km<small>≈ {fmtMin(t.driveMin)}</small></span></li>)}</ul>
    <details className="balance-detail"><summary>Journey balance <strong>{stats.fairness}<span> / 100</span></strong></summary>
      <p>100 means equal distances. A low score means journeys differ; it doesn’t mean the meeting calculation failed. Least total travel can favor people near the center.</p>
      <p>Average: {fmtKm(stats.avgKm)} km · Difference: {fmtKm(stats.spreadKm)} km</p>
    </details>
    <a className="button primary maps-link" href={`https://www.google.com/maps/search/?api=1&query=${spot.lat},${spot.lon}`} target="_blank" rel="noreferrer">Open in Google Maps <span>↗</span></a>
    <p className="distance-note">Distances are straight-line. Drive times are estimates, not live routes.</p>
  </div>;
}
