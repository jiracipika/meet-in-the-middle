/** Vivid, mutually distinguishable colors on the dark map. */
export const PERSON_COLORS = [
  "#FF6B9D",
  "#FFB454",
  "#4ADE80",
  "#4CC9F0",
  "#B388FF",
  "#F9F871",
] as const;

/** The meeting-spot gold. */
export const GOLD = "#FFD166";

export function nextFreeColor(taken: string[]): string {
  return PERSON_COLORS.find((c) => !taken.includes(c)) ?? PERSON_COLORS[0];
}

export function firstFreeIndex(taken: string[]): number {
  return PERSON_COLORS.findIndex((c) => !taken.includes(c));
}
