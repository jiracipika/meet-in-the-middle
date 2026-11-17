/**
 * Venue categories — one table shared by the client (chips, icons, labels)
 * and /api/venues (Overpass tag sets, Photon fallback, default radius).
 * Keep the tags as exact-value alternations: they interpolate directly into
 * the Overpass `[key~"^(a|b)$"]` filters.
 */

export type VenueTagSets = {
  amenity?: string[];
  leisure?: string[];
  tourism?: string[];
};

export type VenueCategory = { label: string; radius: number } & VenueTagSets;

const categories: Record<string, VenueCategory> = {
  food: {
    label: "Food & drink",
    radius: 1500,
    amenity: ["cafe", "restaurant", "fast_food", "food_court", "ice_cream"],
  },
  drinks: {
    label: "Drinks",
    radius: 1500,
    amenity: ["bar", "pub", "biergarten"],
  },
  outdoors: {
    label: "Parks & outdoors",
    radius: 3000,
    leisure: ["park", "garden", "playground"],
  },
  culture: {
    label: "Culture",
    radius: 3000,
    amenity: ["cinema", "theatre", "library", "arts_centre"],
    tourism: ["museum", "gallery", "zoo", "aquarium"],
  },
  active: {
    label: "Active",
    radius: 3000,
    leisure: ["sports_centre", "fitness_centre", "pitch", "swimming_pool"],
  },
};

export const VENUE_CATEGORIES = categories;
export type VenueCat = keyof typeof categories;
export const DEFAULT_VENUE_CAT: VenueCat = "food";
export const VENUE_CAT_IDS = Object.keys(categories) as VenueCat[];

/** Union of every tag key/value across categories — used for name search (q). */
export const ALL_VENUE_TAGS: Required<VenueTagSets> = VENUE_CAT_IDS.reduce(
  (acc, cat) => {
    for (const key of ["amenity", "leisure", "tourism"] as const) {
      for (const value of categories[cat][key] ?? []) acc[key].push(value);
    }
    return acc;
  },
  { amenity: [], leisure: [], tourism: [] } as Required<VenueTagSets>,
);

/** Reverse lookup: tag value → category (for labeling results). */
export function catForTag(key: "amenity" | "leisure" | "tourism", value: string): VenueCat | undefined {
  return VENUE_CAT_IDS.find(cat => categories[cat][key]?.includes(value));
}
