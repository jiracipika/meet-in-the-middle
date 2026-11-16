/**
 * Thin adapters over Capacitor plugins for the packaged apps (see mobile/).
 * Every plugin is behind a dynamic import so the web bundle never pulls
 * native code, and every helper is a no-op / falls back to the browser API
 * when not running inside Capacitor.
 */
import type { MouseEvent } from "react";

type CapacitorGlobal = { isNativePlatform?: () => boolean };
declare global {
  interface Window {
    Capacitor?: CapacitorGlobal;
  }
}

export function isNative(): boolean {
  return (
    typeof window !== "undefined" &&
    window.Capacitor?.isNativePlatform?.() === true
  );
}

/** Public site origin — the WebView origin (capacitor://localhost) is meaningless to recipients. */
const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://meetinthemiddlefair.vercel.app";

/** Base for shareable links; on the web this preserves the exact current behavior. */
export function shareBase(): string {
  return isNative()
    ? SITE_URL
    : `${window.location.origin}${window.location.pathname}`;
}

/** "Find me": browser geolocation on the web, native plugin in the app (WKWebView blocks the raw API). */
export async function locate(): Promise<{ latitude: number; longitude: number }> {
  if (!isNative()) {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error("unsupported"));
        return;
      }
      navigator.geolocation.getCurrentPosition(
        (pos) => resolve(pos.coords),
        (err) => reject(Object.assign(new Error("geo_error"), { code: err.code })),
        { enableHighAccuracy: false, timeout: 10000, maximumAge: 60000 },
      );
    });
  }
  const { Geolocation } = await import("@capacitor/geolocation");
  const pos = await Geolocation.getCurrentPosition({
    enableHighAccuracy: false,
    timeout: 10000,
    maximumAge: 60000,
  });
  return pos.coords;
}

/** Clipboard that works on the custom app scheme (navigator.clipboard may be blocked there). */
export async function copyText(text: string): Promise<void> {
  if (isNative()) {
    const { Clipboard } = await import("@capacitor/clipboard");
    await Clipboard.write({ string: text });
    return;
  }
  await navigator.clipboard.writeText(text);
}

/** Native share sheet; resolves false on the web so the caller copies instead. */
export async function shareUrl(url: string): Promise<boolean> {
  if (!isNative()) return false;
  const { Share } = await import("@capacitor/share");
  await Share.share({ url, title: "Meet in the Middle", dialogTitle: "Share your plan" });
  return true;
}

/** Opens an external page in the app's browser view instead of a dead target=_blank tap. */
export async function openExternal(url: string): Promise<void> {
  const { Browser } = await import("@capacitor/browser");
  await Browser.open({ url });
}

/** Click guard for external links; web behavior is untouched. */
export function onExternalLink(e: MouseEvent<HTMLAnchorElement>): void {
  if (!isNative()) return;
  e.preventDefault();
  void openExternal(e.currentTarget.href);
}
