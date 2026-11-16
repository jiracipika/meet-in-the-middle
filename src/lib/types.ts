export type LatLng = { lat: number; lon: number };

export type Place = { label: string; lat: number; lon: number };

/** A person row in the sidebar. `place` is null until an address is resolved. */
export type Person = {
  id: string;
  name: string;
  color: string;
  place: Place | null;
  weight: number;
};

export type Mode = "median" | "minmax" | "centroid";

export type Venue = {
  id: string;
  name: string;
  lat: number;
  lon: number;
  amenity: string;
  cuisine?: string;
  distanceKm: number;
};

/**
 * The point everyone meets at. Either the calculated meeting point, or an
 * override the user picked (a venue card or a marker drag).
 */
export type MeetingOverride = {
  label: string;
  lat: number;
  lon: number;
  amenity?: string;
  /** the calculated meeting point at the moment the override was pinned */
  pinnedAt: LatLng;
  /** restored from a share link: never auto-dropped */
  sticky?: boolean;
};

export type SharedPerson = {
  n?: string;
  label?: string;
  lat: number;
  lon: number;
  w?: number;
};

export type ShareState = {
  p: SharedPerson[];
  m?: Mode;
  v?: { name: string; lat: number; lon: number; amenity?: string };
};

export const MODE_LABELS: Record<Mode, string> = {
  median: "Least travel",
  minmax: "Min-max",
  centroid: "Geographic center",
};

export const MODE_HINTS: Record<Mode, string> = {
  median:
    "Keeps the group’s total travel low, with individual travel priorities included.",
  minmax:
    "Keeps the longest journey as short as possible. Everyone has equal priority.",
  centroid: "Finds the geographic center of your group, adjusted for travel priorities.",
};

export const MAX_PEOPLE = 6;

export const DEFAULT_NAMES = ["Alex", "Sam", "Riley", "Jordan", "Casey", "Taylor"];
