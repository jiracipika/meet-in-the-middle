import type { ShareState } from "./types";

/** Unicode-safe base64url of the JSON state, for URL-hash sharing. */
export function encodeState(state: ShareState): string {
  const bytes = new TextEncoder().encode(JSON.stringify(state));
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function decodeState(hash: string): ShareState | null {
  try {
    const b64 = hash.replace(/^-+/, "").replace(/-/g, "+").replace(/_/g, "/");
    const bin = atob(b64);
    const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
    const parsed: unknown = JSON.parse(new TextDecoder().decode(bytes));
    if (parsed && typeof parsed === "object" && Array.isArray((parsed as ShareState).p)) {
      return parsed as ShareState;
    }
    return null;
  } catch {
    return null;
  }
}
