/** Vivid, mutually distinguishable colors on the dark map. */
export const PERSON_COLORS = [
  "#E5AD91",
  "#B9C9EB",
  "#B4CC9B",
  "#D4B8D9",
  "#F0CF81",
  "#91CBC3",
] as const;

/** The meeting-spot gold. */
export const GOLD = "#245B45";

export function nextFreeColor(taken: string[]): string {
  return PERSON_COLORS.find((c) => !taken.includes(c)) ?? PERSON_COLORS[0];
}

export function firstFreeIndex(taken: string[]): number {
  return PERSON_COLORS.findIndex((c) => !taken.includes(c));
}
